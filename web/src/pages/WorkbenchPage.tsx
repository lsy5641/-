import { useEffect, useState } from 'react';
import { api } from '../api';
import { Jd, Keyword, CAT_LABELS } from '../types';
import JdDetail from '../components/JdDetail';

export default function WorkbenchPage() {
  const [tab, setTab] = useState<'jds' | 'keywords'>('jds');
  return (
    <div className="page">
      <div className="page-head">
        <h1>JD 工作台</h1>
        <span className="sub">粘贴 JD → AI 提词条 → 推荐经历 → 组装定制简历</span>
      </div>
      <div className="row no-wrap">
        <button className={tab === 'jds' ? 'tab active' : 'tab'} onClick={() => setTab('jds')}>JD 列表</button>
        <button className={tab === 'keywords' ? 'tab active' : 'tab'} onClick={() => setTab('keywords')}>词条库</button>
      </div>
      {tab === 'jds' ? <div key="jds" className="panel-fade"><JdsPanel /></div> : <div key="kw" className="panel-fade"><KeywordsPanel /></div>}
    </div>
  );
}

function JdsPanel() {
  const [jds, setJds] = useState<Jd[]>([]);
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [raw, setRaw] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  async function refresh() { try { setJds(await api.listJds()); } catch (e) { setErr((e as Error).message); } }
  useEffect(() => { refresh(); }, []);

  async function add() {
    setErr('');
    try { await api.createJd({ company, title, raw_text: raw }); setCompany(''); setTitle(''); setRaw(''); refresh(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function analyze(j: Jd) {
    setBusyId(j.id); setErr('');
    try { await api.analyzeJd(j.id); await refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusyId(null); }
  }
  async function del(j: Jd) { if (!confirm(`删除 JD「${j.company} ${j.title}」？`)) return; try { await api.deleteJd(j.id); refresh(); } catch (e) { setErr((e as Error).message); } }

  return (
    <div>
      {err && <div className="toast toast-err">{err}<button onClick={() => setErr('')}>×</button></div>}
      <div className="card">
        <div className="row">
          <input placeholder="公司" value={company} onChange={e => setCompany(e.target.value)} />
          <input placeholder="岗位" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <textarea className="wide" rows={6} placeholder="粘贴 JD 原文（至少30字），保存后点『解析』由 AI 提取要求要点与词条" value={raw} onChange={e => setRaw(e.target.value)} />
        <div className="row"><button className="primary" onClick={add}>+ 保存 JD</button></div>
      </div>
      {jds.map(j => (
        <div key={j.id} className="card">
          <div className="row">
            <b className="wide">{j.company || '(未填公司)'} · {j.title || '(未填岗位)'}</b>
            <span className={j.analyzed ? 'badge ok' : 'badge wait'}>{j.analyzed ? '已解析' : '未解析'}</span>
            <button className="primary" onClick={() => analyze(j)} disabled={busyId === j.id}>{busyId === j.id ? 'AI 解析中…' : '解析'}</button>
            <button onClick={() => setOpenId(j.id)}>打开</button>
            <button className="danger" onClick={() => del(j)}>删除</button>
          </div>
          {j.analyzed === 1 && (
            <div className="jd-detail">
              <p><b>要求：</b>{j.summary.requirements.join('；') || '—'}</p>
              <p><b>职责：</b>{j.summary.responsibilities.join('；') || '—'}</p>
            </div>
          )}
        </div>
      ))}
      {openId !== null && <JdDetail jdId={openId} onClose={() => setOpenId(null)} onError={setErr} />}
    </div>
  );
}

function KeywordsPanel() {
  const [rows, setRows] = useState<Keyword[]>([]);
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState('hard_skill');
  const [err, setErr] = useState('');

  async function refresh() { try { setRows(await api.listKeywords()); } catch (e) { setErr((e as Error).message); } }
  useEffect(() => { refresh(); }, []);

  async function add() {
    setErr('');
    try { await api.addKeyword({ term, category }); setTerm(''); refresh(); } catch (e) { setErr((e as Error).message); }
  }
  async function upd(k: Keyword, patch: object) { try { await api.updateKeyword(k.id, patch); refresh(); } catch (e) { setErr((e as Error).message); } }
  async function del(k: Keyword) { if (!confirm(`删除词条「${k.term}」？`)) return; try { await api.deleteKeyword(k.id); refresh(); } catch (e) { setErr((e as Error).message); } }

  return (
    <div>
      {err && <div className="toast toast-err">{err}<button onClick={() => setErr('')}>×</button></div>}
      <div className="card row">
        <input className="wide" placeholder="手动添加词条，如 Python" value={term} onChange={e => setTerm(e.target.value)} />
        <select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button className="primary" onClick={add}>+ 添加</button>
      </div>
      <div className="card">
        <table className="kw-table">
          <thead><tr><th>词条</th><th>类别</th><th>总频次</th><th>出现JD数</th><th>备注</th><th></th></tr></thead>
          <tbody>
            {rows.map(k => (
              <tr key={k.id}>
                <td><b>{k.term}</b></td>
                <td><select value={k.category} onChange={e => upd(k, { category: e.target.value })}>{Object.entries(CAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td>{k.totalFrequency}</td><td>{k.jdCount}</td>
                <td><input defaultValue={k.note} onBlur={e => e.target.value !== k.note && upd(k, { note: e.target.value })} /></td>
                <td><button className="danger" onClick={() => del(k)}>删</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>还没有词条——去「JD 列表」粘贴一个 JD 点解析</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
