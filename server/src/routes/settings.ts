import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { setSetting } from '../db';
import { getAIConfig, chat } from '../ai/client';

export function settingsRouter(db: Database): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    const cfg = getAIConfig(db);
    const keyMask = cfg.apiKey ? cfg.apiKey.slice(0, 4) + '…' + cfg.apiKey.slice(-4) : '';
    ok(res, { ai: { protocol: cfg.protocol, baseUrl: cfg.baseUrl, model: cfg.model, temperature: cfg.temperature, hasKey: !!cfg.apiKey, keyMask } });
  });

  r.put('/', (req, res) => {
    const ai = req.body?.ai ?? {};
    if (ai.protocol === 'openai' || ai.protocol === 'anthropic') setSetting(db, 'ai.protocol', ai.protocol);
    if (ai.baseUrl !== undefined && ai.baseUrl !== '') setSetting(db, 'ai.baseUrl', String(ai.baseUrl).trim());
    if (ai.model !== undefined && ai.model !== '') setSetting(db, 'ai.model', String(ai.model).trim());
    if (ai.temperature !== undefined) setSetting(db, 'ai.temperature', String(ai.temperature));
    if (ai.apiKey !== undefined && ai.apiKey !== '') setSetting(db, 'ai.apiKey', String(ai.apiKey).trim());
    ok(res, { saved: true });
  });

  r.post('/test', async (_req, res) => {
    try {
      const cfg = getAIConfig(db);
      const out = await chat(cfg, [{ role: 'user', content: '请只回复两个字：正常' }]);
      ok(res, { reply: out.slice(0, 50) });
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  return r;
}
