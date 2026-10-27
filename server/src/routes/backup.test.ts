import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() {
  const db = await Database.open(null);
  migrate(db);
  return request(buildApp(db));
}

describe('备份恢复', () => {
  it('导出包含各表，恢复后数据回来', async () => {
    const a = await api();
    await a.post('/api/profile/items').send({ section: 'work', heading: 'A', bullets: ['x'] });
    await a.post('/api/materials').send({ title: 'm1', content: 'c1', tags: ['t'] });
    const b = await a.get('/api/backup');
    expect(b.body.data.tables.profile_items).toHaveLength(1);
    expect(b.body.data.tables.materials).toHaveLength(1);
    await a.delete('/api/profile/items/1');
    const c = await api();
    const r = await c.post('/api/backup/restore').send(b.body.data);
    expect(r.body.ok).toBe(true);
    const items = await c.get('/api/profile/items');
    expect(items.body.data).toHaveLength(1);
    const mats = await c.get('/api/materials');
    expect(mats.body.data).toHaveLength(1);
  });
  it('非法备份 400', async () => {
    const a = await api();
    const r = await a.post('/api/backup/restore').send({ nope: 1 });
    expect(r.status).toBe(400);
  });
});