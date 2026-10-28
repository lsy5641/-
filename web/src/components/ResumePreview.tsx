import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { ResumeItemView, MatchResult, SECTION_LABELS, Section, Keyword } from '../types';

const GROUPS: Section[] = ['work', 'project', 'education', 'skill', 'award'];

export default function ResumePreview({ jdId }: { jdId: number }) {
  const [items, setItems] = useState<ResumeItemView[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [kws, setKws] = useState<Keyword[]>([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await api.jdResume(jdId);
      setItems(r.items);
      setKws(await api.listKeywords());
    } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, [jdId]);

  async function runMatch() {
    setBusy(true); setErr('');
    try { setMatch(await api.matchJd(jdId)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function exportJson() {
    try {
      const data = await api.exportJd(jdId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `职位定制简历-${data.jd.company || '未命名'}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setErr((e as Error).message); }
  }

  function highlight(text: string): ReactNode {
    if (!match || !match.hits.length) return text;
    let parts: ReactNode[] = [text];
    for (const term of match.hits) {
      const next: ReactNode[] = [];
      for (const node of parts) {
        if (typeof node !== 'string') { next.push(node); continue; }
        const t = term.toLowerCase();
        let rest = node;
        let idx = rest.toLowerCase().indexOf(t);
        if (idx < 0) { next.push(rest); continue; }
        while (idx >= 0 && t.length > 0) {
          next.push(rest.slice(0, idx));
          next.push(<mark key={`${term}-${next.length}`}>{rest.slice(idx, idx + term.length)}</mark>);
          rest = rest.slice(idx + term.length);
          idx = rest.toLowerCase().indexOf(t);
        }
        next.push(rest);
      }
      parts = next;
    }
    return parts;
  }

  return (
    <div>
      {err && <div className="toast toast-err">{err}<button onClick={() => setErr('')}>×</button></div>}
      <div className="row">
        <button className="primary" onClick={runMatch} disabled={busy}>{busy ? '计算中…' : '重新计算关键词命中'}</button>
        <button onClick={exportJson}>导出定制简历 JSON</button>
        <button onClick={() => window.open(`/api/export/docx/${jdId}`, '_blank')}>导出 Word</button>
        <button onClick={() => window.print()}>打印 / 存为 PDF</button>
        <span className="wide" />
        {match && <span>覆盖率 {match.coveragePct}%（{match.hits.length}/{match.total}）</span>}
      </div>
      {match && match.missing.length > 0 && (
        <div className="card">
          <b>JD 要求但简历未体现的词条（{match.missing.length}）：</b>
          <div className="row" style={{ flexWrap: 'wrap' }}>{match.missing.map((m) => <span key={m} className="tag tag-miss">{m}</span>)}</div>
        </div>
      )}
      <div className="card resume-paper">
        {GROUPS.map((g) => {
          const its = items.filter((i) => i.section === g);
          if (!its.length) return null;
          return (
            <section key={g}>
              <h4>{SECTION_LABELS[g]}</h4>
              {its.map((it) => (
                <div key={it.item_id} className="resume-item">
                  <div className="resume-heading">{highlight(it.heading)}{it.period ? <span className="period">{it.period}</span> : null}</div>
                  <ul>{it.bullets.map((b, i) => <li key={i}>{highlight(b)}</li>)}</ul>
                </div>
              ))}
            </section>
          );
        })}
        {items.length === 0 && <p style={{ color: '#888' }}>还没有选择经历——先去「① 推荐经历」勾选几条</p>}
      </div>
      {kws.length === 0 && <p style={{ color: '#888', fontSize: 13 }}>提示：词条为空，先在 JD 列表点「解析」生成词条，命中率才有意义</p>}
    </div>
  );
}