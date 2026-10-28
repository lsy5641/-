import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { nowIso, ItemRow } from '../db';
import { getAIConfig, chatJson } from '../ai/client';
import { computeHits, isHit } from '../lib/match';

interface JdRow { id: number; company: string; title: string; raw_text: string; summary: string; analyzed: number; recommended: string; chosen_items: string; overrides: string; status: string; created_at: string; updated_at: string }
function parse(row: JdRow) { return { ...row, summary: { requirements: [] as string[], responsibilities: [] as string[], ...JSON.parse(row.summary) }, recommended: JSON.parse(row.recommended), chosen_items: JSON.parse(row.chosen_items), overrides: JSON.parse(row.overrides) }; }

function strArr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

function assembleResume(db: Database, jd: JdRow) {
  const chosen = JSON.parse(jd.chosen_items) as number[];
  const overrides = JSON.parse(jd.overrides) as Record<string, { bullets: string[] }>;
  const rows = db.prepare('SELECT * FROM profile_items ORDER BY section, sort_order, id').all() as unknown as ItemRow[];
  const items = rows.filter((r) => chosen.includes(r.id)).map((r) => {
    const base = JSON.parse(r.bullets) as string[];
    const ov = overrides[String(r.id)];
    return { item_id: r.id, section: r.section, heading: r.heading, period: r.period, bullets: ov ? ov.bullets : base };
  });
  return { items };
}

export function upsertKeywords(db: Database, jdId: number, kws: { term: string; category: string; frequency: number }[]): void {
  const t = nowIso();
  for (const k of kws) {
    const term = String(k.term ?? '').trim();
    if (!term) continue;
    const cat = ['hard_skill', 'soft_skill', 'business'].includes(k.category) ? k.category : 'hard_skill';
    const freq = Number.isFinite(k.frequency) && k.frequency > 0 ? Math.round(k.frequency) : 1;
    db.prepare('INSERT INTO keywords (term, category, created_at, updated_at) VALUES (?,?,?,?) ON CONFLICT(term) DO UPDATE SET category=excluded.category, updated_at=excluded.updated_at').run(term, cat, t, t);
    const kid = (db.prepare('SELECT id FROM keywords WHERE term=?').get(term) as { id: number }).id;
    db.prepare('INSERT INTO jd_keywords (jd_id, keyword_id, frequency) VALUES (?,?,?) ON CONFLICT(jd_id, keyword_id) DO UPDATE SET frequency=excluded.frequency').run(jdId, kid, freq);
  }
}

