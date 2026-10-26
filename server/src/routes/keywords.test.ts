import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() { const db = await Database.open(null); migrate(db); return request(buildApp(db)); }

describe('词条库API', () => {
  it('手动新增+列表+改+删', async () => {
    const a = await api();
    const c = await a.post('/api/keywords').send({ term: 'Spring Boot', category: 'hard_skill' });
    expect(c.body.data).toMatchObject({ term: 'Spring Boot', category: 'hard_skill', totalFrequency: 0 });
    expect((await a.post('/api/keywords').send({ term: 'Spring Boot', category: 'hard_skill' })).status).toBe(400);
    const up = await a.put('/api/keywords/1').send({ category: 'business', note: 'JD高频' });
    expect(up.body.data).toMatchObject({ category: 'business', note: 'JD高频' });
    await a.delete('/api/keywords/1');
    expect((await a.get('/api/keywords')).body.data).toHaveLength(0);
  });
  it('非法类别 400', async () => {
    expect((await (await api()).post('/api/keywords').send({ term: 'x', category: 'nope' })).status).toBe(400);
  });
});
