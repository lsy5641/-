import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { migrate, setSetting } from '../db';
import { buildApp } from '../app';

function api() { const db = new DatabaseSync(':memory:'); migrate(db); return request(buildApp(db)); }
function apiWithKey() {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  setSetting(db, 'ai.apiKey', 'sk-test');
  return { db, app: request(buildApp(db)) };
}

describe('JD API', () => {
  it('创建/列表/详情/删除', async () => {
    const a = api();
    const c = await a.post('/api/jds').send({ company: '字节', title: '后端开发', raw_text: '负责高并发服务…'.repeat(5) });
    expect(c.body.data).toMatchObject({ company: '字节', title: '后端开发', analyzed: 0, status: 'draft' });
    expect((await a.get('/api/jds')).body.data).toHaveLength(1);
    const one = await a.get('/api/jds/1');
    expect(one.body.data.raw_text).toContain('高并发');
    await a.delete('/api/jds/1');
    expect((await a.get('/api/jds')).body.data).toHaveLength(0);
  });
  it('raw_text 太短返回 400', async () => {
    expect((await api().post('/api/jds').send({ company: 'x', title: 'y', raw_text: '短' })).status).toBe(400);
  });
});

describe('JD解析提词条', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('解析后 summary 与词条入库、跨JD同名词条合并计数', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      summary: { requirements: ['精通 Java', '有高并发经验'], responsibilities: ['核心服务开发'] },
      keywords: [{ term: 'Java', category: 'hard_skill', frequency: 3 }, { term: '沟通', category: 'soft_skill', frequency: 1 }],
    }) } }] }), { status: 200 })));
    const { db, app } = apiWithKey();
    await app.post('/api/jds').send({ company: 'A', title: '后端', raw_text: 'x'.repeat(40) });
    const r = await app.post('/api/jds/1/analyze');
    expect(r.body.ok).toBe(true);
    expect(r.body.data.analyzed).toBe(1);
    expect(r.body.data.summary.requirements).toEqual(['精通 Java', '有高并发经验']);
    await app.post('/api/jds').send({ company: 'B', title: '后端', raw_text: 'y'.repeat(40) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: { requirements: [], responsibilities: [] }, keywords: [{ term: 'Java', category: 'hard_skill', frequency: 5 }] }) } }] }), { status: 200 })));
    await app.post('/api/jds/2/analyze');
    expect((db.prepare('SELECT COUNT(*) c FROM keywords WHERE term=?').get('Java') as { c: number }).c).toBe(1);
    expect((db.prepare('SELECT COUNT(*) c FROM jd_keywords WHERE keyword_id=(SELECT id FROM keywords WHERE term=?)').get('Java') as { c: number }).c).toBe(2);
    const k = await app.get('/api/keywords');
    const java = k.body.data.find((x: { term: string }) => x.term === 'Java');
    expect(java.totalFrequency).toBe(8);
  });
  it('未配 key 中文报错', async () => {
    const a = api();
    await a.post('/api/jds').send({ company: 'A', title: 'b', raw_text: 'z'.repeat(40) });
    const r = await a.post('/api/jds/1/analyze');
    expect(r.status).toBe(502);
    expect(r.body.error).toContain('API Key');
  });
});
