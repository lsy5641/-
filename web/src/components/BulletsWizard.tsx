import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import Icon from './Icon';

export default function BulletsWizard({ onDone, onError, autoFocus, onFocusDone }: {
  onDone: () => void; onError: (m: string) => void; autoFocus?: boolean; onFocusDone?: () => void;
}) {
  const [text, setText] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && areaRef.current) {
      areaRef.current.focus();
      areaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusDone?.();
    }
  }, [autoFocus]);

  async function run() {
    setBusy(true); setBullets([]);
    try { const r = await api.aiBullets(text); setBullets(r.bullets); setPicked(r.bullets.map(() => true)); }
    catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }

  async function createItem() {
    const chosen = bullets.filter((_, i) => picked[i]);
    if (!chosen.length) { onError('至少勾选一条'); return; }
    try { await api.createItem({ section: 'work', heading: '', period: '', bullets: chosen }); onDone(); }
    catch (e) { onError((e as Error).message); }
  }

  return (
    <div className="card">
      <b>AI 流水账拆亮点</b>
      <textarea className="wide" rows={5} ref={areaRef} placeholder="把工作流水账原样贴进来（越具体越好，带数字最佳），AI 帮你拆成 STAR 风格简历亮点" value={text} onChange={e => setText(e.target.value)} />
      <div className="row"><button className="primary" onClick={run} disabled={busy || text.trim().length < 10}>{busy ? 'AI 拆解中…' : <><Icon name="spark" /> AI 拆亮点</>}</button></div>
      {bullets.length > 0 && (
        <div>
          {bullets.map((b, i) => (
            <label key={i}><input type="checkbox" checked={picked[i]} onChange={() => setPicked(picked.map((x, j) => (j === i ? !x : x)))} /> {b}</label>
          ))}
          <div className="row"><button className="primary" onClick={createItem}>写入为新条目</button></div>
        </div>
      )}
    </div>
  );
}
