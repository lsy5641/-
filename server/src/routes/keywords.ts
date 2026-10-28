import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { nowIso } from '../db';

const CATS = ['hard_skill', 'soft_skill', 'business'];

export function keywordsRouter(db: Database): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const rows = db.prepare(`SELECT k.*, COALESCE((SELECT SUM(frequency) FROM jd_keywords jk WHERE jk.keyword_id=k.id),0) AS totalFrequency,
      (SELECT COUNT(*) FROM jd_keywords jk2 WHERE jk2.keyword_id=k.id) AS jdCount FROM keywords k ORDER BY totalFrequency DESC, k.id ASC`).all() as unknown as Record<string, unknown>[];
    ok(res, rows);
  });

  r.post('/', (req, res) => {
    const term = String(req.body?.term ?? '').trim();
    const category = String(req.body?.category ?? 'hard_skill');
    if (!term) return fail(res, 400, '词条不能为空');
    if (!CATS.includes(category)) return fail(res, 400, `category 必须是 ${CATS.join('/')}`);
    if (db.prepare('SELECT id FROM keywords WHERE term=?').get(term)) return fail(res, 400, '该词条已存在');
    const t = nowIso();
    db.prepare('INSERT INTO keywords (term, category, created_at, updated_at) VALUES (?,?,?,?)').run(term, category, t, t);
    ok(res, { term, category, note: '', totalFrequency: 0 });
  });

  r.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM keywords WHERE id=?').get(id) as { id: number; term: string; category: string; note: string } | undefined;
    if (!cur) return fail(res, 404, '词条不存在');
    const category = String(req.body?.category ?? cur.category);
    if (!CATS.includes(category)) return fail(res, 400, `category 必须是 ${CATS.join('/')}`);
    const note = req.body?.note !== undefined ? String(req.body.note) : cur.note;
    db.prepare('UPDATE keywords SET category=?, note=?, updated_at=? WHERE id=?').run(category, note, nowIso(), id);
    ok(res, { id, term: cur.term, category, note });
  });

  r.delete('/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM jd_keywords WHERE keyword_id=?').run(id);
    db.prepare('DELETE FROM keyword_hits WHERE keyword_id=?').run(id);
    const info = db.prepare('DELETE FROM keywords WHERE id=?').run(id);
    ok(res, { deleted: info.changes });
  });

  return r;
}
