import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Database, migrate, setSetting } from '../db';
import { buildApp } from '../app';

async function api() { const db = await Database.open(null); migrate(db); return request(buildApp(db)); }
async function apiWithKey() {
  const db = await Database.open(null);
  migrate(db);
  setSetting(db, 'ai.apiKey', 'sk-test');
  return { db, app: request(buildApp(db)) };
}

describe('JD API', () => {
  it('创建/列表/详情/删除', async () => {
    const a = await api();
    const c = await a.post('/api/jds').send({ company: '字节', title: '后端开发', raw_text: '负责高并发服务…'.repeat(5) });
    expect(c.body.data).toMatchObject({ company: '字节', title: '后端开发', analyzed: 0, status: 'draft' });
    expect((await a.get('/api/jds')).body.data).toHaveLength(1);
    const one = await a.get('/api/jds/1');
    expect(one.body.data.raw_text).toContain('高并发');
    await a.delete('/api/jds/1');
    expect((await a.get('/api/jds')).body.data).toHaveLength(0);
  });
  it('raw_text 太短返回 400', async () => {
    expect((await (await api()).post('/api/jds').send({ company: 'x', title: 'y', raw_text: '短' })).status).toBe(400);
  });
});

describe('JD解析提词条', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('解析后 summary 与词条入库、跨JD同名词条合并计数', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      summary: { requirements: ['精通 Java', '有高并发经验'], responsibilities: ['核心服务开发'] },
      keywords: [{ term: 'Java', category: 'hard_skill', frequency: 3 }, { term: '沟通', category: 'soft_skill', frequency: 1 }],
    }) } }] }), { status: 200 })));
    const { db, app } = await apiWithKey();
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
    const a = await api();
    await a.post('/api/jds').send({ company: 'A', title: 'b', raw_text: 'z'.repeat(40) });
    const r = await a.post('/api/jds/1/analyze');
    expect(r.status).toBe(502);
    expect(r.body.error).toContain('API Key');
  });
});

describe('推荐匹配经历', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('推荐写入 recommended，勾选保存 chosen_items', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      recommended: [{ item_id: 1, score: 88, reason: '后端经验高度匹配' }],
    }) } }] }), { status: 200 })));
    const { app } = await apiWithKey();
    await app.post('/api/profile/items').send({ section: 'work', heading: 'A公司', bullets: ['Java 开发'] });
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'x'.repeat(40) });
    const r = await app.post('/api/jds/1/recommend');
    expect(r.body.data.recommended).toEqual([{ item_id: 1, score: 88, reason: '后端经验高度匹配' }]);
    const c = await app.put('/api/jds/1/chosen').send({ item_ids: [1] });
    expect(c.body.data.chosen_items).toEqual([1]);
  });
  it('无履历条目前提下推荐返回 400 中文', async () => {
    const { app } = await apiWithKey();
    await app.post('/api/jds').send({ company: 'C', title: 'b', raw_text: 'y'.repeat(40) });
    const r = await app.post('/api/jds/1/recommend');
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('履历');
  });
});

describe('组装定制简历与命中率', () => {
  it('按 chosen_items 组装、命中重算与导出', async () => {
    const { db, app } = await apiWithKey();
    await app.post('/api/profile/items').send({ section: 'work', heading: 'A公司', bullets: ['用 Java 做过高并发系统'] });
    await app.post('/api/profile/items').send({ section: 'work', heading: 'B公司', bullets: ['前端 Vue 开发'] });
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'z'.repeat(40) });
    await app.post('/api/keywords').send({ term: 'Java', category: 'hard_skill' });
    await app.post('/api/keywords').send({ term: 'Vue', category: 'hard_skill' });
    db.prepare('INSERT INTO jd_keywords (jd_id, keyword_id, frequency) VALUES (1,1,2)').run();
    db.prepare('INSERT INTO jd_keywords (jd_id, keyword_id, frequency) VALUES (1,2,1)').run();
    await app.put('/api/jds/1/chosen').send({ item_ids: [1] });
    const r = await app.get('/api/jds/1/resume');
    expect(r.body.data.items.map((i: { item_id: number }) => i.item_id)).toEqual([1]);
    const m = await app.post('/api/jds/1/match');
    expect(m.body.data.total).toBe(2);
    expect(m.body.data.hits).toEqual(['Java']);
    expect(m.body.data.coveragePct).toBe(50);
    const e = await app.get('/api/jds/1/export');
    expect(e.body.data.resume.items[0].bullets[0]).toContain('Java');
  });
});

describe('未解析JD的防御', () => {
  it('summary 默认空数组，避免前端 join 崩溃', async () => {
    const a = await api();
    const c = await a.post('/api/jds').send({ company: 'X', title: 'y', raw_text: 'w'.repeat(40) });
    expect(c.body.data.summary.requirements).toEqual([]);
    expect(c.body.data.summary.responsibilities).toEqual([]);
    const l = await a.get('/api/jds');
    expect(l.body.data[0].summary.requirements).toEqual([]);
  });
});
