import { useEffect, useState } from 'react';
import { api } from '../api';
import { ProfileItem, Section, SECTIONS, SECTION_LABELS } from '../types';
import ItemCard from '../components/ItemCard';
import MaterialsPanel from '../components/MaterialsPanel';
import BulletsWizard from '../components/BulletsWizard';

export default function ProfilePage() {
  const [tab, setTab] = useState<'items' | 'materials'>('items');
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try { setItems(await api.listItems()); } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { refresh(); }, []);

  async function add(section: Section) {
    setBusy(true); setError('');
    try { await api.createItem({ section, heading: '', period: '', bullets: [] }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="page">
      {error && <div className="toast toast-err" role="alert">{error}<button onClick={() => setError('')} aria-label="关闭提示">×</button></div>}
      <div className="page-head">
        <h1>个人履历</h1>
        <span className="sub">终身履历 · 每次保存自动留版本</span>
      </div>
      <div className="row no-wrap">
        <button className={tab === 'items' ? 'tab active' : 'tab'} onClick={() => setTab('items')}>履历条目</button>
        <button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>素材库</button>
      </div>
      {tab === 'items' ? (
        <div key="items" className="panel-fade">
          <p className="notice">在这里持续积累你的所有经历，写得越具体，AI 越能帮你改好。录入后可用「AI 拆亮点」把流水账变成 STAR 亮点。</p>
          <BulletsWizard onDone={refresh} onError={setError} />
          {SECTIONS.map(sec => (
            <section key={sec} className="sec-group">
              <div className="sec-head">
                <h2>{SECTION_LABELS[sec]}</h2>
                {items.filter(i => i.section === sec).length > 0 && <span className="count">{items.filter(i => i.section === sec).length}</span>}
                <button onClick={() => add(sec)} disabled={busy} aria-label={`新增${SECTION_LABELS[sec]}`}>+ 新增</button>
              </div>
              {items.filter(i => i.section === sec).map(it => (
                <ItemCard key={it.id} item={it} onChanged={refresh} onError={setError} />
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div key="materials" className="panel-fade">
          <MaterialsPanel onError={setError} />
        </div>
      )}
    </div>
  );
}
