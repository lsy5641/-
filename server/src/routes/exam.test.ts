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

const PACK = {
  weeks: [
    { week: 1, focus: '补齐高并发基础', tasks: ['复习 Java 并发包', '补写高并发项目经历', '刷 5 道并发题'] },
    { week: 2, focus: '项目深挖', tasks: ['把交易系统项目补成 STAR', '准备 3 个故障排查故事'] },
  ],
  questions: [
    { category: 'project_deep', question: '讲讲你最有挑战的项目', hint: '用 STAR，突出规模与结果' },
    { category: 'tech', question: '如何排查接口 P99 抖动？', hint: '监控→链路→GC→慢SQL' },
    { category: 'behavioral', question: '讲一次和同事冲突的处理', hint: 'STAR + 反思' },
    { category: 'hr', question: '为什么离职？', hint: '聚焦成长，不抱怨' },
    { category: 'tech', question: 'Redis 缓存穿透怎么解决？', hint: '布隆过滤器/空值缓存' },
  ],
};

function mockPack() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(PACK) } }] }), { status: 200 })));
}

describe('备考中心', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('生成备考包：计划落库、题目分类完整', async () => {
    mockPack();
    const app = await apiWithKey();
    await app.post('/api/profile/items').send({ section: 'work', heading: 'A公司', bullets: ['高并发交易系统'] });
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'q'.repeat(40) });
    await app.put('/api/jds/1/chosen').send({ item_ids: [1] });
    const r = await app.post('/api/exam/generate/1');
    expect(r.body.ok).toBe(true);
    expect(r.body.data.plan.weeks).toHaveLength(2);
    expect(r.body.data.plan.weeks[0].tasks[0]).toEqual({ text: '复习 Java 并发包', done: false });
    expect(r.body.data.questions).toHaveLength(5);
    expect(r.body.data.questions[0].category).toBe('project_deep');
  });

  it('勾选任务 → done 翻转并持久', async () => {
    mockPack();
    const app = await apiWithKey();
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'r'.repeat(40) });
    await app.post('/api/exam/generate/1');
    const t = await app.put('/api/exam/1/plan/toggle').send({ week: 1, task_index: 0 });
    expect(t.body.data.weeks[0].tasks[0].done).toBe(true);
    const g = await app.get('/api/exam/1/plan');
    expect(g.body.data.weeks[0].tasks[0].done).toBe(true);
  });

  it('Markdown 导出包含计划与题目', async () => {
    mockPack();
    const app = await apiWithKey();
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 's'.repeat(40) });
    await app.post('/api/exam/generate/1');
    const r = await app.get('/api/exam/1/export.md');
    expect(r.status).toBe(200);
    expect(String(r.headers['content-type'])).toContain('text/markdown');
    expect(r.text).toContain('# 备考包');
    expect(r.text).toContain('第 1 周');
    expect(r.text).toContain('讲讲你最有挑战的项目');
  });

  it('未生成时导出 404 中文', async () => {
    const app = await apiWithKey();
    await app.post('/api/jds').send({ company: 'C', title: 'b', raw_text: 't'.repeat(40) });
    const r = await app.get('/api/exam/1/export.md');
    expect(r.status).toBe(404);
    expect(r.body.error).toContain('备考包');
  });
});