import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() {
  const db = await Database.open(null);
  migrate(db);
  return request(buildApp(db));
}

describe('Word导出', () => {
  it('返回 docx 二进制且非空', async () => {
    const app = await api();
    await app.post('/api/profile/items').send({ section: 'work', heading: 'A公司-后端', period: '2022-2025', bullets: ['做了 X，提升 30%'] });
    await app.post('/api/jds').send({ company: 'C', title: '后端', raw_text: 'u'.repeat(40) });
    await app.put('/api/jds/1/chosen').send({ item_ids: [1] });
    const r = await app.get('/api/export/docx/1')
      .buffer(true)
      .parse((res, cb) => { const d: Buffer[] = []; res.on('data', (c) => d.push(c as Buffer)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(r.status).toBe(200);
    expect(String(r.headers['content-type'])).toContain('officedocument.wordprocessingml');
    const body = r.body as Buffer;
    expect(body.length).toBeGreaterThan(1000);
    expect(body.subarray(0, 2).toString()).toBe('PK');
  });
  it('JD 不存在 404', async () => {
    const r = await (await api()).get('/api/export/docx/99');
    expect(r.status).toBe(404);
  });
});