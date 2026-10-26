import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { migrate, setSetting } from '../db';
import { getAIConfig, chat, chatJson, AIError } from './client';

function freshDb(): DatabaseSync { const db = new DatabaseSync(':memory:'); migrate(db); return db; }

function mockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i, responses.length - 1)]; i++;
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

const okBody = (content: string) => ({ status: 200, body: { choices: [{ message: { content } }] } });

describe('getAIConfig', () => {
  it('默认值 + 库内覆盖', () => {
    const db = freshDb();
    expect(getAIConfig(db).baseUrl).toBe('https://api.deepseek.com');
    setSetting(db, 'ai.model', 'deepseek-reasoner');
    expect(getAIConfig(db).model).toBe('deepseek-reasoner');
  });
});

describe('chat', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('正常返回 content 且带 Bearer 头', async () => {
    const calls = mockFetch([okBody('你好')]);
    const out = await chat({ baseUrl: 'https://x.test', apiKey: 'sk-1', model: 'm', temperature: 0.7 }, [{ role: 'user', content: 'hi' }]);
    expect(out).toBe('你好');
    expect(calls[0].url).toBe('https://x.test/chat/completions');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-1');
  });
  it('401 中文错误', async () => {
    mockFetch([{ status: 401, body: {} }]);
    const cfg = { baseUrl: 'https://x.test', apiKey: 'k', model: 'm', temperature: 0.7 };
    const err = await chat(cfg, []).then(() => null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AIError);
    expect((err as Error).message).toContain('API Key 无效或已过期');
  });
  it('网络错误中文提示', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(chat({ baseUrl: 'https://x.test', apiKey: 'k', model: 'm', temperature: 0.7 }, [])).rejects.toThrow('无法连接 AI 服务，请检查联网状态与 Base URL');
  });
});

describe('chatJson', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('解析带围栏的 JSON', async () => {
    mockFetch([okBody('```json\n{"bullets":["a","b"]}\n```')]);
    const r = await chatJson({ baseUrl: 'u', apiKey: 'k', model: 'm', temperature: 0.7 }, []);
    expect(r).toEqual({ bullets: ['a', 'b'] });
  });
  it('首次坏 JSON 自动重问一次', async () => {
    const calls = mockFetch([{ status: 200, body: { choices: [{ message: { content: '不是JSON' } }] } }, okBody('{"ok":true}')]);
    const r = await chatJson({ baseUrl: 'u', apiKey: 'k', model: 'm', temperature: 0.7 }, [{ role: 'user', content: 'q' }]);
    expect(r).toEqual({ ok: true });
    expect(calls.length).toBe(2);
    expect(String(calls[1].init.body)).toContain('不是JSON');
  });
  it('两次都坏则中文报错', async () => {
    mockFetch([{ status: 200, body: { choices: [{ message: { content: '坏1' } }] } }, { status: 200, body: { choices: [{ message: { content: '坏2' } }] } }]);
    await expect(chatJson({ baseUrl: 'u', apiKey: 'k', model: 'm', temperature: 0.7 }, [])).rejects.toThrow('模型输出格式异常，请重试或更换模型');
  });
});
