# JobCoach 求职助手 — 设计文档

日期：2026-10-26
状态：已与用户确认功能效果，待最终审阅
项目目录：`C:\vagent-workspace\jobcoach\`（独立文件夹，与工作区其他文件隔离）

## 1. 产品概述

JobCoach 是一个**本地运行的单用户 Web 应用**，面向个人求职场景，核心能力：

1. 结构化编辑简历，并按不同公司 JD 维护关键词命中与个人话术素材，支持导入导出
2. AI 教练：根据 JD 用 STAR 逻辑改写简历经历，逐条建议、用户采纳/拒绝
3. 根据 JD 自动生成学习计划 + 面试预测题
4. 接入 DeepSeek 等大模型（通用 OpenAI 兼容接口），使用时需联网调用云端模型；也可配置切换其他服务商

用户是编程新手：交付物必须做到"一条命令启动、浏览器直接用"，所有命令、报错提示、README 均以中文书写。

### 明确不做（YAGNI）

- 多用户/账号/登录/云端部署
- 解析上传的 Word/PDF 旧简历（准确率低，投入产出比差）
- 简历多版式模板系统（MVP 只做一个干净的单栏模板）
- 移动端适配（按桌面浏览器宽度设计）

## 2. 总体架构

```
jobcoach/
├── server/                 Express 后端（TypeScript）
│   ├── src/index.ts        入口：API 路由 + 静态文件托管
│   ├── src/db.ts           SQLite（better-sqlite3）建表与初始化
│   ├── src/routes/         resumes / jds / keywords / materials / plans / questions / ai / settings / export
│   └── src/ai/client.ts    LLM 统一封装（OpenAI 兼容协议 + SSE 流式转发 + JSON 解析修复）
├── web/                    React + Vite 前端（TypeScript）
│   └── src/                页面：简历编辑 / JD 管理 / 词条库 / 素材库 / 学习计划 / 面试题 / 设置
├── data/                   jobcoach.db（SQLite 单文件，运行时生成）
└── package.json            npm run dev 一键同起前后端；npm start 生产模式
```

- 开发模式：`npm run dev` 并用时启动 Vite(5173) 与 Express(3001)，Vite 代理 `/api` 到后端；浏览器开 `http://localhost:5173`
- 生产/日常使用：`npm run build` 后 `npm start`，Express 同时托管前端静态资源与 API，开 `http://localhost:3001`
- MVP 阶段以开发模式为主，生产模式仅做打包验证。

### 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| 前端 | React 18 + Vite + TypeScript | 生态成熟，结构化表单/逐条采纳交互好写，热更新快 |
| 后端 | Node.js + Express + TypeScript | 与前端同语言，由 AI 代写代码时心智负担最低 |
| 数据库 | better-sqlite3（单文件 `data/jobcoach.db`） | 零安装、可整文件拷走即备份，本地同步 API 简单可靠 |
| LLM | OpenAI 兼容协议（`openai` npm SDK） | DeepSeek/Kimi/智谱/OpenAI/Ollama 均可通过 baseUrl+key+model 切换 |
| Word 导出 | `docx` npm 库 | 服务端生成 .docx，无需 Word/WPS |
| PDF 导出 | 前端打印视图 + 浏览器"打印→另存为 PDF" | 排版可控性最高，国内 HR 通用做法，避免 Windows 无头浏览器重依赖 |

## 3. 数据模型（SQLite）

所有表含 `id`(INTEGER PK)、`created_at`、`updated_at`（ISO 字符串）。

### `resumes` 简历主体
| 字段 | 说明 |
|---|---|
| title | 简历名，如"后端开发-通用版" |
| target_role | 目标岗位 |
| basic_info | JSON：姓名/电话/邮箱/城市/求职意向等 |
| current_jd_id | 当前针对的 JD（可为空） |
| is_active | 是否当前主简历（全库仅一份为 1） |

### `resume_items` 简历条目（经历/项目/教育/技能的行内容）
| 字段 | 说明 |
|---|---|
| resume_id | 所属简历 |
| section | work / project / education / skill |
| heading | 条目抬头，如"XX公司-后端开发-2022.7~至今" |
| bullets | JSON 数组，每条是一个亮点 bullet 字符串 |
| sort_order | 显示顺序 |

### `jds` 职位
| 字段 | 说明 |
|---|---|
| company, title | 公司、岗位 |
| raw_text | JD 原文（粘贴文本） |
| summary | JSON：AI 提取的技能要求/职责要点 |
| analyzed | 是否已做关键词提取 |

