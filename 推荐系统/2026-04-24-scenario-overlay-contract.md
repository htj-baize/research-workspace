# Scenario Overlay Contract

这份文档回答的是：

**当 framework 要打包成 SDK 给业务方使用时，哪些点应该允许业务覆盖，哪些点必须留在 runtime core。**

---

## 为什么需要 Overlay Contract

如果不定义 overlay contract，业务很容易把这些逻辑重新散落到各处：

- 候选文案模板
- feed / quest / task assistant 的反馈事件格式
- explanation rail 的文案解释
- 某些场景特有的 metadata 映射

这样 framework 很快会变成：

- 一半是 core protocol
- 一半是 demo 和场景代码

更合理的方式是：

- core 负责稳定 runtime 语义
- overlay 负责场景级覆盖

---

## 当前 code-level contract

现在 framework 里已经有一版最小 contract：

- [recommendation-runtime-overlay.ts](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/framework/core/recommendation-runtime-overlay.ts)

核心接口是：

```ts
interface ScenarioOverlay {
  name: string;
  candidateTemplates?: CandidateTemplateMap;
  buildFeedbackEvent(input: OverlayFeedbackInput): FeedbackEvent;
  buildExplanations?(input: OverlayExplanationInput): string[] | Promise<string[]>;
}
```

---

## 哪些属于 core

这些应该留在 framework：

- `Context / Intent / Opportunity / Action / Outcome`
- `FeedbackEvent / FeedbackSignal / StateProjection`
- `handleFeedback()`
- retrieval / candidate / policy / context state 的基础链路
- session compression / memory promotion

这些东西定义的是 runtime 的公共语义。

---

## 哪些属于 overlay

这些更适合业务或场景自己覆盖：

### 1. Candidate templates

例如：

- `social-feed` 里 `explore -> For You`
- `research-flow` 里 `recover_flow -> Recover`
- `quest` 里 `deepen_current_object -> Deepen`

这些是产品语言，不应该硬编码进 core。

### 2. Feedback event mapping

例如：

- feed 的 `dismiss / like / save / watch`
- quest 的 `continue / confirm / pay / reject`
- assistant 的 `clarify / refine / run_tool`

这些动作虽然都能落进 `FeedbackEvent`，但事件构造方式是场景相关的。

### 3. Explanation synthesis

比如：

- feed 想强调“你刚划走了什么，所以这轮更保守”
- task assistant 想强调“你刚明确了目标，所以系统按新 goal 重排”
- quest 想强调“你刚继续了一条线，所以这轮更偏 deepen/escalate”

解释文案本质上是产品体验层，不适合塞进 core。

---

## 当前 demo 怎么用这份 contract

现在 `demos/runtime/scenario-overlays.mjs` 已经在实现它：

- `social-feed`
- `research-flow`

并且 `web-sdk-server.mjs` 已经不再直接硬编码：

- candidate 模板
- feedback event 构造
- explanation 文案

而是通过 scenario overlay 读取这些覆盖点。

---

## 当前结论

framework SDK 继续演进时，最重要的纪律是：

> runtime core 只定义公共语义，场景差异通过 overlay contract 注入。

这样业务方拿到 SDK 后，就不会被迫 fork core，只需要实现自己的 overlay。
