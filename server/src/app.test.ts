import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { migrate } from './db';
import { buildApp } from './app';

function api() {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  return request(buildApp(db));
}

describe('基础设施', () => {
  it('GET /api/health 返回 ok', async () => {
    const r = await api().get('/api/health');
    expect(r.body).toEqual({ ok: true, data: { time: expect.any(String) } });
  });
  it('未知 /api 路径中文 404', async () => {
    const r = await api().get('/api/nope');
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('接口不存在');
  });
});