### `keywords` 词条库
| 字段 | 说明 |
|---|---|
| term | 词条，如 "Spring Boot" |
| category | hard_skill / soft_skill / business |
| source_jd_id | 来源 JD（可空=手动添加） |
| frequency | 在来源 JD 中的出现频次 |
| note | 用户备注 |

### `keyword_hits` JD 与命中关系
| 字段 | 说明 |
|---|---|
| resume_id, jd_id, keyword_id | 一次匹配 = 某简历在某 JD 下的某词条状态 |
| status | hit（简历已覆盖）/ missing（缺失）/ ignored（忽略） |

### `materials` 话术素材库
| 字段 | 说明 |
|---|---|
| title, content | 素材标题、可复用段落 |
| tags | JSON 数组，如 ["高并发","带教"] |
| source | manual / from_coach（AI 采纳后沉淀） |

### `coach_runs` AI 改写记录
| 字段 | 说明 |
|---|---|
| resume_id, jd_id | — |
| item_id | 针对的简历条目 |
| original_bullets | 改前 JSON 数组（留底，可回退） |
| suggestions | JSON 数组：[{bullet_index, new_text, star_label(S/T/A/R补全说明), reason, status: pending/accepted/rejected}] |

### `plans` 学习计划
| 字段 | 说明 |
|---|---|
| jd_id | 针对 JD |
| weeks | JSON：[{week:1, focus:"...", tasks:[{text:"...",done:false}]}]（2~4 周，勾选状态存于 task.done） |

### `questions` 面试预测题
| 字段 | 说明 |
|---|---|
| jd_id | 针对 JD |
| category | project_deep(项目深挖)/ tech(技术)/ behavioral(STAR行为题)/ hr |
| question, hint | 题干、答题提示 |
| based_on | 关联的简历条目/素材（可空） |

### `settings` 键值表（AI 配置）
键：`ai.base_url`（默认 `https://api.deepseek.com`）、`ai.api_key`、`ai.model`（默认 `deepseek-chat`）、`ai.temperature`。
api key 存本机 SQLite，仅在本机使用、不会出现在任何前端列表页（设置页输入后以掩码显示）。

## 4. 功能流程设计

### 4.1 简历编辑 + JD 词条匹配
1. 编辑页左侧按 section 分组填表：条目卡片可增删、拖拽排序，每张卡片内逐条编辑 bullet；右侧实时预览最终简历版式。
2. 下拉选择"针对的 JD"（来自 JD 管理页粘贴的 JD）。
3. 选中后调用 `POST /api/match`：后端将 JD 的 keywords 与简历全文做大小写归一化匹配（中英分别处理），更新 `keyword_hits` 并返回：覆盖率%、已命中列表、缺失列表。
4. UI：预览区高亮命中词条（黄底）；右侧面板列出缺失词条，点"加入写作提醒"可锁定高亮该位置需要补写。
5. 手动词条：词条库页可手动增删改词条与分类。

### 4.2 AI 教练（STAR 改写）
1. 入口：简历条目卡片上点"AI 按 JD 优化此条"，弹窗选择目标 JD。
2. 后端流式调用 LLM（SSE 到前端，实时显示生成过程），系统提示词内置 STAR 规范与"输出必须是 JSON"约束。
3. 返回每条 bullet 的改写建议 + star 标签 + 修改理由，存入 `coach_runs`。
4. UI 逐条对比"原文 vs 建议"，点【采纳】/【拒绝】；采纳写入 `resume_items.bullets`，原文保留在 `coach_runs.original_bullets`，条目卡片有"查看历史版本/回退"。
5. 采纳后的优质 bullet 可一键"存入素材库"。
6. AI 输出的 JSON 不合法时：自动发起一次带报错信息的修复重问；仍失败则提示"模型输出异常，可重试或换模型"。

### 4.3 JD 分析与词条入库
1. JD 管理页粘贴文本保存 → 自动调用 LLM 提取：技能要求要点、职责要点、词条列表（含分类与频次）。
2. `summary` 与 `keywords` 分别入库，同名词条跨 JD 合并计数；提取结果可在 JD 详情页手动修正。

### 4.4 学习计划 + 面试预测题
1. 从 JD 详情页点"生成备考包"，后端用（JD summary + 缺失词条 + 当前简历）调 LLM 一次生成：
   - `plans.weeks`：2~4 周计划，按周聚焦 + 任务清单（含"补做某项目/复习某主题"）
   - `questions`：≥15 题，四类分布（项目深挖/技术/STAR 行为题/HR），每题带答题提示，行为题提示关联个人素材库标题
