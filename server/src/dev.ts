import path from 'node:path';
import fs from 'node:fs';
import { openDb } from './db';
import { buildApp } from './app';

function backupData(): void {
  const src = path.resolve('data/jobcoach.db');
  if (!fs.existsSync(src)) return;
  const dir = path.resolve('data/backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.copyFileSync(src, path.join(dir, `jobcoach-${stamp}.db`));
  const all = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
  for (const old of all.slice(0, Math.max(0, all.length - 20))) fs.rmSync(path.join(dir, old));
}

async function main() {
  backupData();
  const db = await openDb();
  const app = buildApp(db);
  app.listen(3001, '127.0.0.1', () => console.log('[JobCoach] 后端已启动: http://127.0.0.1:3001'));

  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.resolve('vite.config.mts'),
    server: { port: 5173, strictPort: true },
  });
  await vite.listen();
  console.log('[JobCoach] 前端已启动: http://127.0.0.1:5173  ← 请把这个地址输入浏览器');
  console.log('[JobCoach] 使用期间请勿关闭本窗口；停止请按 Ctrl+C');
}

main().catch((e) => { console.error('启动失败:', e); process.exit(1); });
