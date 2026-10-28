# JobCoach 求职助手（本地版）

一份"终身履历" + 每个岗位 JD 一键衍生定制简历 + AI 教练（STAR 改写）+ 备考中心（学习计划/面试预测题）。

当前进度：**M1~M8 完成**（履历+版本回退、素材库、AI 拆亮点、DeepSeek 接入、JD 提词条、推荐经历/组装定制简历/AI 教练改写），M9 模拟追问顺延。

## 三步开始使用（需要电脑已联网）

**最简单方式：双击项目文件夹里的 `start-jobcoach.bat`**，等浏览器自动打开 http://127.0.0.1:5173 即可（使用期间别关黑窗口，关掉即停止）。

### 第一次使用：接入 AI（DeepSeek）

1. 注册 https://platform.deepseek.com → 登录后点「API Keys」→ 创建并复制密钥（sk-开头）
2. 打开软件，点右上角 **⚙ 齿轮** → 点「DeepSeek」快捷按钮 → 粘贴你的密钥 → 点「保存」
3. 点「测试连接」，看到"连接成功 ✅"即可开始使用 AI 功能（解析 JD、AI 拆亮点）

> 密钥只存在你本机的 data/jobcoach.db 里，软件直接与你选的 AI 服务商通信，不经过任何第三方。

手动方式：

1. 确认装了 Node.js：命令行输入 `node --version` 有版本号即可（没有就去 https://nodejs.org/zh-cn 装 LTS 版）
2. 打开终端（PowerShell），进入本项目文件夹：`cd C:\vagent-workspace\jobcoach`
3. 首次使用先装依赖：`npm install`；以后每次使用只需：

```
npm run dev
```

然后浏览器打开 **http://127.0.0.1:5173** 即可使用。

- 停止：在运行终端按 `Ctrl+C`
- 你的所有数据存在 `data/jobcoach.db` 这一个文件里，复制它就是完整备份
- `npm test` 可随时重跑所有自动化测试（当前 13 个）

## 常见报错对照表

| 现象 | 原因与解决 |
|---|---|
| `node 不是内部或外部命令` | Node 未安装或装完没重开终端 → 装/重开 |
| `EADDRINUSE: port 3001/5173` | 上一次没退干净 → 关掉重复的终端窗口，或重启电脑 |
| 浏览器打不开 localhost:5173 | dev 没起来 → 看终端有没有红字报错 |
| 启动/测试出现 `ExperimentalWarning: SQLite` | Node 内置数据库的正常提示，可忽略 |
| `npm install` 网络失败 | 挂代理，或 `npm config set registry https://registry.npmmirror.com` 重试，成功后 `npm config delete registry` 换回 |

## JD 工作台三步用法

1. **① 个人履历**：先录好你的经历（每条 3~6 个亮点）
2. **② JD 工作台 → 粘贴 JD → 保存 → 点「解析」**（AI 提取要求要点与词条）→ 点卡片上的 **「打开」**
3. 弹窗里三步走：
   - **推荐经历**：点「AI 推荐匹配经历」，AI 给出匹配分数与理由，勾选要进简历的条目（也可手动勾选）
   - **定制简历**：点「重新计算关键词命中」看覆盖率与缺失词，点「导出定制简历 JSON」
   - **AI 教练**：对每个条目点「AI 按 JD 优化」，逐条采纳/拒绝；满意后「回填到母版履历」或「存素材库」

## 界面设计规范

视觉规范由 ui-ux-pro-max 生成，见 `design-system/jobcoach/MASTER.md`（Minimalism/Swiss · 海军蓝 #1E3A5F · Plus Jakarta Sans）。

## 安全提醒

- 项目目录里 `data/` 含你的个人信息与 AI 配置，**不要上传网盘共享或发给别人**
- AI 功能的 API Key 只存本机，后续接入 AI 设置页后请妥善保管

## 里程碑路线图

| 状态 | 内容 |
|---|---|
| ✅ M1 | 全栈骨架：一条命令启动 |
| ✅ M2 | 个人履历：增删改 + 每次保存留版本 + 一键恢复 |
| ✅ M3 | 素材库页签 + AI 流水账拆亮点 |
| ✅ M4 | DeepSeek 等 AI 接入 + JD 粘贴自动提取词条 + 词条库 |
| ✅ M5 | 推荐匹配经历 + 关键词命中高亮 + 组装定制简历 |
| ✅ M6 | AI 教练 STAR 逐条改写 + 采纳/回退/回填 |
| ✅ M7 | 备考中心：学习计划 + 面试预测题 + Markdown 导出 |
| ✅ M8 | 导出 Word/PDF + 全库备份恢复 |
| ⬜ M9 | AI 模拟追问 |
