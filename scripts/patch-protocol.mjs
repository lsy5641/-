import fs from 'node:fs';

const sp = 'server/src/routes/settings.ts';
let s = fs.readFileSync(sp, 'utf8');
s = s.replace(
  'ok(res, { ai: { baseUrl: cfg.baseUrl, model: cfg.model, temperature: cfg.temperature, hasKey: !!cfg.apiKey, keyMask } });',
  'ok(res, { ai: { protocol: cfg.protocol, baseUrl: cfg.baseUrl, model: cfg.model, temperature: cfg.temperature, hasKey: !!cfg.apiKey, keyMask } });'
);
s = s.replace(
  "if (ai.baseUrl !== undefined && ai.baseUrl !== '') setSetting(db, 'ai.baseUrl', String(ai.baseUrl).trim());",
  "if (ai.protocol === 'openai' || ai.protocol === 'anthropic') setSetting(db, 'ai.protocol', ai.protocol);\n    if (ai.baseUrl !== undefined && ai.baseUrl !== '') setSetting(db, 'ai.baseUrl', String(ai.baseUrl).trim());"
);
fs.writeFileSync(sp, s);

const cp = 'server/src/ai/client.test.ts';
let c = fs.readFileSync(cp, 'utf8');
c = c.split('temperature: 0.7 }').join("temperature: 0.7, protocol: 'openai' as const }");
fs.writeFileSync(cp, c);

console.log('patched');