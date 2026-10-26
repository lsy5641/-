import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

export const SECTIONS = ['work', 'project', 'education', 'skill', 'award'] as const;
export type Section = (typeof SECTIONS)[number];

export function nowIso(): string { return new Date().toISOString(); }

export interface Stmt {
  run(...params: unknown[]): { changes: number; lastInsertRowid: number };
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
}

export class Database {
  private constructor(private raw: SqlJsDatabase, private file: string | null) {}

  static async open(file: string | null): Promise<Database> {
    const SQL = await initSqlJs();
    const raw = file && fs.existsSync(file)
      ? new SQL.Database(new Uint8Array(fs.readFileSync(file)))
      : new SQL.Database();
    return new Database(raw, file);
  }

  private persist(): void {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, Buffer.from(this.raw.export()));
  }

  exec(sql: string): void { this.raw.exec(sql); this.persist(); }

  prepare(sql: string): Stmt {
    const raw = this.raw;
    const self = this;
    const scalar = (q: string): number => (raw.exec(q)[0].values[0][0] as number);
    return {
      run(...params: unknown[]) {
        const st = raw.prepare(sql);
        if (params.length) st.bind(params as never[]);
        st.step();
        st.free();
        const out = { changes: scalar('SELECT changes()'), lastInsertRowid: scalar('SELECT last_insert_rowid()') };
        self.persist();
        return out;
      },
      get(...params: unknown[]) {
        const st = raw.prepare(sql);
        if (params.length) st.bind(params as never[]);
        const ok = st.step();
        const row = ok ? st.getAsObject() : undefined;
        st.free();
        return row;
      },
      all(...params: unknown[]) {
        const st = raw.prepare(sql);
        if (params.length) st.bind(params as never[]);
        const out: any[] = [];
        while (st.step()) out.push(st.getAsObject());
        st.free();
        return out;
      },
    };
  }
}

export async function openDb(file = path.resolve('data/jobcoach.db')): Promise<Database> {
  const db = await Database.open(file);
  migrate(db);
  return db;
}

export interface ItemRow {
  id: number; section: string; heading: string; period: string;
  bullets: string; sort_order: number; created_at: string; updated_at: string;
}

export function migrate(db: Database): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS profile_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section TEXT NOT NULL,
    heading TEXT NOT NULL DEFAULT '',
    period TEXT NOT NULL DEFAULT '',
    bullets TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profile_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    trigger TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    raw_text TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '{}',
    analyzed INTEGER NOT NULL DEFAULT 0,
    recommended TEXT NOT NULL DEFAULT '[]',
    chosen_items TEXT NOT NULL DEFAULT '[]',
    overrides TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'hard_skill',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS jd_keywords (
    jd_id INTEGER NOT NULL,
    keyword_id INTEGER NOT NULL,
    frequency INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (jd_id, keyword_id)
  );
  CREATE TABLE IF NOT EXISTS keyword_hits (
    jd_id INTEGER NOT NULL,
    keyword_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'missing',
    PRIMARY KEY (jd_id, keyword_id)
  );
  CREATE TABLE IF NOT EXISTS coach_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jd_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    original_bullets TEXT NOT NULL DEFAULT '[]',
    suggestions TEXT NOT NULL DEFAULT '[]',
    backfilled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jd_id INTEGER NOT NULL,
    weeks TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jd_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    hint TEXT NOT NULL DEFAULT '',
    based_on TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mock_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_profile_versions_item ON profile_versions (item_id);
  CREATE INDEX IF NOT EXISTS idx_questions_jd ON questions (jd_id);
  CREATE INDEX IF NOT EXISTS idx_coach_runs_jd_item ON coach_runs (jd_id, item_id);`);
}

export function takeVersion(db: Database, itemId: number, trigger: string): number {
  const row = db.prepare('SELECT heading, bullets FROM profile_items WHERE id = ?').get(itemId) as Pick<ItemRow, 'heading' | 'bullets'> | undefined;
  if (!row) throw new Error('takeVersion: 条目不存在 id=' + itemId);
  const snapshot = JSON.stringify({ heading: row.heading, bullets: JSON.parse(row.bullets) });
  const info = db.prepare('INSERT INTO profile_versions (item_id, snapshot, trigger, created_at) VALUES (?, ?, ?, ?)')
    .run(itemId, snapshot, trigger, nowIso());
  trimVersions(db, itemId);
  return Number(info.lastInsertRowid);
}

export function trimVersions(db: Database, itemId: number, keep = 50): number {
  const stale = db.prepare('SELECT id FROM profile_versions WHERE item_id = ? ORDER BY id DESC LIMIT -1 OFFSET ?').all(itemId, keep) as { id: number }[];
  const del = db.prepare('DELETE FROM profile_versions WHERE id = ?');
  for (const v of stale) del.run(v.id);
  return stale.length;
}

export function getSetting(db: Database, key: string, fallback = ''): string {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}
