# JobCoach 求职助手 — 设计文档

日期：2026-10-26（v2：按用户反馈重构为三界面）
状态：三界面结构已获用户确认，待最终审阅
项目目录：`C:\vagent-workspace\jobcoach\`（独立文件夹，与工作区其他文件隔离）

## 1. 产品概述

JobCoach 是一个**本地运行的单用户 Web 应用**（使用时联网调用云端大模型）。核心理念：

> **一份"终身履历"母版 + 每个 JD 一键衍生出定制简历**，并由 AI 教练（STAR 逻辑）、词条库、备考中心（学习计划+面试预测题）辅助拿到 offer。

整体只有 **3 个主界面**：

1. **个人履历**：持续迭代储存所有经历与话术素材，保留历史版本可回退
2. **JD 工作台**：粘贴 JD → 自动提词条 → 履历中推荐匹配经历 → AI 逐条 STAR 改写采纳 → 组装该职位定制简历并导出；附词条库
3. **备考中心**：针对选中的 JD 生成学习计划 + 面试预测题

AI 服务商（DeepSeek/Kimi/智谱/OpenAI/Ollama 等 OpenAI 兼容接口）通过右上角"设置"齿轮弹窗配置，不占独立页面。

用户是编程新手：交付物做到"一条命令启动、浏览器直接用"，全部命令、报错提示、README 中文。

### 明确不做（YAGNI）

- 多用户/账号/登录/云端部署
- 解析上传的 Word/PDF 旧简历（改为手动录入履历，AI 可辅助把流水账润色成 bullet）
- 简历多版式模板（MVP 单栏干净模板一套）
- 移动端适配（按桌面浏览器宽度）

## 2. 总体架构

```
jobcoach/
├── server/                 Express 后端（TypeScript）
│   ├── src/index.ts        入口：API 路由 + 静态文件托管
│   ├── src/db.ts           SQLite（better-sqlite3）建表与初始化
│   ├── src/routes/         profile / materials / jds / keywords / coach
│   │                       / plans / questions / settings / export / backup
│   └── src/ai/client.ts    LLM 统一封装（OpenAI 兼容 + SSE 转发 + JSON 修复）
├── web/                    React + Vite 前端（TypeScript）
│   ├── src/pages/ProfilePage.tsx      界面①个人履历（含素材库页签）
│   ├── src/pages/WorkbenchPage.tsx    界面②JD工作台（4步流水线 + 词条库页签）
│   ├── src/pages/ExamPage.tsx         界面③备考中心
│   └── src/components/SettingsModal   设置弹窗（右上角齿轮）
├── data/                   jobcoach.db（SQLite 单文件；备份时另存 jobcoach.backup.db）
└── package.json            npm run dev 一键同起前后端；npm start 生产模式
```

- 开发：`npm run dev` → Vite(5173)+Express(3001)，浏览器开 `http://localhost:5173`
- 日常：`npm run build && npm start` → `http://localhost:3001`。MVP 阶段以 dev 模式为主。
- 顶部导航固定：`个人履历 | JD工作台 | 备考中心` + "当前 JD"下拉 + 齿轮设置。

### 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + Vite + TypeScript | 分步流水线/逐条采纳交互成熟写法 |
| 后端 | Node.js + Express + TypeScript | 前后端同语言，全栈 TypeScript（方案A） |
| 数据库 | better-sqlite3 单文件 | 零安装，拷走 .db 即备份，本机单用户够用 |
| LLM | OpenAI 兼容协议（openai SDK） | 设置页填 Base URL+Key+模型名即可切 DeepSeek 等 |
| Word 导出 | docx 库（服务端生成 .docx） | 无需安装 Word/WPS |
| PDF 导出 | 定制简历"打印视图"+浏览器打印为PDF | 排版可控性最高，Windows 零重依赖 |
| 学习计划/题导出 | Markdown (.md) | 方便贴到笔记软件 |

## 3. 数据模型（SQLite）

所有表含 `id`(INTEGER PK)、`created_at`、`updated_at`（ISO 字符串）。

### 界面① 个人履历

**`profile_items` 履历条目**（"我做过的事"，终身维护，不属于任何简历/JD）
| 字段 | 说明 |
|---|---|
| section | work / project / education / skill / award |
| heading | 抬头，如"XX公司-后端开发工程师-2022.7~至今" |
| period | 起止时间文本（可空，如技能不需要） |
| bullets | JSON 数组，逐条亮点 |
| sort_order | 组内显示顺序（支持拖拽） |

**`profile_versions` 履历版本历史**（实现"一直迭代储存"）
| 字段 | 说明 |
|---|---|
| item_id | 对应条目 |
| snapshot | JSON：该次保存时 heading+bullets 全量快照 |
| trigger | manual / from_backfill（由JD回填产生）/ from_ai |

保存即建版本：每条目最多保留最近 50 版，超出裁剪最旧（防膨胀，见 §8）。履历页每条卡片有"历史版本"列表 → 任选一版预览/恢复。

