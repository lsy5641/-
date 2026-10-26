import { Router } from 'express';
import { ok, fail } from '../http';
import { Database } from '../db';
import { getAIConfig, chatJson } from '../ai/client';

export function aiRouter(db: Database): Router {
  const r = Router();

  r.post('/bullets', async (req, res) => {
    const text = String(req.body?.text ?? '').trim();
    if (text.length < 10) return fail(res, 400, '请粘贴至少 10 个字的流水账');
    try {
      const cfg = getAIConfig(db);
      const out = await chatJson(cfg, [
        { role: 'system', content: '你是简历教练。把用户的工作流水账拆成 3~8 条 STAR 风格的简历亮点 bullet：动词开头、有方法、尽量量化结果。只输出 JSON：{"bullets":["..."]}' },
        { role: 'user', content: text },
      ]);
      const bullets = Array.isArray(out?.bullets) ? out.bullets.filter((b: unknown) => typeof b === 'string') : [];
      if (!bullets.length) return fail(res, 502, '模型未返回有效亮点，请重试');
      ok(res, { bullets: bullets.slice(0, 8) });
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  return r;
}
