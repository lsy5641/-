import { useEffect, useState } from 'react';
import { ProfileItem, ProfileVersion } from '../types';
import { api } from '../api';

const TRIGGER_LABELS: Record<string, string> = {
  create: '创建', manual: '手动保存', restore: '版本恢复', from_backfill: 'JD回填', from_ai: 'AI生成',
};

export default function VersionsDrawer({ item, onError, onRestored }: {
  item: ProfileItem; onError: (m: string) => void; onRestored: () => void;
}) {
  const [versions, setVersions] = useState<ProfileVersion[]>([]);
  useEffect(() => { api.listVersions(item.id).then(setVersions).catch(e => onError((e as Error).message)); }, [item.id]);

  async function restore(v: ProfileVersion) {
    if (!confirm(`恢复到此版（${v.snapshot.heading || '无标题'}）？`)) return;
    try { await api.restoreVersion(item.id, v.id); onRestored(); } catch (e) { onError((e as Error).message); }
  }

  return (
    <div className="versions">
      <h4>历史版本（每次保存自动留档，最近50版永不丢）</h4>
      {versions.length === 0 && <div className="ver">暂无记录</div>}
      {versions.map(v => (
        <div key={v.id} className="ver">
          <div>
            <b>{new Date(v.created_at).toLocaleString()}</b> · {TRIGGER_LABELS[v.trigger] ?? v.trigger} · 「{v.snapshot.heading || '(空抬头)'}」· {v.snapshot.bullets.length} 条亮点
          </div>
          <button onClick={() => restore(v)}>恢复到此版</button>
        </div>
      ))}
    </div>
  );
}