**`materials` 话术素材库**（界面①的第二个页签）
| 字段 | 说明 |
|---|---|
| title, content | 素材标题与 STAR 完整段落文本 |
| tags | JSON 数组，如 ["高并发","带教","从0到1"] |
| source | manual / from_coach（采纳后沉淀）/ from_ai |

### 界面② JD 工作台

**`jds` 职位**（每个 JD = 一张工作台卡片）
| 字段 | 说明 |
|---|---|
| company, title | 公司、岗位 |
| raw_text | JD 原文（粘贴） |
| summary | JSON：AI 提取的要求要点/职责要点；另存 `analyzed` 标记是否已提取 |
| recommended | JSON：[{item_id, score(0-100), reason}]——AI 给履历的匹配推荐 |
| chosen_item_ids | JSON 数组：用户勾选入选组装的经历条目 id |
| overrides | JSON：{item_id: {bullets: [...]}} 逐条采纳改写后的定制版 bullet 覆盖层（只影响该 JD 的定制简历，不污染母版） |
| status | draft / assembled——是否已组装出定制简历 |

**`keywords` 词条库**（跨 JD 全局库）
| 字段 | 说明 |
|---|---|
| term | 词条，如 "Spring Boot" |
| category | hard_skill / soft_skill / business |
| note | 用户备注，如"出现在3个后端JD里" |

**`jd_keywords`**（JD 与词条的关系 + 频次）：`jd_id、keyword_id、frequency`（同名词条跨 JD 复用一条 keyword 记录，各自计数）

**`keyword_hits` 命中状态**（针对该 JD 已组装的定制简历计算）
| 字段 | 说明 |
|---|---|
| jd_id, keyword_id | — |
| status | hit（定制简历已覆盖）/ missing（缺失）/ ignored（忽略） |

**`coach_runs` AI 改写记录**
| 字段 | 说明 |
|---|---|
| jd_id, item_id | 针对哪条履历 |
| original_bullets | 改前 JSON 数组（留底，回退依据） |
| suggestions | JSON 数组：[{bullet_index, new_text, star_label, reason, status: pending/accepted/rejected}] |
| backfilled | 是否已一键回填母版 |

### 界面③ 备考中心

**`plans` 学习计划**
| 字段 | 说明 |
|---|---|
| jd_id | 针对 JD |
| weeks | JSON：[{week:1, focus:"...", tasks:[{text:"...", done:false}]}]（2~4 周，勾选即改 task.done） |

**`questions` 面试预测题**
| 字段 | 说明 |
|---|---|
| jd_id | 针对 JD |
| category | project_deep / tech / behavioral（STAR）/ hr |
| question, hint | 题干、答题提示 |
| based_on | 关联条目/素材 id（可空） |

**`mock_chats`（M9 追问）**：`question_id + messages JSON [{role, content}]`，流式追加。

### `settings`（全局键值）
`ai.base_url`(默认 `https://api.deepseek.com`)、`ai.api_key`、`ai.model`(默认 `deepseek-chat`)、`ai.temperature`。api key 只存本机 SQLite，设置页输入后掩码显示。

## 4. 界面与功能流程

### 4.1 界面①：个人履历
- 左侧按组展示条目卡片（工作/项目/教育/技能/荣誉），右为预览；卡片内逐条编辑 bullet，支持增删、拖拽；保存即产生新版本（trigger=manual）。
- 卡片"历史版本"：列出版本快照，预览 diff、恢复旧版（恢复也是一次新版本，不丢历史）。
- AI 辅助录入：粘贴一段工作流水账 → 调 LLM 拆成结构化 bullet（流式+JSON 修复）。
- 素材库页签：卡片列表（title/tags/content），同样支持版本；写 bullet 时可"从素材插入"。

### 4.2 界面②：JD 工作台（每张 JD 卡片四步流水线）
**Step1 粘贴并解析 JD**：保存 company/title/raw_text → 点"解析"，流式调用 LLM：产出 summary + 词条列表（含 category、frequency）。词条写入全局 `keywords`，关系与频次写 `jd_keywords`；详情页可手动修正（增删词条、改类目）。

**Step2 推荐匹配经历**：LLM 通读 `profile_items` + JD，输出 recommended 列表（条目得分+一句话理由+建议侧重哪几条 bullet）。复选勾选入选条目 → 写入 `chosen_item_ids`。

**Step3 AI 教练 STAR 改写**：对任一所选条目点"按 JD 优化"，生成逐条 suggestions+star_label+reason，存 `coach_runs`，逐条采纳/拒绝。采纳写入 `overrides`（只影响当前 JD，母版不动）。点"回填母版"→ 把采纳结果写入 `profile_items` 并新建 `profile_versions`(trigger=from_backfill)，同时可"沉淀为素材"。

**Step4 组装与导出**："生成定制简历预览"= chosen 条目 + overrides 合并渲染；调 `POST /api/jds/:id/match` 重算 `keyword_hits`（大小写归一、中英分别处理），预览区高亮命中（黄底）、右侧面板列 missing 并可标 ignored。导出入口：PDF(打印视图)/Word/JSON。

