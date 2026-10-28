import { useEffect, useState } from 'react';
import { api } from '../api';
import { ProfileItem, Section, SECTIONS, SECTION_LABELS } from '../types';
import ItemCard from '../components/ItemCard';
import MaterialsPanel from '../components/MaterialsPanel';
import BulletsWizard from '../components/BulletsWizard';
import { SkeletonCards } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function ProfilePage({ onNavigate }: { onNavigate?: (p: 'workbench' | 'exam') => void }) {
  const [tab, setTab] = useState<'items' | 'materials'>('items');
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wizardFocus, setWizardFocus] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem('jc-onboarding-dismissed') !== '1');
  const [jdCount, setJdCount] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);

  async function refresh() {
    try { setItems(await api.listItems()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }
  useEffect(() => {
    refresh();
    api.listJds().then((list: { analyzed: number }[]) => {
      setJdCount(list.length);
      setAnalyzedCount(list.filter((j) => j.analyzed === 1).length);
    }).catch(() => { /* 引导信息可选 */ });
  }, []);

  async function add(section: Section) {
    setBusy(true); setError('');
    try { await api.createItem({ section, heading: '', period: '', bullets: [] }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function dismissGuide() {
    localStorage.setItem('jc-onboarding-dismissed', '1');
    setGuideOpen(false);
  }

  return (
    <div className="page">
      {error && <div className="toast toast-err" role="alert">{error}<button onClick={() => setError('')} aria-label="关闭提示">×</button></div>}
      <div className="page-head">
        <h1>个人履历</h1>
        <span className="sub">终身履历 · 每次保存自动留版本</span>
      </div>

      {guideOpen && (
        <div className="card onboarding">
          <div className="row" style={{ margin: 0 }}>
            <b className="wide">3 步开始你的求职准备</b>
            <button className="ghost" onClick={dismissGuide} aria-label="关闭新手引导">×</button>
          </div>
          <ol className="onboarding-steps">
            <li className={items.length ? 'done' : ''}><span>1</span>录履历：按模块记录你的经历，越具体越好</li>
            <li className={jdCount ? 'done' : ''}><span>2</span>粘 JD：到 JD 工作台粘贴职位描述，AI 自动提词条</li>
            <li className={analyzedCount && items.length ? 'done' : ''}><span>3</span>出成品：推荐经历 → STAR 改写定制简历 → 生成备考包</li>
          </ol>
          <div className="row" style={{ marginBottom: 0 }}>
            <button className="primary" onClick={() => onNavigate?.('workbench')}>去 JD 工作台</button>
            <button onClick={() => { setTab('items'); setWizardFocus(true); }}>先用 AI 拆亮点</button>
          </div>
        </div>
      )}

      <div className="row no-wrap">
        <button className={tab === 'items' ? 'tab active' : 'tab'} onClick={() => setTab('items')}>履历条目</button>
        <button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>素材库</button>
      </div>

      {tab === 'items' ? (
        <div key="items" className="panel-fade">
          <p className="notice">在这里持续积累你的所有经历，写得越具体，AI 越能帮你改好。</p>

          {loading ? (
            <SkeletonCards count={2} />
          ) : (
            <>
              {items.length === 0 && (
                <EmptyState title="履历还是空的" desc="先录一段真实经历（哪怕写得很粗糙），AI 可以帮你改成 STAR 亮点。" icon="doc">
                  <button className="primary" onClick={() => add('work')} disabled={busy}>+ 新增工作经历</button>
                  <button onClick={() => setWizardFocus(true)}>用 AI 拆亮点</button>
                </EmptyState>
              )}
              {items.length > 0 && <BulletsWizard autoFocus={wizardFocus} onFocusDone={() => setWizardFocus(false)} onDone={refresh} onError={setError} />}
              {SECTIONS.map(sec => {
                const group = items.filter(i => i.section === sec);
                return (
                  <section key={sec} className="sec-group">
                    <div className="sec-head">
                      <h2>{SECTION_LABELS[sec]}</h2>
                      {group.length > 0 && <span className="count">{group.length}</span>}
                      <button onClick={() => add(sec)} disabled={busy} aria-label={`新增${SECTION_LABELS[sec]}`}>+ 新增</button>
                    </div>
                    {group.length === 0 && <p className="notice" style={{ margin: '2px 0 0 2px' }}>暂无{SECTION_LABELS[sec]}，点「+ 新增」开始记录</p>}
                    {group.map(it => (
                      <ItemCard key={it.id} item={it} onChanged={refresh} onError={setError} />
                    ))}
                  </section>
                );
              })}
            </>
          )}
        </div>
      ) : (
        <div key="materials" className="panel-fade">
          <MaterialsPanel onError={setError} />
        </div>
      )}
    </div>
  );
}