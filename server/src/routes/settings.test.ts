import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from '../db';
import { buildApp } from '../app';

function api() { const db = new DatabaseSync(':memory:'); migrate(db); return request(buildApp(db)); }

describe('设置API', () => {
  it('GET 返回默认值且不含明文key', async () => {
    const r = await api().get('/api/settings');
    expect(r.body.data.ai).toMatchObject({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', hasKey: false });
    expect(JSON.stringify(r.body.data.ai)).not.toContain('sk-');
  });
  it('PUT 保存并掩码回显', async () => {
    const a = api();
    await a.put('/api/settings').send({ ai: { baseUrl: 'https://api.deepseek.com', apiKey: 'sk-abcdef123456', model: 'deepseek-chat', temperature: 0.5 } });
    const r = await a.get('/api/settings');
    expect(r.body.data.ai.hasKey).toBe(true);
    expect(r.body.data.ai.keyMask).toBe('sk-a…3456');
    expect(JSON.stringify(r.body.data.ai)).not.toContain('sk-abcdef123456');
  });
  it('PUT apiKey 为空串时不覆盖旧 key', async () => {
    const a = api();
    await a.put('/api/settings').send({ ai: { apiKey: 'sk-old-key-1111', model: 'm' } });
    await a.put('/api/settings').send({ ai: { apiKey: '', model: 'm2' } });
    const r = await a.get('/api/settings');
    expect(r.body.data.ai.hasKey).toBe(true);
    expect(r.body.data.ai.keyMask).toBe('sk-o…1111');
  });
});
