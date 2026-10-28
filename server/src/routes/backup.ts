import { Router } from 'express';
import { Database } from '../db';
import { ok, fail } from '../http';
import { nowIso } from '../db';

const TABLES = ['profile_items', 'profile_versions', 'materials', 'jds', 'keywords', 'jd_keywords', 'keyword_hits', 'coach_runs', 'plans', 'questions', 'mock_chats', 'settings'];

export function backupRouter(db: Database): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const tables: Record<string, unknown[]> = {};
    for (const t of TABLES) tables[t] = db.prepare(`SELECT * FROM ${t}`).all() as unknown[];
    ok(res, { version: 1, exportedAt: nowIso(), tables });
  });

  r.post('/restore', (req, res) => {
    const body = req.body ?? {};
    if (!body.tables || typeof body.tables !== 'object') return fail(res, 400, '备份格式不正确：缺少 tables');
    const unknown = Object.keys(body.tables).filter((t) => !TABLES.includes(t));
    if (unknown.length) return fail(res, 400, `备份包含未知表：${unknown.join(',')}`);
    try {
      for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
      for (const t of TABLES) {
        const rows = body.tables[t];
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          const keys = Object.keys(row);
          if (!keys.length) continue;
          const sql = `INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
          db.prepare(sql).run(...keys.map((k) => (row[k] === null ? null : row[k])));
        }
      }
      ok(res, { restored: true, at: nowIso() });
    } catch (e) { fail(res, 500, '恢复失败：' + (e as Error).message); }
  });

  return r;
}