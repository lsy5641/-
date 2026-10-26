import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { migrate, setSetting } from '../db';
import { buildApp } from '../app';

function apiWithKey() {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  setSetting(db, 'ai.apiKey', 'sk-test');
  return request(buildApp(db));
}

describe('AI拆亮点', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('返回 bullets 数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"bullets":["主导X模块重构，P99延迟从800ms降至120ms"]}' } }] }), { status: 200 })));
    const r = await apiWithKey().post('/api/ai/bullets').send({ text: '我做了重构，快了很多' });
    expect(r.body.ok).toBe(true);
    expect(r.body.data.bullets).toEqual(['主导X模块重构，P99延迟从800ms降至120ms']);
  });
  it('未配 key 时中文提示', async () => {
    const db = new DatabaseSync(':memory:'); migrate(db);
    const r = await request(buildApp(db)).post('/api/ai/bullets').send({ text: 'x'.repeat(20) });
    expect(r.status).toBe(502);
    expect(r.body.error).toContain('API Key');
  });
  it('文本太短 400', async () => {
    expect((await apiWithKey().post('/api/ai/bullets').send({ text: '短' })).status).toBe(400);
  });
});
