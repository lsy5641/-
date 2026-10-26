import express, { Express, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { fail } from './http';
import { profileRouter } from './routes/profile';
import { settingsRouter } from './routes/settings';
import { materialsRouter } from './routes/materials';
import { aiRouter } from './routes/ai';

export function buildApp(db: DatabaseSync): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true, data: { time: new Date().toISOString() } }));
  app.use('/api/profile', profileRouter(db));
  app.use('/api/settings', settingsRouter(db));
  app.use('/api/materials', materialsRouter(db));
  app.use('/api/ai', aiRouter(db));
  app.use('/api', (_req: Request, res: Response) => fail(res, 404, '接口不存在'));
  return app;
}
