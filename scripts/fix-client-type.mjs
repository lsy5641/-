import fs from 'node:fs';

const p = 'server/src/ai/client.ts';
let t = fs.readFileSync(p, 'utf8');
t = t.replace("import { DatabaseSync } from 'node:sqlite';", "import { Database } from '../db';");
t = t.split('DatabaseSync').join('Database');
fs.writeFileSync(p, t);
console.log('client type fixed');