**词条库页签**：全局词条一览（按 category、按 JD 频次分组），手动增删改、合并异名词条。

### 4.3 界面③：备考中心（针对"当前 JD"下拉选中的职位）
- "生成备考包"：输入 = JD summary + missing 词条 + 定制简历全文；一次 SSE 调用产出：
  - `plans.weeks`：2~4 周计划，任务含"补写/补做某段项目""复习主题清单"
  - `questions`：≥15 题，四类分布；behavioral 题 hint 关联素材库标题
- 计划页：按周卡片，checkbox 勾选进度（写回 task.done）。
- 面试题页：类别筛选 + 折叠提示；M9 支持"模拟追问"多轮对话（`mock_chats` 流式）。
- 一键备考包导出 Markdown（计划+题目拼成一个 .md）；M7 完成前可先"复制为文本"。

### 4.4 导入导出汇总
| 功能 | 实现 |
|---|---|
| 单份定制简历导出 | PDF / Word(docx) / JSON（含引用条目快照，在 JD 卡片 Step4 操作） |
| 履历导出 | JSON（profile_items+materials） |
| 全库备份/恢复 | 单 JSON 文件导入导出；导入前 schema 校验 + 自动复制旧库为 `jobcoach.backup.db` |
| 备考包 | Markdown (.md) |

### 4.5 设置弹窗
- 表单：Base URL/API Key/模型名/温度；预置按键一键填 DeepSeek、Kimi、智谱、OpenAI；Ollama 填 `http://localhost:11434/v1`+模型名。
- 【测试连接】：极短 ping 请求，返回"成功/失败+HTTP原因中文化"（401→Key无效、429→限流、网络错→查联网/URL）。

## 5. 错误处理

1. API 统一 `{ok, data, error}`；前端全局 toast 中文错误。
2. LLM：超时(>120s 中断)+重试 1 次；流式中断保留已生成部分并提示可重试。
3. LLM JSON 不合法：带报错自动发起一次修复重问，仍失败提示"重试或换模型"。
4. 表单草稿自动存 localStorage，页面崩溃/刷新不丢正在编辑内容。
5. 写库失败回滚；版本历史只增不删（受 §8 上限保护），履历页永远可恢复。

## 6. 测试策略

- 单元测试(vitest)：词条归一匹配、overrides 合并逻辑、docx/JSON/md 导出、LLM JSON 修复、版本裁剪（保留最近50版）。
- 接口测试(supertest+临时空库)：profile CRUD+版本恢复、JD 流水线状态流转、match 计算、coach 采纳写回与母版隔离、备份导入前自动备份行为。
- LLM 全部 mock；DeepSeek 真实连通由设置页"测试连接"人工验收。
- 手工验收清单：录履历→改两版并回退→粘JD解析→勾选词条→推荐经历→STAR改写采纳→组装定制简历→高亮命中→导出Word/PDF/JSON→生成备考包→勾任务→导出md→全库备份+恢复。

## 7. 里程碑

| 阶段 | 内容 | 可演示效果 |
|---|---|---|
| M1 | 目录/依赖/启动脚本/建空库/空导航壳 | `npm run dev` 打开 localhost:5173 |
| M2 | 界面①履历 CRUD+历史版本/恢复 | 录入我的全部经历，随时改、秒回旧版 |
| M3 | 素材库页签 + AI 流水账转 bullet | 话术积累；乱文本贴进去出结构化 bullets |
| M4 | 设置弹窗 + DeepSeek 接通 + JD 解析提词条 + 词条库页签 | 粘 JD 自动出现词条分类与频次 |
| M5 | 推荐匹配经历 + 勾选组装 + keyword 命中高亮/覆盖率 + 定制简历 JSON 导出 | 选完即可看定制简历雏形 |
| M6 | AI 教练 STAR 逐条改写 + 采纳/拒绝 + overrides + 回填母版 | 完整教练闭环 |
| M7 | 备考中心：学习计划+预测题+勾选进度+Markdown 导出 | 一键出备考包 |
| M8 | 定制简历导出 Word(docx) + PDF 打印视图 + README | 可投递真实公司的完整 MVP |
| M9 | 模拟追问（mock_chats 多轮流式） | 加分项 |

## 8. 已知风险与对策

1. **LLM 输出 JSON 漂移** → 统一 prompt 规范 + 修复重问通道；所有 AI 功能共用 `ai/client.ts` 一处约束。
2. **版本快照膨胀** → 每条目保留上限 50 版（`profile_versions` 裁剪最旧）；全库 .db 单文件，整库拷贝即物理备份。
3. **overrides 与母版不一致的困惑** → 定制预览卡片标注"（本 JD 专用改写×N）"，并提供"回填到履历"消除差异。
4. **中文 PDF 依赖打印窗口** → 按钮文案写"打开打印视图（另存为PDF）"，README 演示步骤。
5. **api key 本机明文存储** → 单用户本机可接受；README 警告不要上传/共享项目目录（含 data/）。
6. **新手排错难** → 所有错误中文化；README 含"常见报错对照表"（node 未装/端口占用/Key 失效/断网）。
