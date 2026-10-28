import { useEffect, useState } from 'react';
import { api } from '../api';
import { Jd, PlanWeek, ExamQuestion } from '../types';
import MockChat from '../components/MockChat';
import Icon from '../components/Icon';

const CAT_LABELS: Record<string, string> = { project_deep: '项目深挖', tech: '技术题', behavioral: '行为题 (STAR)', hr: 'HR 题' };
const CATS = ['project_deep', 'tech', 'behavioral', 'hr'];

export default function ExamPage() {
  const [jds, setJds] = useState<Jd[]>([]);
  const [jdId, setJdId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [chatQ, setChatQ] = useState<ExamQuestion | null>(null);

  useEffect(() => {
    api.listJds().then((list: Jd[]) => {
      setJds(list);
      if (list.length) setJdId(list[0].id);
    }).catch((e) => setMsg((e as Error).message));
  }, []);

  useEffect(() => { if (jdId) load(jdId); }, [jdId]);

  async function load(id: number) {
    setWeeks([]); setQuestions([]);
    try { const p = await api.examPlan(id); setWeeks(p.weeks); } catch { /* 未生成 */ }
    try { setQuestions(await api.examQuestions(id)); } catch { /* 未生成 */ }
  }

  async function generate() {
    if (!jdId) return;
    setBusy(true); setMsg('AI 正在生成备考包（约 20~60 秒）…');
    try {
      const r = await api.examGenerate(jdId);
      setWeeks(r.plan.weeks); setQuestions(r.questions); setMsg('生成完成 ✅');
    } catch (e) { setMsg('生成失败：' + (e as Error).message); } finally { setBusy(false); }
  }

  async function toggle(week: number, idx: number) {
    if (!jdId) return;
    try { const r = await api.toggleTask(jdId, week, idx); setWeeks(r.weeks); } catch (e) { setMsg((e as Error).message); }
  }

  function exportMd() {
    if (!jdId) return;
    window.open(`/api/exam/${jdId}/export.md`, '_blank');
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>备考中心</h1>
        <span className="sub">针对选中的 JD 生成学习计划与面试预测题</span>
      </div>
      <div className="row">
        <b>选择 JD：</b>
        <select value={jdId ?? ''} onChange={(e) => setJdId(Number(e.target.value))}>
          {jds.map((j) => <option key={j.id} value={j.id}>{j.company} · {j.title}</option>)}
        </select>
        <button className="primary" onClick={generate} disabled={busy || !jdId}>{busy ? '生成中…' : '生成备考包'}</button>
        <button onClick={exportMd} disabled={!weeks.length}>导出 Markdown</button>
      </div>
      {jds.length === 0 && <p style={{ color: '#888' }}>你还没有 JD——先去「② JD 工作台」粘贴一个</p>}
      {msg && <div className="toast">{msg}</div>}
      {weeks.length > 0 && (
        <div>
          <h3>学习计划</h3>
          {weeks.map((w) => (
            <div key={w.week} className="card">
              <b>第 {w.week} 周 · {w.focus}</b>
              {w.tasks.map((t, i) => (
                <label key={i} className="task"><input type="checkbox" checked={t.done} onChange={() => toggle(w.week, i)} /> <span className={t.done ? 'done' : ''}>{t.text}</span></label>
              ))}
            </div>
          ))}
          <h3>面试预测题（{questions.length} 道）</h3>
          {CATS.map((cat) => {
            const group = questions.filter((q) => q.category === cat);
            if (!group.length) return null;
            return (
              <div key={cat} className="card">
                <b>{CAT_LABELS[cat]}（{group.length}）</b>
                {group.map((q, i) => (
                  <details key={q.id} className="q">
                    <summary>{i + 1}. {q.question}</summary>
                    <p className="hint">提示：{q.hint || '—'}</p>
                    <button onClick={() => setChatQ(q)}><Icon name="mic" /> 模拟追问</button>
                  </details>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {chatQ && <MockChat question={chatQ} onClose={() => setChatQ(null)} onError={setMsg} />}
    </div>
  );
}