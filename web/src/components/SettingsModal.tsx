import { useEffect, useState } from 'react';
import { api } from '../api';

type Protocol = 'openai' | 'anthropic';

interface Preset { protocol: Protocol; baseUrl: string; model: string; hint: string }

const PRESETS: Record<string, Preset> = {
  'DeepSeek': {
    protocol: 'openai', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat',
    hint: '在 platform.deepseek.com 创建 API Key。模型可选 deepseek-chat（通用）/ deepseek-reasoner（推理）。',
  },
  'Kimi': {
    protocol: 'openai', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k',
    hint: '在 platform.moonshot.cn 创建 API Key。模型可选 moonshot-v1-8k / 32k / 128k。',
  },
  '智谱': {
    protocol: 'openai', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash',
    hint: '在 open.bigmodel.cn 创建 API Key。模型可选 glm-4-flash（免费/便宜）/ glm-4-plus。',
  },
  '通义千问': {
    protocol: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus',
    hint: '在阿里云百炼控制台（bailian.console.aliyun.com）创建 API-KEY。模型可选 qwen-plus / qwen-max / qwen-turbo。',
  },
  'ChatGPT': {
    protocol: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini',
    hint: '在 platform.openai.com 创建 API Key（需可用支付方式）。模型可选 gpt-4o-mini（便宜）/ gpt-4o（更强）。',
  },
  'Claude': {
    protocol: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-5',
    hint: '在 console.anthropic.com 创建 API Key；本软件已适配 Anthropic 原生协议。模型可选 claude-sonnet-4-5 / claude-opus-4-1 / claude-haiku-4-5。',
  },
  'OpenRouter': {
    protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'anthropic/claude-sonnet-4.5',
    hint: '一个 Key 用多家模型（含 GPT / Claude），在 openrouter.ai 创建。模型名用「供应商/模型」格式。',
  },
  'Ollama本地': {
    protocol: 'openai', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:14b',
    hint: '本机安装 Ollama 并先执行 ollama pull qwen2.5:14b；API Key 随便填 local 即可。',
  },
};

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [protocol, setProtocol] = useState<Protocol>('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState('0.7');
  const [apiKey, setApiKey] = useState('');
  const [keyMask, setKeyMask] = useState('');
  const [activePreset, setActivePreset] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then((s: { ai: { protocol: Protocol; baseUrl: string; model: string; temperature: number; keyMask: string } }) => {
      setProtocol(s.ai.protocol ?? 'openai');
      setBaseUrl(s.ai.baseUrl); setModel(s.ai.model); setTemperature(String(s.ai.temperature)); setKeyMask(s.ai.keyMask);
    }).catch(e => setMsg((e as Error).message));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function applyPreset(name: string) {
    const p = PRESETS[name];
    setActivePreset(name);
    setProtocol(p.protocol);
    setBaseUrl(p.baseUrl);
    setModel(p.model);
  }

  async function save() {
    setBusy(true); setMsg('');
    try {
      await api.saveSettings({ protocol, baseUrl, model, temperature: Number(temperature), apiKey });
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

  const hint = activePreset ? PRESETS[activePreset].hint : '先点一个服务商快捷按钮会自动填好地址与模型；也可以手动填写任意兼容 OpenAI 协议的服务。';

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>AI 服务设置</h3>

        <div className="row" style={{ flexWrap: 'wrap', marginTop: 10 }}>
          {Object.keys(PRESETS).map(name => (
            <button key={name} className={activePreset === name ? 'primary' : ''} onClick={() => applyPreset(name)}>{name}</button>
          ))}
        </div>

        <p className="notice" style={{ fontSize: 12, margin: '2px 0 10px' }}>{hint}</p>

        <label>接口协议
          <select value={protocol} onChange={e => setProtocol(e.target.value as Protocol)}>
            <option value="openai">OpenAI 兼容（DeepSeek / Kimi / 千问 / 智谱 / ChatGPT / OpenRouter / Ollama）</option>
            <option value="anthropic">Anthropic 原生（Claude）</option>
          </select>
        </label>

        <label>Base URL
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com" />
        </label>

        <label>API Key（{keyMask ? `已配置 ${keyMask}，留空则不修改` : '未配置'}）
          <input type="password" value={apiKey} placeholder={keyMask || 'sk-…'} onChange={e => setApiKey(e.target.value)} />
        </label>

        <label>模型名
          <input value={model} onChange={e => setModel(e.target.value)} placeholder="deepseek-chat" />
        </label>

        <label>温度(0~2)
          <input style={{ width: 90 }} value={temperature} onChange={e => setTemperature(e.target.value)} />
        </label>

        <div className="row">
          <button className="primary" onClick={save} disabled={busy}>{busy ? '…' : '保存'}</button>
          <button onClick={test} disabled={busy}>测试连接</button>
          <span className="wide" />
          <button onClick={onClose}>关闭</button>
        </div>
        {msg && <p>{msg}</p>}

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
      </div>
    </div>
  );
}