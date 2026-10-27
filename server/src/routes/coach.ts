import { Router } from 'express';
import { Database } from '../db';
import { ok, fail } from '../http';
import { nowIso, takeVersion, ItemRow } from '../db';
import { getAIConfig, chatJson } from '../ai/client';

interface RunRow { id: number; jd_id: number; item_id: number; original_bullets: string; suggestions: string; backfilled: number; created_at: string; updated_at: string }
interface Suggestion { bullet_index: number; new_text: string; star_label: string; reason: string; status: string }
interface JdRowLite { id: number; company: string; title: string; summary: string; raw_text: string; overrides: string }

function syncOverrides(db: Database, run: RunRow): void {
  const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(run.jd_id) as JdRowLite;
  const overrides = JSON.parse(jd.overrides) as Record<string, { bullets: string[] }>;
  const base = JSON.parse(run.original_bullets) as string[];
  const sug = JSON.parse(run.suggestions) as Suggestion[];
  const bullets = [...base];
  for (const s of sug) {
    if (s.status === 'accepted' && s.bullet_index >= 0 && s.bullet_index < bullets.length) bullets[s.bullet_index] = s.new_text;
  }
  overrides[String(run.item_id)] = { bullets };
  db.prepare('UPDATE jds SET overrides=?, updated_at=? WHERE id=?').run(JSON.stringify(overrides), nowIso(), run.jd_id);
}

function loadRun(db: Database, id: number): RunRow | undefined {
  return db.prepare('SELECT * FROM coach_runs WHERE id=?').get(id) as RunRow | undefined;
}

export function coachRouter(db: Database): Router {
  const r = Router();

  r.post('/generate/:jdId/:itemId', async (req, res) => {
    const jdId = Number(req.params.jdId);
    const itemId = Number(req.params.itemId);
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(jdId) as JdRowLite | undefined;
    const item = db.prepare('SELECT * FROM profile_items WHERE id=?').get(itemId) as ItemRow | undefined;
    if (!jd || !item) return fail(res, 404, 'JD 或履历条目不存在');
    const bullets = JSON.parse(item.bullets) as string[];
    if (!bullets.length) return fail(res, 400, '该条目还没有亮点，先补充内容再优化');
    try {
      const cfg = getAIConfig(db);
      const out = await chatJson(cfg, [
        { role: 'system', content: '你是 STAR 简历教练。针对 JD 要求逐条改写候选人的亮点 bullet：动词开头、覆盖情境/任务/行动/结果、尽量量化、每条不超过 80 字、不编造事实（无数据时用定性描述）。只输出 JSON：{"suggestions":[{"bullet_index":数字,"new_text":"改写后","star_label":"补强了 S/T/A/R 中哪部分","reason":"中文理由"}]}' },
        { role: 'user', content: `【JD】${jd.company} ${jd.title}\n要点：${jd.summary}\n【条目】${item.heading}\n${bullets.map((b, i) => `[${i}] ${b}`).join('\n')}` },
      ]);
      const raw = Array.isArray(out?.suggestions) ? out.suggestions : [];
      const suggestions: Suggestion[] = raw
        .filter((s: { bullet_index?: unknown }) => Number.isInteger(Number(s.bullet_index)) && Number(s.bullet_index) >= 0 && Number(s.bullet_index) < bullets.length)
        .map((s: { bullet_index: number; new_text: string; star_label?: string; reason?: string }) => ({
          bullet_index: Number(s.bullet_index), new_text: String(s.new_text ?? '').slice(0, 300),
          star_label: String(s.star_label ?? ''), reason: String(s.reason ?? ''), status: 'pending',
        }));
      if (!suggestions.length) return fail(res, 502, '模型未返回有效改写建议，请重试');
      const t = nowIso();
      db.prepare('DELETE FROM coach_runs WHERE jd_id=? AND item_id=?').run(jdId, itemId);
      const info = db.prepare('INSERT INTO coach_runs (jd_id, item_id, original_bullets, suggestions, backfilled, created_at, updated_at) VALUES (?,?,?,?,0,?,?)')
        .run(jdId, itemId, JSON.stringify(bullets), JSON.stringify(suggestions), t, t);
      const run = loadRun(db, Number(info.lastInsertRowid)) as RunRow;
      ok(res, { ...run, original_bullets: JSON.parse(run.original_bullets), suggestions: JSON.parse(run.suggestions) });
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  r.get('/runs/:id', (req, res) => {
    const run = loadRun(db, Number(req.params.id));
    if (!run) return fail(res, 404, '教练记录不存在');
    ok(res, { ...run, original_bullets: JSON.parse(run.original_bullets), suggestions: JSON.parse(run.suggestions) });
  });

  r.put('/:id/decide', (req, res) => {
    const run = loadRun(db, Number(req.params.id));
    if (!run) return fail(res, 404, '教练记录不存在');
    const idx = Number(req.body?.bullet_index);
    const status = String(req.body?.status);
    if (!['accepted', 'rejected', 'pending'].includes(status)) return fail(res, 400, 'status 必须 accepted/rejected/pending');
    const sug = JSON.parse(run.suggestions) as Suggestion[];
    const s = sug.find((x) => x.bullet_index === idx);
    if (!s) return fail(res, 404, '建议不存在');
    s.status = status;
    db.prepare('UPDATE coach_runs SET suggestions=?, updated_at=? WHERE id=?').run(JSON.stringify(sug), nowIso(), run.id);
    syncOverrides(db, { ...run, suggestions: JSON.stringify(sug) });
    ok(res, { id: run.id, suggestions: sug });
  });

  r.post('/:id/backfill', (req, res) => {
    const run = loadRun(db, Number(req.params.id));
    if (!run) return fail(res, 404, '教练记录不存在');
    const accepted = (JSON.parse(run.suggestions) as Suggestion[]).filter((s) => s.status === 'accepted');
    if (!accepted.length) return fail(res, 400, '还没有采纳任何建议');
    const base = JSON.parse(run.original_bullets) as string[];
    for (const s of accepted) base[s.bullet_index] = s.new_text;
    db.prepare('UPDATE profile_items SET bullets=?, updated_at=? WHERE id=?').run(JSON.stringify(base), nowIso(), run.item_id);
    takeVersion(db, run.item_id, 'from_backfill');
    db.prepare('UPDATE coach_runs SET backfilled=1, updated_at=? WHERE id=?').run(nowIso(), run.id);
    ok(res, { backfilled: true, bullets: base });
  });

  r.post('/:id/material', (req, res) => {
    const run = loadRun(db, Number(req.params.id));
    if (!run) return fail(res, 404, '教练记录不存在');
    const accepted = (JSON.parse(run.suggestions) as Suggestion[]).filter((s) => s.status === 'accepted');
    if (!accepted.length) return fail(res, 400, '还没有采纳任何建议');
    const jd = db.prepare('SELECT company, title FROM jds WHERE id=?').get(run.jd_id) as { company: string; title: string };
    const t = nowIso();
    const info = db.prepare('INSERT INTO materials (title, content, tags, source, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(`${jd.company}${jd.title} 改写亮点`, accepted.map((s) => s.new_text).join('\n'), JSON.stringify([jd.title]), 'from_coach', t, t);
    ok(res, { materialId: Number(info.lastInsertRowid), count: accepted.length });
  });

  return r;
}