export function jdsRouter(db: Database): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM jds ORDER BY id DESC').all() as unknown as JdRow[];
    ok(res, rows.map(parse));
  });

  r.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM jds WHERE id=?').get(Number(req.params.id)) as JdRow | undefined;
    if (!row) return fail(res, 404, 'JD 不存在');
    ok(res, parse(row));
  });

  r.post('/', (req, res) => {
    const { company = '', title = '', raw_text = '' } = req.body ?? {};
    if (String(raw_text).trim().length < 30) return fail(res, 400, 'JD 原文太短（至少 30 字），请粘贴完整职位描述');
    const t = nowIso();
    const info = db.prepare('INSERT INTO jds (company, title, raw_text, created_at, updated_at) VALUES (?,?,?,?,?)')
      .run(String(company).trim(), String(title).trim(), String(raw_text), t, t);
    ok(res, parse(db.prepare('SELECT * FROM jds WHERE id=?').get(Number(info.lastInsertRowid)) as unknown as JdRow));
  });

  r.post('/:id/analyze', async (req, res) => {
    const id = Number(req.params.id);
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(id) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    try {
      const cfg = getAIConfig(db);
      const out = await chatJson(cfg, [
        { role: 'system', content: '你是职位描述分析专家。只输出 JSON：{"summary":{"requirements":["要求要点"],"responsibilities":["职责要点"]},"keywords":[{"term":"技能或素质词条","category":"hard_skill|soft_skill|business","frequency":出现次数}]}。keywords 提取 8~20 个，hard_skill=技术工具/语言/方法论，soft_skill=沟通协作领导力等，business=业务领域词。' },
        { role: 'user', content: `公司：${jd.company}\n岗位：${jd.title}\nJD 原文：\n${jd.raw_text}` },
      ]);
      const summary = { requirements: strArr(out?.summary?.requirements), responsibilities: strArr(out?.summary?.responsibilities) };
      const kws: { term: string; category: string; frequency: number }[] = Array.isArray(out?.keywords) ? out.keywords : [];
      db.prepare('UPDATE jds SET summary=?, analyzed=1, updated_at=? WHERE id=?').run(JSON.stringify(summary), nowIso(), id);
      upsertKeywords(db, id, kws);
      ok(res, parse(db.prepare('SELECT * FROM jds WHERE id=?').get(id) as unknown as JdRow));
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  r.put('/:id/chosen', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM jds WHERE id=?').get(id)) return fail(res, 404, 'JD 不存在');
    const ids = req.body?.item_ids;
    if (!Array.isArray(ids) || ids.some((x: unknown) => !Number.isFinite(Number(x)))) return fail(res, 400, 'item_ids 必须是数字数组');
    db.prepare('UPDATE jds SET chosen_items=?, updated_at=? WHERE id=?').run(JSON.stringify(ids.map(Number)), nowIso(), id);
    ok(res, parse(db.prepare('SELECT * FROM jds WHERE id=?').get(id) as unknown as JdRow));
  });

  r.post('/:id/recommend', async (req, res) => {
    const id = Number(req.params.id);
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(id) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    const items = db.prepare('SELECT id, section, heading, bullets FROM profile_items ORDER BY section, sort_order, id').all() as unknown as { id: number; section: string; heading: string; bullets: string }[];
    if (!items.length) return fail(res, 400, '履历还是空的：先去 ① 个人履历录入经历，再回来推荐');
    try {
      const cfg = getAIConfig(db);
      const payload = items.map((i) => ({ item_id: i.id, section: i.section, heading: i.heading, bullets: JSON.parse(i.bullets) }));
      const out = await chatJson(cfg, [
        { role: 'system', content: '你是资深简历顾问。根据 JD 从候选人履历条目中挑选最匹配的经历（可多选，1~6 条），输出 JSON：{"recommended":[{"item_id":数字,"score":0-100整数,"reason":"一句话中文理由（指出匹配点或缺口）"}]}。只输出 JSON。' },
        { role: 'user', content: `【JD】公司：${jd.company} 岗位：${jd.title}\n要求：${jd.summary}\n原文：${jd.raw_text.slice(0, 3000)}\n【履历条目】${JSON.stringify(payload).slice(0, 6000)}` },
      ]);
      const recommended = (Array.isArray(out?.recommended) ? out.recommended : [])
        .filter((x: { item_id?: unknown }) => items.some((i) => i.id === Number(x.item_id)))
        .map((x: { item_id: number; score: number; reason: string }) => ({ item_id: Number(x.item_id), score: Math.max(0, Math.min(100, Math.round(Number(x.score) || 0))), reason: String(x.reason ?? '') }));
      if (!recommended.length) return fail(res, 502, '模型未返回有效推荐，请重试');
      db.prepare('UPDATE jds SET recommended=?, updated_at=? WHERE id=?').run(JSON.stringify(recommended), nowIso(), id);
      ok(res, parse(db.prepare('SELECT * FROM jds WHERE id=?').get(id) as unknown as JdRow));
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  r.get('/:id/resume', (req, res) => {
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(Number(req.params.id)) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    ok(res, assembleResume(db, jd));
  });

  r.post('/:id/match', (req, res) => {
    const id = Number(req.params.id);
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(id) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    const resume = assembleResume(db, jd);
    const text = resume.items.map((i) => i.heading + ' ' + i.bullets.join(' ')).join(' ');
    const kws = db.prepare('SELECT k.id, k.term FROM keywords k JOIN jd_keywords jk ON jk.keyword_id=k.id WHERE jk.jd_id=?').all(id) as unknown as { id: number; term: string }[];
    const result = computeHits(text, kws.map((k) => k.term));
    const ins = db.prepare('INSERT INTO keyword_hits (jd_id, keyword_id, status) VALUES (?,?,?) ON CONFLICT(jd_id, keyword_id) DO UPDATE SET status=excluded.status');
    for (const k of kws) ins.run(id, k.id, isHit(text, k.term) ? 'hit' : 'missing');
    ok(res, { ...result, total: kws.length });
  });

  r.get('/:id/export', (req, res) => {
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(Number(req.params.id)) as JdRow | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    ok(res, { exportedAt: nowIso(), jd: { company: jd.company, title: jd.title }, resume: assembleResume(db, jd) });
  });

  r.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM jd_keywords WHERE jd_id=?').run(id);
    db.prepare('DELETE FROM keyword_hits WHERE jd_id=?').run(id);
    const info = db.prepare('DELETE FROM jds WHERE id=?').run(id);
    ok(res, { deleted: info.changes });
  });

  return r;
}
