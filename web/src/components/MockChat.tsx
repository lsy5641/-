import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { ExamQuestion } from '../types';

interface Msg { role: 'interviewer' | 'candidate'; content: string }

export default function MockChat({ question, onClose, onError }: { question: ExamQuestion; onClose: () => void; onError: (m: string) => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.mockGet(question.id).then((r) => setMessages(r.messages)).catch((e) => onError((e as Error).message));
  }, [question.id]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput(''); setBusy(true);
    setMessages([...messages, { role: 'candidate', content: text }]);
    try { const r = await api.mockReply(question.id, text); setMessages(r.messages); }
    catch (e) { onError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!confirm('清空本题的对话记录？')) return;
    try { const r = await api.mockReset(question.id); setMessages(r.messages); }
    catch (e) { onError((e as Error).message); }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h3 className="wide">模拟面试 · {question.question}</h3>
          <button onClick={onClose}>关闭</button>
        </div>
        {question.hint && <p className="hint" style={{ margin: '0 0 8px' }}>答题提示：{question.hint}</p>}
        <div className="chat-box" ref={boxRef}>
          {messages.length === 0 && <p style={{ color: '#888' }}>先写下你的回答（越具体越好），AI 面试官会点评并继续追问。</p>}
          {messages.map((m, i) => (
            <div key={i} className={'msg ' + m.role}>
              <div className="bubble">
                <div className="who">{m.role === 'interviewer' ? 'AI 面试官' : '我'}</div>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="msg interviewer"><div className="bubble">面试官思考中…</div></div>}
        </div>
        <div className="chat-input">
          <textarea rows={2} className="wide" placeholder="输入你的回答，Enter 发送（Shift+Enter 换行）" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="primary" onClick={send} disabled={busy || !input.trim()}>发送</button>
          <button onClick={reset}>清空重练</button>
        </div>
      </div>
    </div>
  );
}