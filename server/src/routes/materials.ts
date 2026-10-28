import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { nowIso } from '../db';

interface MatRow { id: number; title: string; content: string; tags: string; source: string; created_at: string; updated_at: string }
function parse(row: MatRow) { return { ...row, tags: JSON.parse(row.tags) }; }

export function materialsRouter(db: Database): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM materials ORDER BY id DESC').all() as unknown as MatRow[];
    ok(res, rows.map(parse));
  });

  r.post('/', (req, res) => {
    const { title = '', content = '', tags = [] } = req.body ?? {};
    if (!Array.isArray(tags) || tags.some((x: unknown) => typeof x !== 'string')) return fail(res, 400, 'tags 必须是字符串数组');
    const t = nowIso();
    const info = db.prepare('INSERT INTO materials (title, content, tags, source, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run(String(title), String(content), JSON.stringify(tags), 'manual', t, t);
    ok(res, parse(db.prepare('SELECT * FROM materials WHERE id=?').get(Number(info.lastInsertRowid)) as unknown as MatRow));
  });

  r.put('/:id', (req, res) => {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM materials WHERE id=?').get(id) as MatRow | undefined;
    if (!cur) return fail(res, 404, '素材不存在');
    const body = req.body ?? {};
    if (body.tags !== undefined && !(Array.isArray(body.tags) && body.tags.every((x: unknown) => typeof x === 'string'))) return fail(res, 400, 'tags 必须是字符串数组');
    db.prepare('UPDATE materials SET title=?, content=?, tags=?, updated_at=? WHERE id=?')
      .run(body.title ?? cur.title, body.content ?? cur.content, JSON.stringify(body.tags ?? JSON.parse(cur.tags)), nowIso(), id);
    ok(res, parse(db.prepare('SELECT * FROM materials WHERE id=?').get(id) as unknown as MatRow));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM materials WHERE id=?').run(Number(req.params.id));
    ok(res, { deleted: info.changes });
  });

  return r;
}
