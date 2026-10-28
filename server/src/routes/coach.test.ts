import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Database, migrate, setSetting } from '../db';
import { buildApp } from '../app';

async function apiWithKey() {
  const db = await Database.open(null);
  migrate(db);
  setSetting(db, 'ai.apiKey', 'sk-test');
  return request(buildApp(db));
}

function coachMock(suggestions: object[]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ suggestions }) } }] }), { status: 200 })));
}

async function setup() {
  const app = await apiWithKey();
  await app.post('/api/profile/items').send({ section: 'work', heading: 'A公司', bullets: ['负责系统开发', '性能优化'] });
  await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'q'.repeat(40) });
  return app;
}

describe('AI教练', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('生成建议并落库', async () => {
    coachMock([
      { bullet_index: 0, new_text: '主导 A 系统重构，服务 10 万用户，P99 延迟下降 70%', star_label: 'A+R 补强', reason: '补充规模与量化结果' },
      { bullet_index: 1, new_text: '优化 SQL 索引与缓存，QPS 从 800 提升至 3200', star_label: 'A+R', reason: '量化性能收益' },
    ]);
    const app = await setup();
    const r = await app.post('/api/coach/generate/1/1');
    expect(r.body.ok).toBe(true);
    expect(r.body.data.suggestions).toHaveLength(2);
    expect(r.body.data.suggestions[0].status).toBe('pending');
  });

  it('采纳写入 overrides，拒绝不写入', async () => {
    coachMock([
      { bullet_index: 0, new_text: 'NEW0', star_label: 'A', reason: 'r0' },
      { bullet_index: 1, new_text: 'NEW1', star_label: 'A', reason: 'r1' },
    ]);
    const app = await setup();
    const g = await app.post('/api/coach/generate/1/1');
    const runId = g.body.data.id;
    await app.put(`/api/coach/${runId}/decide`).send({ bullet_index: 0, status: 'accepted' });
    await app.put(`/api/coach/${runId}/decide`).send({ bullet_index: 1, status: 'rejected' });
    await app.put('/api/jds/1/chosen').send({ item_ids: [1] });
    const resume = await app.get('/api/jds/1/resume');
    expect(resume.body.data.items[0].bullets[0]).toBe('NEW0');
    expect(resume.body.data.items[0].bullets[1]).toBe('性能优化');
  });

  it('回填母版：写回条目并新建 from_backfill 版本', async () => {
    coachMock([{ bullet_index: 0, new_text: 'BACKFILLED', star_label: 'A', reason: 'r' }]);
    const app = await setup();
    const g = await app.post('/api/coach/generate/1/1');
    const runId = g.body.data.id;
    await app.put(`/api/coach/${runId}/decide`).send({ bullet_index: 0, status: 'accepted' });
    const b = await app.post(`/api/coach/${runId}/backfill`);
    expect(b.body.ok).toBe(true);
    const items = await app.get('/api/profile/items');
    expect(items.body.data[0].bullets[0]).toBe('BACKFILLED');
    const versions = await app.get('/api/profile/items/1/versions');
    expect(versions.body.data[0].trigger).toBe('from_backfill');
  });

  it('沉淀为素材', async () => {
    coachMock([{ bullet_index: 0, new_text: 'MATERIAL-TEXT', star_label: 'R', reason: 'r' }]);
    const app = await setup();
    const g = await app.post('/api/coach/generate/1/1');
    const runId = g.body.data.id;
    await app.put(`/api/coach/${runId}/decide`).send({ bullet_index: 0, status: 'accepted' });
    const m = await app.post(`/api/coach/${runId}/material`);
    expect(m.body.ok).toBe(true);
    const mats = await app.get('/api/materials');
    expect(mats.body.data[0].content).toBe('MATERIAL-TEXT');
    expect(mats.body.data[0].source).toBe('from_coach');
  });

  it('未采纳任何建议时回填 400', async () => {
    coachMock([{ bullet_index: 0, new_text: 'X', star_label: 'A', reason: 'r' }]);
    const app = await setup();
    const g = await app.post('/api/coach/generate/1/1');
    const b = await app.post(`/api/coach/${g.body.data.id}/backfill`);
    expect(b.status).toBe(400);
    expect(b.body.error).toContain('采纳');
  });
});