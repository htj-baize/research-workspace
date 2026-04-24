# Session Adapter Design

这份文档回答的是：

**业务方为什么不应该直接操作 runtime 的低层接口，以及 session adapter 应该承担什么职责。**

---

## 为什么需要 Session Adapter

即使 framework 已经有了：

- `decideNext()`
- `handleFeedback()`
- `executeSelection()`
- `overlay.buildExplanations()`

业务方如果直接调用这些接口，仍然会遇到几个问题：

- 要自己拼 sessionId / userId / surface
- 要自己决定什么时候拿 context
- 要自己把 feedback event、next decision、snapshot 拼成一条链
- 要自己把 runtime 与 overlay/context state 重新接起来

也就是说，业务方仍然在碰 runtime plumbing。

---

## Session Adapter 的职责

当前已经有一版 code-level adapter：

- [recommendation-session-adapter.ts](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/framework/adapters/recommendation-session-adapter.ts)

它把最常见的业务接入路径收成了：

- `next()`
- `feedback()`
- `execute()`
- `snapshot()`

---

## 它解决了什么

### 1. 固定 session scope

adapter 持有：

- `sessionId`
- `userId`
- `surface`
- `overlay`
- `contextState`

业务方不用每次重复传这些基础信息。

### 2. 串起反馈闭环

`feedback()` 内部会处理：

- 取 context
- 让 overlay 构造 `FeedbackEvent`
- 调 `runtime.handleFeedback()`
- 再跑下一轮 `next()`

所以业务拿到的是一个完整结果，而不是中间半成品。

### 3. 统一 snapshot

`snapshot()` 会把：

- current context
- session state
- session summary
- explanation rail

拼成更适合业务直接消费的对象。

---

## 为什么它比 demo server 更重要

demo server 只是一个展示层。

`RecommendationSessionAdapter` 才是更接近真实业务接入的形态，因为它回答了：

> 一个业务 surface 应该如何把 runtime、overlay、context state 组合起来。

---

## 当前结论

framework 往 SDK 方向推进时，adapter 层很关键，因为它把：

- runtime core
- overlay contract
- session scope
- snapshot / explanation

这些东西，收成了一个更接近业务日常接入的接口。
