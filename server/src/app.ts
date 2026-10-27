import express, { Express, Request, Response } from 'express';
import { fail } from './http';
import { Database } from './db';
import { profileRouter } from './routes/profile';
import { settingsRouter } from './routes/settings';
import { materialsRouter } from './routes/materials';
import { aiRouter } from './routes/ai';
import { jdsRouter } from './routes/jds';
import { keywordsRouter } from './routes/keywords';
import { coachRouter } from './routes/coach';

export function buildApp(db: Database): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true, data: { time: new Date().toISOString() } }));
  app.use('/api/profile', profileRouter(db));
  app.use('/api/settings', settingsRouter(db));
  app.use('/api/materials', materialsRouter(db));
  app.use('/api/ai', aiRouter(db));
  app.use('/api/jds', jdsRouter(db));
  app.use('/api/keywords', keywordsRouter(db));
  app.use('/api/coach', coachRouter(db));
  app.use('/api', (_req: Request, res: Response) => fail(res, 404, '接口不存在'));
  return app;
}
