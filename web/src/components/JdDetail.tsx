import { useEffect, useState } from 'react';
import { api } from '../api';
import { Jd, Suggestion, ProfileItem } from '../types';
import ResumePreview from './ResumePreview';
import Icon from './Icon';
import Stepper from './Stepper';

type Step = 'rec' | 'assemble' | 'coach' | 'export';

export default function JdDetail({ jdId, onClose, onError }: { jdId: number; onClose: () => void; onError: (m: string) => void }) {
  const [tab, setTab] = useState<Step>('rec');
  const [jd, setJd] = useState<Jd | null>(null);
  const [busy, setBusy] = useState(false);
  const [allItems, setAllItems] = useState<ProfileItem[]>([]);

  async function refresh() {
    try {
      const list = await api.listJds();
      setJd(list.find((x: Jd) => x.id === jdId) ?? null);
      setAllItems(await api.listItems());
    } catch (e) { onError((e as Error).message); }
  }
  useEffect(() => { refresh(); }, [jdId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function recommend() {
    setBusy(true);
    try { await api.recommendJd(jdId); await refresh(); }
    catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  async function toggleChosen(itemId: number) {
    if (!jd) return;
    const has = jd.chosen_items.includes(itemId);
    const next = has ? jd.chosen_items.filter((x) => x !== itemId) : [...jd.chosen_items, itemId];
    try { await api.saveChosen(jdId, next); await refresh(); } catch (e) { onError((e as Error).message); }
  }

  if (!jd) return null;

  const hasChosen = jd.chosen_items.length > 0;
  const hasOverride = Object.keys(jd.overrides ?? {}).length > 0;

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginTop: 0 }}>
          <h3 className="wide">{jd.company || '(公司)'} · {jd.title || '(岗位)'}</h3>
          <button onClick={onClose}>关闭</button>
        </div>

        <Stepper
          current={tab}
          onSelect={(k) => setTab(k as Step)}
          steps={[
            { key: 'rec', label: '推荐经历', done: hasChosen },
            { key: 'assemble', label: '定制简历', done: hasChosen },
            { key: 'coach', label: 'AI 教练', done: hasOverride },
            { key: 'export', label: '预览与导出' },
          ]}
        />

        <div key={tab} className="panel-fade">
          {tab === 'rec' && (
            <div>
              <div className="row">
                <button className="primary" onClick={recommend} disabled={busy}>{busy ? 'AI 匹配中…' : 'AI 推荐匹配经历'}</button>
                <span className="wide" />
                <span className="notice">已选 {jd.chosen_items.length} 条</span>
              </div>
              <div className="card">
                <b>JD 要点：</b>
                <p>{(jd.summary.requirements ?? []).join('；') || '（未解析，先去 JD 列表点「解析」）'}</p>
                <p>{(jd.summary.responsibilities ?? []).join('；')}</p>
              </div>
              {jd.recommended.length === 0 && <p className="notice">点上方按钮，AI 会从你的履历里挑出最匹配的经历并说明理由；也可以先在下方手动勾选</p>}
              {jd.recommended.map((r) => {
                const it = allItems.find((x) => x.id === r.item_id);
                return (
                  <div key={r.item_id} className="card">
                    <div className="row" style={{ marginTop: 0 }}>
                      <input type="checkbox" checked={jd.chosen_items.includes(r.item_id)} onChange={() => toggleChosen(r.item_id)} aria-label={`选择经历 ${it?.heading || r.item_id}`} />
                      <b className="wide">{it?.heading || `（未命名经历，条目 #${r.item_id}）`}</b>
                      <span className={'score ' + (r.score >= 80 ? 'high' : r.score >= 60 ? 'mid' : 'low')}>{r.score} 分</span>
                    </div>
                    {it && it.bullets.length > 0 && <p className="snippet">{it.bullets.join(' · ').slice(0, 90)}</p>}
                    <p style={{ margin: '4px 0', fontSize: 14 }}>{r.reason}</p>
                  </div>
                );
              })}
              {jd.recommended.length === 0 && allItems.length > 0 && (
                <div className="card">
                  <b>手动挑选（全部履历条目）：</b>
                  {allItems.map((it) => (
                    <div key={it.id} className="row">
                      <input type="checkbox" checked={jd.chosen_items.includes(it.id)} onChange={() => toggleChosen(it.id)} aria-label={`选择 ${it.heading || '未命名经历'}`} />
                      <span className="wide">{it.heading || '(空抬头)'} — {it.bullets.join('；').slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              )}
              {jd.recommended.length === 0 && allItems.length === 0 && (
                <p className="notice">你的履历还是空的，先去「① 个人履历」录入经历</p>
              )}
              <div className="row" style={{ marginTop: 14 }}>
                <button className="primary" disabled={!hasChosen} onClick={() => setTab('assemble')}>
                  下一步：定制简历{!hasChosen ? '（先勾选经历）' : ''}
                </button>
              </div>
            </div>
          )}

          {tab === 'assemble' && (
            <div>
              <p className="notice">这里检查简历组装与关键词命中情况：命中词会高亮，缺失词会列出来提醒补强。</p>
              <ResumePreview jdId={jdId} mode="assemble" />
              <div className="row" style={{ marginTop: 14 }}>
                <button className="primary" disabled={!hasChosen} onClick={() => setTab('coach')}>下一步：AI 教练改写</button>
              </div>
            </div>
          )}

          {tab === 'coach' && (
            <div>
              <CoachPanel jd={jd} items={allItems} onError={onError} onRefresh={refresh} />
              <div className="row" style={{ marginTop: 14 }}>
                <button className="primary" disabled={!hasChosen} onClick={() => setTab('export')}>下一步：预览与导出</button>
              </div>
            </div>
          )}

          {tab === 'export' && (
            <div>
              <p className="notice">最终成品预览。可导出 JSON / Word，或打印存为 PDF（打印时只输出简历内容）。</p>
              <ResumePreview jdId={jdId} mode="export" />
              <div className="row" style={{ marginTop: 14 }}>
                <button onClick={onClose}>完成，关闭</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CoachPanel({ jd, items, onError, onRefresh }: { jd: Jd; items: ProfileItem[]; onError: (m: string) => void; onRefresh: () => void }) {
  const [runs, setRuns] = useState<Record<number, { id: number; original_bullets: string[]; suggestions: Suggestion[]; backfilled: number }>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  async function optimize(itemId: number) {
    setBusyId(itemId);
    try {
      const run = await api.coach(jd.id, itemId);
      setRuns({ ...runs, [itemId]: run });
    } catch (e) { onError((e as Error).message); } finally { setBusyId(null); }
  }
  async function decide(itemId: number, runId: number, bulletIndex: number, status: string) {
    try {
      const r = await api.decide(runId, bulletIndex, status);
      setRuns({ ...runs, [itemId]: { ...runs[itemId], suggestions: r.suggestions } });
    } catch (e) { onError((e as Error).message); }
  }
  async function doBackfill(itemId: number, runId: number) {
    try {
      await api.backfill(runId);
      onError('已回填到母版履历 ✅（原内容可在履历的「历史版本」找回）');
      setRuns({ ...runs, [itemId]: { ...runs[itemId], backfilled: 1 } });
      onRefresh();
    } catch (e) { onError((e as Error).message); }
  }
  async function toMaterial(itemId: number, runId: number) {
    try { const r = await api.coachToMaterial(runId); onError(`已沉淀 ${r.count} 条到素材库 ✅`); }
    catch (e) { onError((e as Error).message); }
  }

  if (!jd.chosen_items.length) return <p className="notice">先在「① 推荐经历」页勾选要进入简历的经历条目</p>;

  return (
    <div>
      {jd.chosen_items.map((itemId) => {
        const run = runs[itemId];
        const it = items.find((x) => x.id === itemId);
        return (
          <div key={itemId} className="card">
            <div className="row" style={{ marginTop: 0 }}>
              <div className="wide">
                <b>{it?.heading || `（未命名经历，条目 #${itemId}）`}</b>
                {it && it.bullets.length > 0 && <div className="snippet">{it.bullets.join(' · ').slice(0, 90)}</div>}
              </div>
              <button className="primary" onClick={() => optimize(itemId)} disabled={busyId === itemId}>{busyId === itemId ? 'AI 改写中…' : run ? '重新生成建议' : 'AI 按 JD 优化'}</button>
            </div>
            {run && run.suggestions.map((s) => (
              <div key={s.bullet_index} className="sug">
                <div className="orig">原文：{run.original_bullets[s.bullet_index]}</div>
                <div className="new">建议：{s.new_text}</div>
                <div className="meta">{s.star_label} · {s.reason}</div>
                <div className="row" style={{ marginBottom: 0 }}>
                  <button className={s.status === 'accepted' ? 'primary' : ''} onClick={() => decide(itemId, run.id, s.bullet_index, s.status === 'accepted' ? 'pending' : 'accepted')}>{s.status === 'accepted' ? <><Icon name="check" /> 已采纳</> : '采纳'}</button>
                  <button className={s.status === 'rejected' ? 'danger' : ''} onClick={() => decide(itemId, run.id, s.bullet_index, s.status === 'rejected' ? 'pending' : 'rejected')}>{s.status === 'rejected' ? <><Icon name="close" /> 已拒绝</> : '拒绝'}</button>
                </div>
              </div>
            ))}
            {run && (
              <div className="row" style={{ marginBottom: 0 }}>
                <button onClick={() => doBackfill(itemId, run.id)} disabled={run.backfilled === 1}>{run.backfilled === 1 ? '已回填母版' : '回填到母版履历'}</button>
                <button onClick={() => toMaterial(itemId, run.id)}>采纳内容存素材库</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}