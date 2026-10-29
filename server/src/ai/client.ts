import { Database } from '../db';
import { getSetting } from '../db';

export type AIProtocol = 'openai' | 'anthropic';

export interface AIConfig {
  protocol: AIProtocol;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export class AIError extends Error {}

export function getAIConfig(db: Database): AIConfig {
  const protocol = getSetting(db, 'ai.protocol', 'openai') === 'anthropic' ? 'anthropic' : 'openai';
  return {
    protocol,
    baseUrl: getSetting(db, 'ai.baseUrl', 'https://api.deepseek.com'),
    apiKey: getSetting(db, 'ai.apiKey', ''),
    model: getSetting(db, 'ai.model', 'deepseek-chat'),
    temperature: Number(getSetting(db, 'ai.temperature', '0.7')),
  };
}

function openaiUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '') + '/chat/completions';
}

function anthropicUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return (base.endsWith('/v1') ? base : base + '/v1') + '/messages';
}

function mapHttpError(status: number): AIError {
  if (status === 401 || status === 403) return new AIError('API Key 无效或已过期（HTTP ' + status + '）');
  if (status === 429) return new AIError('触发限流或余额不足，稍后再试（HTTP 429）');
  return new AIError('AI 服务返回错误 HTTP ' + status);
}

async function chatOpenAI(cfg: AIConfig, messages: ChatMsg[]): Promise<string> {
  const res = await fetch(openaiUrl(cfg.baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, temperature: cfg.temperature, messages, stream: false }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw mapHttpError(res.status);
  const j = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AIError('AI 返回结构异常');
  return content;
}

async function chatAnthropic(cfg: AIConfig, messages: ChatMsg[]): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  const res = await fetch(anthropicUrl(cfg.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      temperature: cfg.temperature,
      ...(system ? { system } : {}),
      messages: rest,
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw mapHttpError(res.status);
  const j = await res.json() as { content?: { type?: string; text?: string }[] };
  const text = (j.content ?? []).filter((c) => c.type === 'text' || typeof c.text === 'string').map((c) => c.text ?? '').join('');
  if (!text) throw new AIError('AI 返回结构异常');
  return text;
}

export async function chat(cfg: AIConfig, messages: ChatMsg[]): Promise<string> {
  if (!cfg.apiKey) throw new AIError('尚未配置 API Key：点右上角齿轮⚙ 填入');
  try {
    return cfg.protocol === 'anthropic' ? await chatAnthropic(cfg, messages) : await chatOpenAI(cfg, messages);
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError('无法连接 AI 服务，请检查联网状态与 Base URL');
  }
}

export function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  const c = t.indexOf('['), d = t.lastIndexOf(']');
  if (a >= 0 && (c < 0 || a < c)) t = t.slice(a, b + 1); else if (c >= 0) t = t.slice(c, d + 1);
  return JSON.parse(t);
}

export async function chatJson(cfg: AIConfig, messages: ChatMsg[]): Promise<any> {
  const first = await chat(cfg, messages);
  try { return parseJsonLoose(first); } catch { /* 带错重问一次 */ }
  const retry = await chat(cfg, [...messages,
    { role: 'assistant', content: first.slice(0, 2000) },
    { role: 'user', content: '你上一条输出不是合法 JSON，解析失败。请只重新输出修正后的 JSON，不要任何解释文字。' }]);
  try { return parseJsonLoose(retry); } catch { throw new AIError('模型输出格式异常，请重试或更换模型'); }
}