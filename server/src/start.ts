import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import { openDb } from './db';
import { buildApp } from './app';

export interface StartOptions {
  port: number;
  dataDir: string;
  staticDir?: string;
}

export async function startServer(opts: StartOptions): Promise<{ server: Server; port: number }> {
  fs.mkdirSync(opts.dataDir, { recursive: true });
  const db = await openDb(path.join(opts.dataDir, 'jobcoach.db'));
  const app = buildApp(db);

  if (opts.staticDir && fs.existsSync(path.join(opts.staticDir, 'index.html'))) {
    app.use(express.static(opts.staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.staticDir as string, 'index.html')));
  }

  return await new Promise((resolve, reject) => {
    const server = app.listen(opts.port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === 'object' && addr ? addr.port : opts.port });
    });
    server.on('error', reject);
  });
}