import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() {
  const db = await Database.open(null);
  migrate(db);
  return request(buildApp(db));
}

describe('AI 协议设置', () => {
  it('默认 openai，可切换 anthropic 并持久化', async () => {
    const a = await api();
    const d = await a.get('/api/settings');
    expect(d.body.data.ai.protocol).toBe('openai');

    await a.put('/api/settings').send({ ai: { protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5', apiKey: 'sk-ant-x' } });
    const r = await a.get('/api/settings');
    expect(r.body.data.ai.protocol).toBe('anthropic');
    expect(r.body.data.ai.baseUrl).toBe('https://api.anthropic.com');
    expect(r.body.data.ai.model).toBe('claude-sonnet-4-5');
    expect(JSON.stringify(r.body.data.ai)).not.toContain('sk-ant-x');
  });

  it('非法协议被忽略（保持原值）', async () => {
    const a = await api();
    await a.put('/api/settings').send({ ai: { protocol: 'unknown' } });
    const r = await a.get('/api/settings');
    expect(r.body.data.ai.protocol).toBe('openai');
  });
});