import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Database, migrate } from '../db';
import { buildApp } from '../app';

async function api() {
  const db = await Database.open(null);
  migrate(db);
  return request(buildApp(db));
}

describe('履历API', () => {
  it('创建后自动拥有1个版本，bullets 回传为数组', async () => {
    const a = await api();
    const r = await a.post('/api/profile/items').send({ section: 'work', heading: 'A公司', period: '2022-2025', bullets: ['x'] });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.data).toMatchObject({ section: 'work', heading: 'A公司', period: '2022-2025', bullets: ['x'] });
    const v = await a.get('/api/profile/items/1/versions');
    expect(v.body.data).toHaveLength(1);
    expect(v.body.data[0].trigger).toBe('create');
  });

  it('更新产生新版本（trigger=manual）', async () => {
    const a = await api();
    await a.post('/api/profile/items').send({ section: 'work', heading: 'A', bullets: ['x'] });
    await a.put('/api/profile/items/1').send({ heading: 'A', period: '', bullets: ['x', 'y'] });
    const v = await a.get('/api/profile/items/1/versions');
    expect(v.body.data).toHaveLength(2);
    expect(v.body.data[0].trigger).toBe('manual');
    expect(v.body.data[0].snapshot.bullets).toEqual(['x', 'y']);
  });

  it('恢复旧版本写回内容并新增 restore 版本', async () => {
    const a = await api();
    await a.post('/api/profile/items').send({ section: 'work', heading: '原始', bullets: ['x'] });
    await a.put('/api/profile/items/1').send({ heading: '改坏了', bullets: ['x', 'y'] });
    const vs = await a.get('/api/profile/items/1/versions');
    const oldest = vs.body.data[vs.body.data.length - 1];
    const r = await a.post('/api/profile/items/1/restore').send({ version_id: oldest.id });
    expect(r.body.ok).toBe(true);
    const list = await a.get('/api/profile/items');
    expect(list.body.data[0].heading).toBe('原始');
    expect(list.body.data[0].bullets).toEqual(['x']);
    const vs2 = await a.get('/api/profile/items/1/versions');
    expect(vs2.body.data[0].trigger).toBe('restore');
  });

  it('非法 section 与 bullets 返回 400', async () => {
    const a = await api();
    expect((await a.post('/api/profile/items').send({ section: 'xxx' })).status).toBe(400);
    expect((await a.post('/api/profile/items').send({ section: 'work', bullets: [1] })).status).toBe(400);
  });

  it('更新不存在的条目返回 404', async () => {
    const r = await (await api()).put('/api/profile/items/99').send({ heading: 'x', bullets: [] });
    expect(r.status).toBe(404);
  });

  it('删除条目同时清其版本', async () => {
    const a = await api();
    await a.post('/api/profile/items').send({ section: 'work', heading: 'A', bullets: [] });
    await a.delete('/api/profile/items/1');
    const v = await a.get('/api/profile/items/1/versions');
    expect(v.body.data).toHaveLength(0);
    const list = await a.get('/api/profile/items');
    expect(list.body.data).toHaveLength(0);
  });

  it('restore 不属于自己的版本 id 返回 404', async () => {
    const a = await api();
    await a.post('/api/profile/items').send({ section: 'work', heading: 'A', bullets: [] });
    await a.post('/api/profile/items').send({ section: 'work', heading: 'B', bullets: [] });
    const vs = await a.get('/api/profile/items/2/versions');
    const r = await a.post('/api/profile/items/1/restore').send({ version_id: vs.body.data[0].id });
    expect(r.status).toBe(404);
  });
});
