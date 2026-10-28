import { Router } from 'express';
import { Database } from '../db';
import { ok, fail } from '../http';
import { nowIso } from '../db';
import { getAIConfig, chatJson } from '../ai/client';

interface PlanRow { id: number; jd_id: number; weeks: string; created_at: string; updated_at: string }
interface QRow { id: number; jd_id: number; category: string; question: string; hint: string; based_on: string }
interface Week { week: number; focus: string; tasks: { text: string; done: boolean }[] }

const CATS = ['project_deep', 'tech', 'behavioral', 'hr'];
const CAT_LABELS: Record<string, string> = { project_deep: '项目深挖', tech: '技术题', behavioral: '行为题(STAR)', hr: 'HR 题' };

function loadPlan(db: Database, jdId: number): PlanRow | undefined {
  return db.prepare('SELECT * FROM plans WHERE jd_id=? ORDER BY id DESC LIMIT 1').get(jdId) as PlanRow | undefined;
}

function planDto(row: PlanRow) { return { id: row.id, jd_id: row.jd_id, weeks: JSON.parse(row.weeks) as Week[] }; }

export function examRouter(db: Database): Router {
  const r = Router();

  r.post('/generate/:jdId', async (req, res) => {
    const jdId = Number(req.params.jdId);
    const jd = db.prepare('SELECT * FROM jds WHERE id=?').get(jdId) as { id: number; company: string; title: string; raw_text: string; summary: string; chosen_items: string; overrides: string } | undefined;
    if (!jd) return fail(res, 404, 'JD 不存在');
    try {
      const cfg = getAIConfig(db);
      const missing = db.prepare("SELECT k.term FROM keyword_hits kh JOIN keywords k ON k.id=kh.keyword_id WHERE kh.jd_id=? AND kh.status='missing'").all(jdId) as unknown as { term: string }[];
      const chosen = JSON.parse(jd.chosen_items) as number[];
      const items = db.prepare('SELECT * FROM profile_items ORDER BY section, sort_order, id').all() as unknown as { id: number; heading: string; bullets: string }[];
      const overrides = JSON.parse(jd.overrides) as Record<string, { bullets: string[] }>;
      const resumeText = items.filter((i) => chosen.includes(i.id))
        .map((i) => `${i.heading}: ${(overrides[String(i.id)]?.bullets ?? JSON.parse(i.bullets)).join('；')}`).join('\n');
      const out = await chatJson(cfg, [
        { role: 'system', content: '你是资深面试教练。根据 JD 与候选人简历生成备考包，只输出 JSON：{"weeks":[{"week":1,"focus":"本周主题","tasks":["具体任务"]}],"questions":[{"category":"project_deep|tech|behavioral|hr","question":"题干","hint":"答题要点提示"}]}。学习计划 2~4 周，每周 3~5 个任务（必须包含"补强缺失词条"与"复习主题"类任务）；面试题至少 15 道，四类都要有，behavioral 题 hint 要提醒用 STAR 讲故事。' },
        { role: 'user', content: `【JD】${jd.company} ${jd.title}\n要点：${jd.summary}\n【缺失词条】${missing.map((m) => m.term).join('、') || '无'}\n【我的简历】\n${resumeText || '（未选择经历）'}` },
      ]);
      const weeks: Week[] = (Array.isArray(out?.weeks) ? out.weeks : []).slice(0, 4).map((w: { week?: number; focus?: string; tasks?: unknown }, i: number) => ({
        week: Number(w.week) || i + 1,
        focus: String(w.focus ?? ''),
        tasks: (Array.isArray(w.tasks) ? w.tasks : []).filter((t: unknown) => typeof t === 'string').slice(0, 6).map((t: string) => ({ text: t, done: false })),
      })).filter((w: Week) => w.tasks.length > 0);
      const qs = (Array.isArray(out?.questions) ? out.questions : [])
        .filter((q: { question?: unknown; category?: unknown }) => typeof q.question === 'string' && CATS.includes(String(q.category)))
        .map((q: { category: string; question: string; hint?: string }) => ({ category: q.category, question: q.question.slice(0, 300), hint: String(q.hint ?? '').slice(0, 400) }));
      if (!weeks.length || qs.length < 5) return fail(res, 502, '模型返回的备考包不完整，请重试');

      const t = nowIso();
      db.prepare('DELETE FROM plans WHERE jd_id=?').run(jdId);
      db.prepare('DELETE FROM questions WHERE jd_id=?').run(jdId);
      const planId = Number(db.prepare('INSERT INTO plans (jd_id, weeks, created_at, updated_at) VALUES (?,?,?,?)').run(jdId, JSON.stringify(weeks), t, t).lastInsertRowid);
      const insQ = db.prepare('INSERT INTO questions (jd_id, category, question, hint, based_on, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
      for (const q of qs) insQ.run(jdId, q.category, q.question, q.hint, '', t, t);
      const questions = db.prepare('SELECT * FROM questions WHERE jd_id=? ORDER BY id').all(jdId);
      ok(res, { plan: { id: planId, jd_id: jdId, weeks }, questions });
    } catch (e) { fail(res, 502, (e as Error).message); }
  });

  r.get('/:jdId/plan', (req, res) => {
    const row = loadPlan(db, Number(req.params.jdId));
    if (!row) return fail(res, 404, '还没有生成备考包');
    ok(res, planDto(row));
  });

  r.put('/:jdId/plan/toggle', (req, res) => {
    const jdId = Number(req.params.jdId);
    const row = loadPlan(db, jdId);
    if (!row) return fail(res, 404, '还没有生成备考包');
    const week = Number(req.body?.week);
    const idx = Number(req.body?.task_index);
    const weeks = JSON.parse(row.weeks) as Week[];
    const w = weeks.find((x) => x.week === week);
    if (!w || !w.tasks[idx]) return fail(res, 404, '任务不存在');
    w.tasks[idx].done = !w.tasks[idx].done;
    db.prepare('UPDATE plans SET weeks=?, updated_at=? WHERE id=?').run(JSON.stringify(weeks), nowIso(), row.id);
    ok(res, planDto({ ...row, weeks: JSON.stringify(weeks) }));
  });

  r.get('/:jdId/questions', (req, res) => {
    const jdId = Number(req.params.jdId);
    const rows = db.prepare('SELECT * FROM questions WHERE jd_id=? ORDER BY id').all(jdId) as unknown as QRow[];
    ok(res, rows);
  });

  r.get('/:jdId/export.md', (req, res) => {
    const jdId = Number(req.params.jdId);
    const jd = db.prepare('SELECT company, title FROM jds WHERE id=?').get(jdId) as { company: string; title: string } | undefined;
    const plan = loadPlan(db, jdId);
    const qs = db.prepare('SELECT * FROM questions WHERE jd_id=? ORDER BY id').all(jdId) as unknown as QRow[];
    if (!jd || !plan) return fail(res, 404, '还没有生成备考包');
    const weeks = JSON.parse(plan.weeks) as Week[];
    const lines: string[] = [
      `# 备考包：${jd.company} ${jd.title}`, '',
      `> 导出时间：${nowIso()}`, '', '## 学习计划', '',
    ];
    for (const w of weeks) {
      lines.push(`### 第 ${w.week} 周 · ${w.focus}`, '');
      for (const t of w.tasks) lines.push(`- [${t.done ? 'x' : ' '}] ${t.text}`);
      lines.push('');
    }
    lines.push('## 面试预测题', '');
    for (const cat of CATS) {
      const group = qs.filter((q) => q.category === cat);
      if (!group.length) continue;
      lines.push(`### ${CAT_LABELS[cat]}`, '');
      group.forEach((q, i) => { lines.push(`${i + 1}. ${q.question}`, `   - 提示：${q.hint || '—'}`); });
      lines.push('');
    }
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="exam-${jdId}.md"`);
    res.send(lines.join('\n'));
  });

  return r;
}