2. 学习计划页：按周卡片展示，任务可勾选（进度存本地 JSON 字段）。
3. 面试题页：按类别筛选；M8 阶段点"AI 模拟追问"可就单题展开多轮流式问答（新增 `mock_chats` 表：question_id + messages JSON），M7 前该按钮不出现。
4. "导出"按钮 → Markdown 文件（.md）。

### 4.5 导入导出
| 功能 | 实现 |
|---|---|
| 单份简历导出 JSON | 含条目、coach 历史，可整体删除/恢复 |
| 全库导出/导入 JSON | 导出为单文件；导入前弹窗确认 + 自动把旧库复制为 `jobcoach.backup.db` |
| 导出 Word | 服务端 `docx` 按单栏模板生成，含姓名头部、分节标题、bullet 列表 |
| 导出 PDF | "打印视图"路由（干净排版、隐藏操作按钮），浏览器打印为 PDF |

### 4.6 AI 服务商配置（设置页）
- 表单：Base URL、API Key、模型名、温度；预置快捷按钮一键填入 DeepSeek/Kimi/智谱/OpenAI 官方地址；本地 Ollama 可用 `http://localhost:11434/v1`。
- 【测试连接】：发一次极短 ping 请求，显示"连接成功/失败+HTTP错误原因"。
- Key 有效性：调用失败时把 HTTP 状态翻译成中文提示（401→"Key 无效或过期"，429→"配额限流，稍后再试"，网络错误→"请检查联网/URL"）。

## 5. 错误处理

1. 所有 API 统一返回 `{ok, data, error}`；前端全局 toast 显示中文错误。
2. LLM 请求超时（>120s 中断）、重试 1 次；流式中断时保留已生成部分并提示可重试。
3. 写库操作失败回滚且不清空前端已编辑内容（表单草稿存 localStorage，崩溃恢复）。
4. 导入 JSON 前用 schema 校验，不合法拒绝导入。

## 6. 测试策略

- 单元测试（vitest）：词条匹配归一化、docx/JSON 导出结果、LLM JSON 修复解析、`is_active` 唯一约束辅助函数。
- 后端接口测试（supertest + 临时空库）：resumes CRUD、match 计算、coach 采纳写回、导入备份行为。
- LLM 全部 mock，不发真实请求；DeepSeek 真实连通性由设置页"测试连接"人工验收。
- 验收清单（手工过一遍）：新建简历→粘贴JD→提取词条→高亮命中→AI改写并采纳→回退→导出Word/PDF/JSON→重导入→生成学习计划与面试题→勾选进度→模拟追问一轮。

## 7. 里程碑（先跑通骨架，再逐块长肉）

| 阶段 | 内容 | 可演示效果 |
|---|---|---|
| M1 骨架 | 目录/依赖/启停脚本/建库/前后端空页面 | `npm run dev` 能打开首页 |
| M2 简历核心 | 结构化 CRUD + 实时预览 + JSON 导入导出 | 能写一份完整的结构化简历 |
| M3 JD+词条 | JD 粘贴入库、手动词条、匹配高亮/覆盖率 | 选 JD 后简历关键词命中/缺失可视化 |
| M4 AI 接入 | 设置页 + 测试连接 + JD 智能提取词条 | DeepSeek Key 填上即自动解析 JD |
| M5 AI 教练 | STAR 流式改写、逐条采纳、留底回退、素材沉淀 | AI 优化简历全流程 |
| M6 备考包 | 学习计划 + 面试预测题 + Markdown 导出 | 一键生成备考包 |
| M7 导出打磨 | Word/PDF 导出 + 全库备份导入 + README | 可交付真实使用的完整 MVP |
| M8 | AI 模拟追问（多轮聊天） | 加分项 |

## 8. 已知风险与对策

1. **LLM 输出不稳定**（JSON 格式漂移）→ 统一走"解析失败带错重问一次"的修复通道；M4 起每个 prompt 都用固定 schema 约束。
2. **中文 PDF 导出依赖浏览器打印**而非真"按钮直出文件" → UI 文案诚实标注"将打开打印窗口"，README 演示操作步骤。
3. **新手排错难** → 后端错误一律带中文原因写入控制台与 toast；README 提供"常见报错对照表"。
4. **api key 存本机明文 SQLite** → 仅本机单用户场景可接受；README 提示不要将项目目录（含 data/）上传/共享，未来加导出加密不在本期范围。
