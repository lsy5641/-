import fs from 'node:fs';

const table = `| 服务商 | 协议 | Base URL | 模型示例 |
|---|---|---|---|
| DeepSeek | OpenAI 兼容 | https://api.deepseek.com | deepseek-chat |
| Kimi | OpenAI 兼容 | https://api.moonshot.cn/v1 | moonshot-v1-8k |
| 智谱 | OpenAI 兼容 | https://open.bigmodel.cn/api/paas/v4 | glm-4-flash |
| 通义千问 | OpenAI 兼容 | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen-plus |
| ChatGPT | OpenAI 兼容 | https://api.openai.com/v1 | gpt-4o-mini / gpt-4o |
| Claude | **Anthropic 原生** | https://api.anthropic.com | claude-sonnet-4-5 |
| OpenRouter | OpenAI 兼容 | https://openrouter.ai/api/v1 | anthropic/claude-sonnet-4.5 |
| Ollama 本地 | OpenAI 兼容 | http://localhost:11434/v1 | qwen2.5:14b |

> 密钥只存本机数据库；软件直连你选择的服务商。**Claude 要选「Anthropic 原生」协议**（点 Claude 快捷按钮会自动切换）；其余服务商都用「OpenAI 兼容」。`;

// README
let r = fs.readFileSync('README.md', 'utf8');
const oldLine = '> 密钥只存本机数据库；软件直连你选择的服务商（DeepSeek / Kimi / 智谱 / 通义 / Ollama）。';
if (r.includes(oldLine)) {
  r = r.replace(oldLine, table);
  fs.writeFileSync('README.md', r);
  console.log('README updated');
} else {
  console.log('README marker not found');
}

// 桌面版说明 md
let m = fs.readFileSync('docs/桌面版使用说明.md', 'utf8');
const mdAnchor = '> 支持其它兼容 OpenAI 协议的服务：Kimi、智谱、通义、本地 Ollama（在设置里改 Base URL + 模型名即可）。';
const mdNew = `### 支持的服务商

${table}

> 在设置里点对应快捷按钮会自动填好「接口协议 + Base URL + 模型名」，只需粘贴各自的 API Key。`;
if (m.includes(mdAnchor)) {
  m = m.replace(mdAnchor, mdNew);
  fs.writeFileSync('docs/桌面版使用说明.md', m);
  console.log('desktop md updated');
} else {
  console.log('desktop md marker not found');
}

// 桌面版说明 txt
let t = fs.readFileSync('桌面版使用说明.txt', 'utf8');
const txtAnchor = `也支持 Kimi、智谱、通义、本地 Ollama 等兼容 OpenAI 协议的服务
（设置里改 Base URL 与模型名即可）。
密钥只保存在你本机，软件直接与 AI 服务商通信，不经过第三方。`;
const txtNew = `支持的服务商（设置里点快捷按钮会自动填好协议/地址/模型）：

  DeepSeek     OpenAI 兼容  https://api.deepseek.com                              deepseek-chat
  Kimi         OpenAI 兼容  https://api.moonshot.cn/v1                            moonshot-v1-8k
  智谱         OpenAI 兼容  https://open.bigmodel.cn/api/paas/v4                   glm-4-flash
  通义千问     OpenAI 兼容  https://dashscope.aliyuncs.com/compatible-mode/v1      qwen-plus
  ChatGPT      OpenAI 兼容  https://api.openai.com/v1                             gpt-4o-mini
  Claude       Anthropic    https://api.anthropic.com                             claude-sonnet-4-5
  OpenRouter   OpenAI 兼容  https://openrouter.ai/api/v1                          anthropic/claude-sonnet-4.5
  Ollama 本地  OpenAI 兼容  http://localhost:11434/v1                             qwen2.5:14b

注意：Claude 必须把「接口协议」选成 Anthropic 原生（点 Claude 按钮会自动切换），
其余服务商都用「OpenAI 兼容」。
密钥只保存在你本机，软件直接与 AI 服务商通信，不经过第三方。`;
if (t.includes(txtAnchor)) {
  t = t.replace(txtAnchor, txtNew);
  fs.writeFileSync('桌面版使用说明.txt', t);
  console.log('desktop txt updated');
} else {
  console.log('desktop txt marker not found');
}