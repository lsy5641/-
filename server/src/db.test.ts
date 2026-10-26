import { describe, it, expect } from 'vitest';
import { Database, migrate, takeVersion, trimVersions, nowIso, SECTIONS } from './db';

async function freshDb(): Promise<Database> {
  const db = await Database.open(null);
  migrate(db);
  return db;
}

function insertItem(db: Database): number {
  const t = nowIso();
  return Number(db.prepare(
    'INSERT INTO profile_items (section,heading,period,bullets,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)'
  ).run('skill', '', '', '[]', 0, t, t).lastInsertRowid);
}

describe('migrate', async () => {
  it('建表齐全且可插入查询', async () => {
    const db = await freshDb();
    for (const t of ['profile_items', 'profile_versions', 'materials', 'jds', 'keywords', 'jd_keywords', 'keyword_hits', 'coach_runs', 'plans', 'questions', 'mock_chats', 'settings']) {
      expect((db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c).toBe(0);
    }
    const id = insertItem(db);
    expect(id).toBeGreaterThan(0);
  });
  it('SECTIONS 五类', () => expect(SECTIONS).toEqual(['work', 'project', 'education', 'skill', 'award']));
});

describe('takeVersion + trimVersions', async () => {
  it('快照取当前条目内容', async () => {
    const db = await freshDb();
    const id = insertItem(db);
    db.prepare('UPDATE profile_items SET heading=?, bullets=? WHERE id=?').run('A公司', JSON.stringify(['x', 'y']), id);
    const vid = takeVersion(db, id, 'manual');
    const row = db.prepare('SELECT snapshot, trigger FROM profile_versions WHERE id=?').get(vid) as { snapshot: string; trigger: string };
    expect(JSON.parse(row.snapshot)).toEqual({ heading: 'A公司', bullets: ['x', 'y'] });
    expect(row.trigger).toBe('manual');
  });
  it('超过50版裁剪最旧', async () => {
    const db = await freshDb();
    const id = insertItem(db);
    for (let i = 1; i <= 55; i++) {
      db.prepare('UPDATE profile_items SET heading=? WHERE id=?').run('h' + i, id);
      takeVersion(db, id, 'manual');
    }
    expect((db.prepare('SELECT COUNT(*) c FROM profile_versions WHERE item_id=?').get(id) as { c: number }).c).toBe(50);
    const first = db.prepare('SELECT snapshot FROM profile_versions WHERE item_id=? ORDER BY id ASC LIMIT 1').get(id) as { snapshot: string };
    expect(JSON.parse(first.snapshot).heading).toBe('h6');
  });
});
