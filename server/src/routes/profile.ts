import { Router } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { ok, fail } from '../http';
import { SECTIONS, nowIso, takeVersion, ItemRow } from '../db';

interface ItemDto { id: number; section: string; heading: string; period: string; bullets: string[]; sort_order: number; created_at: string; updated_at: string }

function parseItem(row: ItemRow): ItemDto {
  return { ...row, bullets: JSON.parse(row.bullets) };
}

function validateBullets(body: any): boolean {
  const b = body?.bullets ?? [];
  return Array.isArray(b) && b.every((x: unknown) => typeof x === 'string');
}

export function profileRouter(db: DatabaseSync): Router {
  const r = Router();

  r.get('/items', (_req, res) => {
    const rows = db.prepare('SELECT * FROM profile_items ORDER BY section, sort_order, id').all() as unknown as ItemRow[];
    ok(res, rows.map(parseItem));
  });

  r.post('/items', (req, res) => {
    const body = req.body ?? {};
    if (!(SECTIONS as readonly string[]).includes(body.section)) return fail(res, 400, `section 必须是 ${SECTIONS.join('/')} 之一`);
    if (!validateBullets(body)) return fail(res, 400, 'bullets 必须是字符串数组');
    const t = nowIso();
    const info = db.prepare('INSERT INTO profile_items (section, heading, period, bullets, sort_order, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(body.section, body.heading ?? '', body.period ?? '', JSON.stringify(body.bullets ?? []), body.sort_order ?? 0, t, t);
    const id = Number(info.lastInsertRowid);
    takeVersion(db, id, 'create');
    ok(res, parseItem(db.prepare('SELECT * FROM profile_items WHERE id=?').get(id) as unknown as ItemRow));
  });

  r.put('/items/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM profile_items WHERE id=?').get(id)) return fail(res, 404, '条目不存在');
    const body = req.body ?? {};
    if (body.bullets !== undefined && !validateBullets(body)) return fail(res, 400, 'bullets 必须是字符串数组');
    db.prepare('UPDATE profile_items SET heading=?, period=?, bullets=?, updated_at=? WHERE id=?')
      .run(body.heading ?? '', body.period ?? '', JSON.stringify(body.bullets ?? []), nowIso(), id);
    takeVersion(db, id, 'manual');
    ok(res, parseItem(db.prepare('SELECT * FROM profile_items WHERE id=?').get(id) as unknown as ItemRow));
  });

  r.delete('/items/:id', (req, res) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM profile_versions WHERE item_id=?').run(id);
    const info = db.prepare('DELETE FROM profile_items WHERE id=?').run(id);
    ok(res, { deleted: info.changes });
  });

  r.get('/items/:id/versions', (req, res) => {
    const id = Number(req.params.id);
    const rows = db.prepare('SELECT * FROM profile_versions WHERE item_id=? ORDER BY id DESC').all(id) as unknown as { id: number; item_id: number; snapshot: string; trigger: string; created_at: string }[];
    ok(res, rows.map(v => ({ ...v, snapshot: JSON.parse(v.snapshot) })));
  });

  r.post('/items/:id/restore', (req, res) => {
    const id = Number(req.params.id);
    const vid = Number(req.body?.version_id);
    const ver = db.prepare('SELECT snapshot FROM profile_versions WHERE id=? AND item_id=?').get(vid, id) as { snapshot: string } | undefined;
    if (!ver) return fail(res, 404, '条目或版本不存在');
    const snap = JSON.parse(ver.snapshot) as { heading: string; bullets: string[] };
    db.prepare('UPDATE profile_items SET heading=?, bullets=?, updated_at=? WHERE id=?')
      .run(snap.heading, JSON.stringify(snap.bullets ?? []), nowIso(), id);
    takeVersion(db, id, 'restore');
    ok(res, { restored_version: vid });
  });

  return r;
}
