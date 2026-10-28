import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Jd, PlanWeek, ExamQuestion } from '../types';
import MockChat from '../components/MockChat';
import Icon from '../components/Icon';
import { SkeletonCards } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

const CAT_LABELS: Record<string, string> = { project_deep: '项目深挖', tech: '技术题', behavioral: '行为题 (STAR)', hr: 'HR 题' };
const CATS = ['project_deep', 'tech', 'behavioral', 'hr'];

export default function ExamPage({ onNavigate }: { onNavigate?: (p: 'profile' | 'workbench') => void }) {
  const [jds, setJds] = useState<Jd[]>([]);
  const [jdId, setJdId] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<PlanWeek[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState<number | 'q'>('q');
  const [chatQ, setChatQ] = useState<ExamQuestion | null>(null);
  const jdRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api.listJds().then((list: Jd[]) => {
      setJds(list);
      if (list.length) setJdId(list[0].id);
    }).catch((e) => setMsg((e as Error).message));
  }, []);

  useEffect(() => { if (jdId) load(jdId); }, [jdId]);

  useEffect(() => {
    if (!busy) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function load(id: number) {
    setWeeks([]); setQuestions([]); setSel('q'); setLoading(true);
    try {
      const p = await api.examPlan(id);
      setWeeks(p.weeks);
      setSel(p.weeks[0]?.week ?? 'q');
    } catch { /* 未生成 */ }
    try { setQuestions(await api.examQuestions(id)); } catch { /* 未生成 */ }
    setLoading(false);
  }

  async function generate() {
    if (!jdId) return;
    setBusy(true); setMsg('');
    try {
      const r = await api.examGenerate(jdId);
      setWeeks(r.plan.weeks);
      setQuestions(r.questions);
      setSel(r.plan.weeks[0]?.week ?? 'q');
      setMsg('生成完成 ✅');
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

  const current = typeof sel === 'number' ? weeks.find((w) => w.week === sel) ?? null : null;
  const totalDone = weeks.reduce((s, w) => s + w.tasks.filter((t) => t.done).length, 0);
  const totalTasks = weeks.reduce((s, w) => s + w.tasks.length, 0);
  const hasPlan = weeks.length > 0 || questions.length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1>备考中心</h1>
        <span className="sub">针对选中的 JD 生成学习计划与面试预测题</span>
      </div>

      {jds.length === 0 ? (
        <EmptyState title="还没有 JD，无法生成备考包" desc="备考包需要先有一个目标岗位。去 JD 工作台粘贴一份职位描述吧。" icon="doc">
          <button className="primary" onClick={() => onNavigate?.('workbench')}>去 JD 工作台</button>
        </EmptyState>
      ) : (
        <>
          <div className="row">
            <b>选择 JD：</b>
            <select ref={jdRef} style={{ width: 'auto', minWidth: 220 }} value={jdId ?? ''} onChange={(e) => setJdId(Number(e.target.value))}>
              {jds.map((j) => <option key={j.id} value={j.id}>{j.company} · {j.title}</option>)}
            </select>
            <button className="primary" onClick={generate} disabled={busy || !jdId}>{busy ? `生成中 ${elapsed}s` : hasPlan ? '重新生成备考包' : '生成备考包'}</button>
            <button onClick={exportMd} disabled={!hasPlan}>导出 Markdown</button>
            {totalTasks > 0 && <span className="notice">总进度 {totalDone}/{totalTasks}</span>}
          </div>

          {busy && (
            <div className="card">
              <div className="row" style={{ marginTop: 0 }}>
                <b className="wide">AI 正在生成学习计划与面试题…</b>
                <span className="notice">已等 {elapsed} 秒 · 通常 20~60 秒</span>
              </div>
              <div className="progress" role="progressbar" aria-label="生成中"><div className="progress-bar" /></div>
              <p className="notice" style={{ marginBottom: 0 }}>请保持页面打开。生成完成后会自动填充左侧周导航。</p>
            </div>
          )}

          {msg && <div className="toast" role="status">{msg}<button onClick={() => setMsg('')} aria-label="关闭提示">×</button></div>}

          {loading ? <SkeletonCards count={2} /> : !hasPlan ? (
            <EmptyState title="这份 JD 还没有备考包" desc="点击「生成备考包」，AI 会按职位要求排出 2~4 周学习计划（含每周推荐项目与交付物）和 15+ 道面试预测题。" icon="spark">
              <button className="primary" onClick={generate} disabled={busy}>立即生成</button>
            </EmptyState>
          ) : (
            <div className="exam-grid">
              <aside className="exam-nav" aria-label="备考导航">
                {weeks.map((w) => {
                  const done = w.tasks.filter((t) => t.done).length;
                  return (
                    <button key={w.week} className={sel === w.week ? 'exam-nav-item active' : 'exam-nav-item'} onClick={() => setSel(w.week)}>
                      <span className="exam-nav-label">第 {w.week} 周</span>
                      <span className="exam-nav-meta">{done}/{w.tasks.length}</span>
                    </button>
                  );
                })}
                <button className={sel === 'q' ? 'exam-nav-item active' : 'exam-nav-item'} onClick={() => setSel('q')}>
                  <span className="exam-nav-label">面试预测题</span>
                  <span className="exam-nav-meta">{questions.length}</span>
                </button>
              </aside>

              <section className="exam-main">
                {current && (
                  <div key={current.week} className="panel-fade">
                    <div className="card">
                      <div className="row" style={{ marginTop: 0 }}>
                        <h3 className="wide">第 {current.week} 周 · {current.focus}</h3>
                        <span className="badge ok">{current.tasks.filter((t) => t.done).length}/{current.tasks.length} 完成</span>
                      </div>
                      {current.tasks.map((t, i) => (
                        <label key={i} className="task">
                          <input type="checkbox" checked={t.done} onChange={() => toggle(current.week, i)} />
                          <span className={t.done ? 'done' : ''}>{t.text}</span>
                        </label>
                      ))}
                      {(current.projects?.length ?? 0) > 0 && (
                        <div className="deliverables">
                          <h4>交付物 · 推荐项目</h4>
                          {current.projects!.map((p) => (
                            <div key={p.name} className="deliverable">
                              {p.url
                                ? <a href={p.url} target="_blank" rel="noreferrer">{p.name}<span aria-hidden="true"> ↗</span></a>
                                : <b>{p.name}</b>}
                              {p.deliverable && <div className="deliverable-desc">{p.deliverable}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {sel === 'q' && (
                  <div key="questions" className="panel-fade">
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
              </section>
            </div>
          )}
        </>
      )}

      {chatQ && <MockChat question={chatQ} onClose={() => setChatQ(null)} onError={setMsg} />}
    </div>
  );
}