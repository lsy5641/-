# JobCoach 计划⑤：M9 AI 模拟追问（分支 feat/m9-mock-interview）

**Goal:** 面试题支持「模拟追问」：AI 以面试官身份对单题做多轮对话练习（点评 + 追问 + STAR 引导），聊天记录按题持久化。

**Architecture:** 复用 `mock_chats` 表（一题一行 messages JSON）。`routes/mock.ts` 提供读取/回复/重置；回复走既有 `ai/client.ts`（非流式，多轮上下文拼进 messages）。前端 `MockChat.tsx` 弹窗 + ExamPage 每题加按钮。

**偏差说明：** 设计文档写"流式"，本期做**非流式**（体验差别小、实现与测试更稳，后续可平滑升级 SSE）。

---

### Task 1: 后端（TDD）

**Files:** Create `server/src/routes/mock.ts`、`server/src/routes/mock.test.ts`；Modify `server/src/app.ts`

- [ ] 测试要点：GET 空历史；回复落库且二次调用带上历史；空消息 400；题目不存在 404；重置清空；无 key 502 中文
- [ ] 实现 `mockRouter(db)`：
  - `GET /:questionId` → `{ question: {id, question, hint, category}, messages }`
  - `POST /:questionId/reply {message}` → 追加 candidate，调用 AI（system 面试官 Prompt + 历史），追加 interviewer，返回 messages
  - `POST /:questionId/reset` → 清空该题消息
- [ ] app.ts: `app.use('/api/mock', mockRouter(db))`
- [ ] Commit

### Task 2: 前端

**Files:** Create `web/src/components/MockChat.tsx`；Modify `ExamPage.tsx`、`api.ts`、`styles.css`

- [ ] `MockChat`：头部题目 + 提示；气泡列表（面试官左、候选人右）；输入框 + 发送（busy）；清空重练
- [ ] ExamPage：每题 details 内加 `<button onClick={() => setChatQ(q)}>模拟追问</button>`；底部渲染 `{chatQ && <MockChat question={chatQ} onClose={...} />}`
- [ ] 样式：气泡/左右对齐/输入行固定
- [ ] typecheck + build + Commit

### Task 3: 验收

- [ ] `npm test`（预计 62+）全绿；typecheck/build
- [ ] 用户真实验收：③ 备考中心 → 生成备考包 → 任一题点「模拟追问」→ 回答两轮，看是否点评+追问
- [ ] 合并回 main 并推送