import { describe, it, expect, vi, afterEach } from 'vitest';
import { chat } from './client';

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

const anthropicOk = (text: string) => ({ status: 200, body: { content: [{ type: 'text', text }] } });

describe('anthropic 协议适配', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('走 /v1/messages 并携带 x-api-key / system', async () => {
    const calls = mockFetch([anthropicOk('你好')]);
    const out = await chat(
      { protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-1', model: 'claude-sonnet-4-5', temperature: 0.7 },
      [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'hi' }],
    );
    expect(out).toBe('你好');
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-1');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.system).toBe('SYS');
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('baseUrl 已含 /v1 时不重复拼接', async () => {
    const calls = mockFetch([anthropicOk('ok')]);
    await chat(
      { protocol: 'anthropic', baseUrl: 'https://gw.example.com/v1', apiKey: 'k', model: 'm', temperature: 0.7 },
      [{ role: 'user', content: 'x' }],
    );
    expect(calls[0].url).toBe('https://gw.example.com/v1/messages');
  });

  it('anthropic 401 中文报错', async () => {
    mockFetch([{ status: 401, body: {} }]);
    await expect(chat(
      { protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'bad', model: 'm', temperature: 0.7 },
      [{ role: 'user', content: 'x' }],
    )).rejects.toThrow('API Key 无效或已过期');
  });
});