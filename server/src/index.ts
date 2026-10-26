import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { openDb } from './db';
import { buildApp } from './app';

const db = openDb();
const app = buildApp(db);

if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve('dist/web');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(3001, () => console.log('JobCoach 后端已启动: http://localhost:3001'));
