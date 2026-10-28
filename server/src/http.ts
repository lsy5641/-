import { Response } from 'express';

export function ok(res: Response, data: unknown): void {
  res.json({ ok: true, data });
}

export function fail(res: Response, status: number, error: string): void {
  res.status(status).json({ ok: false, error });
}
