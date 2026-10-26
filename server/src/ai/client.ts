import { DatabaseSync } from 'node:sqlite';
import { getSetting } from '../db';

export interface AIConfig { baseUrl: string; apiKey: string; model: string; temperature: number }
export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export class AIError extends Error {}

export function getAIConfig(db: DatabaseSync): AIConfig {
  return {
    baseUrl: getSetting(db, 'ai.baseUrl', 'https://api.deepseek.com'),
    apiKey: getSetting(db, 'ai.apiKey', ''),
    model: getSetting(db, 'ai.model', 'deepseek-chat'),
    temperature: Number(getSetting(db, 'ai.temperature', '0.7')),
  };
}

export async function chat(cfg: AIConfig, messages: ChatMsg[]): Promise<string> {
  if (!cfg.apiKey) throw new AIError('尚未配置 API Key：点右上角齿轮⚙ 填入');
  let res: Response;
  try {
    res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, temperature: cfg.temperature, messages, stream: false }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new AIError('无法连接 AI 服务，请检查联网状态与 Base URL');
  }
  if (res.status === 401 || res.status === 403) throw new AIError('API Key 无效或已过期（HTTP ' + res.status + '）');
  if (res.status === 429) throw new AIError('触发限流或余额不足，稍后再试（HTTP 429）');
  if (!res.ok) throw new AIError('AI 服务返回错误 HTTP ' + res.status);
  const j = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AIError('AI 返回结构异常');
  return content;
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
