import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { nowIso } from '../db';
import { getAIConfig, chatJson } from '../ai/client';

interface JdRow { id: number; company: string; title: string; raw_text: string; summary: string; analyzed: number; recommended: string; chosen_items: string; overrides: string; status: string; created_at: string; updated_at: string }
function parse(row: JdRow) { return { ...row, summary: JSON.parse(row.summary), recommended: JSON.parse(row.recommended), chosen_items: JSON.parse(row.chosen_items), overrides: JSON.parse(row.overrides) }; }

function strArr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; }

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

  r.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM jd_keywords WHERE jd_id=?').run(id);
    db.prepare('DELETE FROM keyword_hits WHERE jd_id=?').run(id);
    const info = db.prepare('DELETE FROM jds WHERE id=?').run(id);
    ok(res, { deleted: info.changes });
  });

  return r;
}
