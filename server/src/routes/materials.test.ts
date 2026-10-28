import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() { const db = await Database.open(null); migrate(db); return request(buildApp(db)); }

describe('素材API', () => {
  it('增查改删全链路', async () => {
    const a = await api();
    const c = await a.post('/api/materials').send({ title: '高并发故事', content: 'STAR……', tags: ['高并发', '带教'] });
    expect(c.body.data).toMatchObject({ title: '高并发故事', tags: ['高并发', '带教'], source: 'manual' });
    const l = await a.get('/api/materials');
    expect(l.body.data).toHaveLength(1);
    await a.put('/api/materials/1').send({ title: '改名', content: 'x', tags: [] });
    const l2 = await a.get('/api/materials');
    expect(l2.body.data[0].title).toBe('改名');
    await a.delete('/api/materials/1');
    expect((await a.get('/api/materials')).body.data).toHaveLength(0);
  });
  it('非法 tags 400', async () => {
    expect((await (await api()).post('/api/materials').send({ title: 't', tags: 'no' })).status).toBe(400);
  });
});
