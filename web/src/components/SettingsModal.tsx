import { useEffect, useState } from 'react';
import { api } from '../api';

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  'DeepSeek': { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  'Kimi': { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  '智谱': { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  '通义': { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
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
        {msg && <p>{msg}</p>}
      </div>
    </div>
  );
}
