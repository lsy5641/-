import { useEffect, useState } from 'react';
import { Material } from '../types';
import { api } from '../api';

const EMPTY = { title: '', content: '', tagsText: '' };

export default function MaterialsPanel({ onError }: { onError: (m: string) => void }) {
  const [list, setList] = useState<Material[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() { try { setList(await api.listMaterials()); } catch (e) { onError((e as Error).message); } }
  useEffect(() => { refresh(); }, []);

  async function submit() {
    const tags = form.tagsText.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    try {
      if (editingId) await api.updateMaterial(editingId, { title: form.title, content: form.content, tags });
      else await api.createMaterial({ title: form.title, content: form.content, tags });
      setForm({ ...EMPTY }); setEditingId(null); refresh();
    } catch (e) { onError((e as Error).message); }
  }

  function edit(m: Material) { setEditingId(m.id); setForm({ title: m.title, content: m.content, tagsText: m.tags.join('，') }); }
  async function del(m: Material) { if (!confirm(`删除素材「${m.title}」？`)) return; try { await api.deleteMaterial(m.id); refresh(); } catch (e) { onError((e as Error).message); } }

  return (
    <div>
      <div className="card">
        <div className="row"><input className="wide" placeholder="素材标题，如：高并发排障故事" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="row"><input className="wide" placeholder="标签（逗号分隔）：高并发，带教" value={form.tagsText} onChange={e => setForm({ ...form, tagsText: e.target.value })} /></div>
        <div className="row"><textarea className="wide" rows={4} placeholder="完整 STAR 段落：情境/任务/行动/结果" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
        <div className="row">
          <button className="primary" onClick={submit}>{editingId ? '更新素材' : '+ 存为素材'}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm({ ...EMPTY }); }}>取消编辑</button>}
        </div>
      </div>
      {list.map(m => (
        <div key={m.id} className="card">
          <div className="row"><b className="wide">{m.title || '(无标题)'}</b>{m.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
          <div className="mat-content">{m.content}</div>
          <div className="row">
            <button onClick={() => navigator.clipboard.writeText(m.content)}>复制内容</button>
            <button onClick={() => edit(m)}>编辑</button>
            <button className="danger" onClick={() => del(m)}>删除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
