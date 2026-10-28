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
      {error && <div className="toast toast-err">{error}<button onClick={() => setError('')}>×</button></div>}
      <div className="row">
        <button className={tab === 'items' ? 'tab active' : 'tab'} onClick={() => setTab('items')}>履历条目</button>
        <button className={tab === 'materials' ? 'tab active' : 'tab'} onClick={() => setTab('materials')}>素材库</button>
      </div>
      {tab === 'items' ? (
        <>
          <p>在这里持续积累你的所有经历（终身履历）。每个条目保存即留版本，可随时回退。</p>
          <BulletsWizard onDone={refresh} onError={setError} />
          {SECTIONS.map(sec => (
            <section key={sec} className="sec-group">
              <div className="sec-head">
                <h2>{SECTION_LABELS[sec]}</h2>
                <button onClick={() => add(sec)} disabled={busy}>+ 新增</button>
              </div>
              {items.filter(i => i.section === sec).map(it => (
                <ItemCard key={it.id} item={it} onChanged={refresh} onError={setError} />
              ))}
            </section>
          ))}
        </>
      ) : (
        <MaterialsPanel onError={setError} />
      )}
    </div>
  );
}
