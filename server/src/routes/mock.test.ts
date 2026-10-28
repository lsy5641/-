import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { Database, migrate, setSetting, nowIso } from '../db';
import { buildApp } from '../app';

async function apiWithKey() {
  const db = await Database.open(null);
  migrate(db);
  setSetting(db, 'ai.apiKey', 'sk-test');
  await db.prepare('INSERT INTO jds (company, title, raw_text, created_at, updated_at) VALUES (?,?,?,?,?)').run('C', '后端', 'x'.repeat(40), nowIso(), nowIso());
  await db.prepare('INSERT INTO questions (jd_id, category, question, hint, based_on, created_at, updated_at) VALUES (1,?,?,?,?,?,?)')
    .run('behavioral', '讲一次你主导的跨团队项目', '用 STAR，突出你的推动动作', '', nowIso(), nowIso());
  return { db, app: request(buildApp(db)) };
}

function mockReply(text: string) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    calls.push(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
  }));
  return calls;
}

describe('模拟追问', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('GET 返回题目与空历史', async () => {
    const { app } = await apiWithKey();
    const r = await app.get('/api/mock/1');
    expect(r.body.data.question.question).toContain('跨团队');
    expect(r.body.data.messages).toEqual([]);
  });

  it('回复落库并把历史带入下一轮', async () => {
    const calls = mockReply('这个例子不错，但结果能量化吗？');
    const { app } = await apiWithKey();
    const r1 = await app.post('/api/mock/1/reply').send({ message: '我推动三个团队完成了迁移' });
    expect(r1.body.data.messages).toHaveLength(2);
    expect(r1.body.data.messages[0]).toEqual({ role: 'candidate', content: '我推动三个团队完成了迁移' });
    expect(r1.body.data.messages[1].role).toBe('interviewer');

    mockReply('好，那复盘时你最大的教训是什么？');
    const r2 = await app.post('/api/mock/1/reply').send({ message: '提前对齐目标' });
    expect(r2.body.data.messages).toHaveLength(4);
    const secondBody = calls[calls.length - 1];
    expect(secondBody).toContain('我推动三个团队完成了迁移');
  });

  it('空消息 400，题目不存在 404', async () => {
    const { app } = await apiWithKey();
    expect((await app.post('/api/mock/1/reply').send({ message: '  ' })).status).toBe(400);
    expect((await app.post('/api/mock/99/reply').send({ message: 'x' })).status).toBe(404);
  });

  it('重置清空历史', async () => {
    mockReply('继续');
    const { app } = await apiWithKey();
    await app.post('/api/mock/1/reply').send({ message: '答一段' });
    const r = await app.post('/api/mock/1/reset');
    expect(r.body.data.messages).toEqual([]);
    const g = await app.get('/api/mock/1');
    expect(g.body.data.messages).toEqual([]);
  });

  it('未配 key 时 502 中文', async () => {
    const db = await Database.open(null);
    migrate(db);
    await db.prepare('INSERT INTO questions (jd_id, category, question, hint, based_on, created_at, updated_at) VALUES (1,?,?,?,?,?,?)')
      .run('tech', '题', '', '', nowIso(), nowIso());
    const r = await request(buildApp(db)).post('/api/mock/1/reply').send({ message: '回答' });
    expect(r.status).toBe(502);
    expect(r.body.error).toContain('API Key');
  });
});