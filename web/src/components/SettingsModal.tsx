import { useEffect, useState } from 'react';
import { api } from '../api';

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'DeepSeek': { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  'Kimi': { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  '智谱': { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  '通义千问': { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  'Ollama本地': { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:14b' },
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const [apiKey, setApiKey] = useState('');
  const [keyMask, setKeyMask] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: { ai: { baseUrl: string; model: string; temperature: number; keyMask: string } }) => {
      setBaseUrl(s.ai.baseUrl); setModel(s.ai.model); setTemperature(String(s.ai.temperature)); setKeyMask(s.ai.keyMask);
    }).catch(e => setMsg((e as Error).message));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setBusy(true); setMsg('');
    try {
      await api.saveSettings({ baseUrl, model, temperature: Number(temperature), apiKey });
      const s = await api.getSettings();
      setKeyMask(s.ai.keyMask); setApiKey('');
      setMsg('已保存 ✅');
    } catch (e) { setMsg('保存失败：' + (e as Error).message); } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMsg('正在连接…');
    try { const r = await api.testSettings(); setMsg(`连接成功 ✅ 模型回复：${r.reply}`); }
    catch (e) { setMsg('连接失败 ❌ ' + (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>AI 服务设置（DeepSeek 等）</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {Object.keys(PRESETS).map(p => (
            <button key={p} onClick={() => { setBaseUrl(PRESETS[p].baseUrl); setModel(PRESETS[p].model); }}>{p}</button>
          ))}
        </div>
        <p className="notice" style={{ fontSize: 12, margin: '2px 0 10px' }}>
          通义千问：在阿里云百炼控制台（bailian.console.aliyun.com）创建 API-KEY；模型可选 qwen-plus / qwen-max / qwen-turbo。
        </p>
        <label>Base URL <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} /></label>
        <label>API Key（{keyMask ? `已配置 ${keyMask}，留空则不修改` : '未配置'}）
          <input type="password" value={apiKey} placeholder={keyMask || 'sk-…'} onChange={e => setApiKey(e.target.value)} />
        </label>
        <label>模型名 <input value={model} onChange={e => setModel(e.target.value)} /></label>
        <label>温度(0~2) <input style={{ width: 70 }} value={temperature} onChange={e => setTemperature(e.target.value)} /></label>
        <div className="row">
          <button className="primary" onClick={save} disabled={busy}>{busy ? '…' : '保存'}</button>
          <button onClick={test} disabled={busy}>测试连接</button>
          <span className="wide" />
          <button onClick={onClose}>关闭</button>
        </div>
        <div className="row" style={{ marginTop: 12, borderTop: '1px dashed #ddd', paddingTop: 10, flexWrap: 'wrap' }}>
          <button onClick={async () => {
            try {
              const data = await api.backupAll();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `jobcoach-备份-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            } catch (e) { setMsg('备份失败：' + (e as Error).message); }
          }}>导出全库备份</button>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <span>恢复备份：</span>
            <input type="file" accept=".json" style={{ display: 'inline-block', width: 'auto' }} onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!confirm('恢复会覆盖当前全部数据（每次启动都会自动备份，可从 data/backups 找回）。确认恢复？')) return;
              try {
                const text = await f.text();
                await api.restoreAll(JSON.parse(text));
                setMsg('恢复完成 ✅ 请刷新页面');
              } catch (err) { setMsg('恢复失败：' + (err as Error).message); }
            }} />
          </label>
        </div>
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
