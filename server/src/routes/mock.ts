import { Router } from 'express';
import { Database } from '../db';
import { ok, fail } from '../http';
import { nowIso } from '../db';
import { getAIConfig, chat, ChatMsg } from '../ai/client';

interface QRow { id: number; jd_id: number; category: string; question: string; hint: string }
interface ChatRow { id: number; question_id: number; messages: string; created_at: string; updated_at: string }
interface Msg { role: 'interviewer' | 'candidate'; content: string }

function loadQuestion(db: Database, id: number): QRow | undefined {
  return db.prepare('SELECT * FROM questions WHERE id=?').get(id) as QRow | undefined;
}

function loadChat(db: Database, questionId: number): ChatRow | undefined {
  return db.prepare('SELECT * FROM mock_chats WHERE question_id=? ORDER BY id DESC LIMIT 1').get(questionId) as ChatRow | undefined;
}

function messagesOf(row: ChatRow | undefined): Msg[] {
  return row ? (JSON.parse(row.messages) as Msg[]) : [];
}

function saveChat(db: Database, questionId: number, msgs: Msg[]): void {
  const t = nowIso();
  const exist = loadChat(db, questionId);
  if (exist) db.prepare('UPDATE mock_chats SET messages=?, updated_at=? WHERE id=?').run(JSON.stringify(msgs), t, exist.id);
  else db.prepare('INSERT INTO mock_chats (question_id, messages, created_at, updated_at) VALUES (?,?,?,?)').run(questionId, JSON.stringify(msgs), t, t);
}

export function mockRouter(db: Database): Router {
  const r = Router();

  r.get('/:questionId', (req, res) => {
    const q = loadQuestion(db, Number(req.params.questionId));
    if (!q) return fail(res, 404, '题目不存在');
    ok(res, { question: { id: q.id, question: q.question, hint: q.hint, category: q.category }, messages: messagesOf(loadChat(db, q.id)) });
  });

  r.post('/:questionId/reply', async (req, res) => {
    const q = loadQuestion(db, Number(req.params.questionId));
    if (!q) return fail(res, 404, '题目不存在');
    const message = String(req.body?.message ?? '').trim();
    if (!message) return fail(res, 400, '请先输入你的回答');
    if (message.length > 2000) return fail(res, 400, '回答太长（限 2000 字）');
    try {
      const cfg = getAIConfig(db);
      const history = messagesOf(loadChat(db, q.id));
      const msgs: ChatMsg[] = [
        { role: 'system', content: `你是资深面试官，正在面试候选人。本场面试题：「${q.question}」。参考提示：${q.hint || '无'}。规则：1) 每次只问一个问题；2) 候选人回答后先用一句话点评（亮点或不足），再追问或换角度深入；3) 若回答太空泛，引导他用 STAR（情境/任务/行动/结果）讲具体案例；4) 语气专业、友好；5) 直接说话，不要输出 JSON。` },
        ...history.map((m) => ({ role: (m.role === 'interviewer' ? 'assistant' : 'user') as 'assistant' | 'user', content: m.content })),
        { role: 'user', content: message },
      ];
      const reply = await chat(cfg, msgs);
      const next: Msg[] = [...history, { role: 'candidate', content: message }, { role: 'interviewer', content: reply.slice(0, 2000) }];
      saveChat(db, q.id, next);
      ok(res, { messages: next });
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  r.post('/:questionId/reset', (req, res) => {
    const q = loadQuestion(db, Number(req.params.questionId));
    if (!q) return fail(res, 404, '题目不存在');
    saveChat(db, q.id, []);
    ok(res, { messages: [] });
  });

  return r;
}