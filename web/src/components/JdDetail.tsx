import { useEffect, useState } from 'react';
import { api } from '../api';
import { Jd, Suggestion, ProfileItem } from '../types';
import ResumePreview from './ResumePreview';
import Icon from './Icon';

export default function JdDetail({ jdId, onClose, onError }: { jdId: number; onClose: () => void; onError: (m: string) => void }) {
  const [tab, setTab] = useState<'rec' | 'resume' | 'coach'>('rec');
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

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h3 className="wide">{jd.company || '(公司)'} · {jd.title || '(岗位)'}</h3>
          <button onClick={onClose}>关闭</button>
        </div>
        <div className="row">
          <button className={tab === 'rec' ? 'tab active' : 'tab'} onClick={() => setTab('rec')}>① 推荐经历</button>
          <button className={tab === 'resume' ? 'tab active' : 'tab'} onClick={() => setTab('resume')}>② 定制简历</button>
          <button className={tab === 'coach' ? 'tab active' : 'tab'} onClick={() => setTab('coach')}>③ AI 教练</button>
        </div>
        {tab === 'rec' && (
          <div>
            <div className="row">
              <button className="primary" onClick={recommend} disabled={busy}>{busy ? 'AI 匹配中…' : 'AI 推荐匹配经历'}</button>
              <span className="wide" />
              <span>已选 {jd.chosen_items.length} 条</span>
            </div>
            <div className="card">
              <b>JD 要点：</b>
              <p>{(jd.summary.requirements ?? []).join('；') || '（未解析，先去 JD 列表点「解析」）'}</p>
              <p>{(jd.summary.responsibilities ?? []).join('；')}</p>
            </div>
            {jd.recommended.length === 0 && <p style={{ color: '#888' }}>点上方按钮，AI 会从你的履历里挑出最匹配的经历并说明理由；也可以先在下方手动勾选</p>}
            {jd.recommended.map((r) => (
              <div key={r.item_id} className="card">
                <div className="row">
                  <input type="checkbox" checked={jd.chosen_items.includes(r.item_id)} onChange={() => toggleChosen(r.item_id)} />
                  <b className="wide">条目 #{r.item_id}</b>
                  <span className={'score ' + (r.score >= 80 ? 'high' : r.score >= 60 ? 'mid' : 'low')}>{r.score} 分</span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 14 }}>{r.reason}</p>
              </div>
            ))}
            {jd.recommended.length === 0 && allItems.length > 0 && (
              <div className="card">
                <b>手动挑选（全部履历条目）：</b>
                {allItems.map((it) => (
                  <div key={it.id} className="row">
                    <input type="checkbox" checked={jd.chosen_items.includes(it.id)} onChange={() => toggleChosen(it.id)} />
                    <span className="wide">{it.heading || '(空抬头)'} — {it.bullets.join('；').slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            )}
            {jd.recommended.length === 0 && allItems.length === 0 && (
              <p style={{ color: '#888' }}>你的履历还是空的，先去「① 个人履历」录入经历</p>
            )}
          </div>
        )}
        {tab === 'resume' && <ResumePreview jdId={jdId} />}
        {tab === 'coach' && <CoachPanel jd={jd} onError={onError} onRefresh={refresh} />}
      </div>
    </div>
  );
}

function CoachPanel({ jd, onError, onRefresh }: { jd: Jd; onError: (m: string) => void; onRefresh: () => void }) {
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

  if (jd.chosen_items.length === 0) return <p style={{ color: '#888' }}>先在「① 推荐经历」页勾选要进入简历的经历条目</p>;

  return (
    <div>
      {jd.chosen_items.map((itemId) => {
        const run = runs[itemId];
        return (
          <div key={itemId} className="card">
            <div className="row">
              <b className="wide">条目 #{itemId}</b>
              <button className="primary" onClick={() => optimize(itemId)} disabled={busyId === itemId}>{busyId === itemId ? 'AI 改写中…' : run ? '重新生成建议' : 'AI 按 JD 优化'}</button>
            </div>
            {run && run.suggestions.map((s) => (
              <div key={s.bullet_index} className="sug">
                <div className="orig">原文：{run.original_bullets[s.bullet_index]}</div>
                <div className="new">建议：{s.new_text}</div>
                <div className="meta">{s.star_label} · {s.reason}</div>
                <div className="row">
                  <button className={s.status === 'accepted' ? 'primary' : ''} onClick={() => decide(itemId, run.id, s.bullet_index, s.status === 'accepted' ? 'pending' : 'accepted')}>{s.status === 'accepted' ? <><Icon name="check" /> 已采纳</> : '采纳'}</button>
                  <button className={s.status === 'rejected' ? 'danger' : ''} onClick={() => decide(itemId, run.id, s.bullet_index, s.status === 'rejected' ? 'pending' : 'rejected')}>{s.status === 'rejected' ? <><Icon name="close" /> 已拒绝</> : '拒绝'}</button>
                </div>
              </div>
            ))}
            {run && (
              <div className="row">
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