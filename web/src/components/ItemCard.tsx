import { useEffect, useState } from 'react';
import { ProfileItem } from '../types';
import { api } from '../api';
import VersionsDrawer from './VersionsDrawer';

export default function ItemCard({ item, onChanged, onError }: {
  item: ProfileItem; onChanged: () => void; onError: (m: string) => void;
}) {
  const [heading, setHeading] = useState(item.heading);
  const [period, setPeriod] = useState(item.period);
  const [bullets, setBullets] = useState<string[]>(item.bullets.length ? item.bullets : ['']);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    setHeading(item.heading);
    setPeriod(item.period);
    setBullets(item.bullets.length ? item.bullets : ['']);
  }, [item]);

  async function save() {
    setSaving(true);
    try {
      await api.updateItem(item.id, { heading, period, bullets: bullets.map(b => b.trim()).filter(b => b.length) });
      onChanged();
    } catch (e) { onError((e as Error).message); } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`确认删除「${heading || '此条目'}」？其历史版本也会被删除。`)) return;
    try { await api.deleteItem(item.id); onChanged(); } catch (e) { onError((e as Error).message); }
  }

  return (
    <div className="card">
      <div className="row">
        <input className="wide" placeholder="抬头：公司 - 岗位" value={heading} onChange={e => setHeading(e.target.value)} />
        <input className="period-input" placeholder="起止时间（可选）" value={period} onChange={e => setPeriod(e.target.value)} />
      </div>
      {bullets.map((b, i) => (
        <div key={i} className="row">
          <textarea className="wide" rows={2} placeholder={`亮点 ${i + 1}：做了什么 → 怎么做 → 结果（数字）`} value={b}
            onChange={e => setBullets(bullets.map((x, j) => (j === i ? e.target.value : x)))} />
          <button title="删除这条亮点" onClick={() => setBullets(bullets.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row">
        <button onClick={() => setBullets([...bullets, ''])}>+ 加一条亮点</button>
        <span className="wide" />
        <button onClick={() => setShowVersions(v => !v)}>历史版本</button>
        <button className="primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
        <button className="danger" onClick={remove}>删除条目</button>
      </div>
      {showVersions && (
        <VersionsDrawer item={item} onError={onError}
          onRestored={() => { setShowVersions(false); onChanged(); }} />
      )}
    </div>
  );
}
