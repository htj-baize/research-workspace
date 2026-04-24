# Feedback Protocol

这份文档回答一个已经在 demo 中暴露出来的核心问题：

**用户行为如何被标准化、如何映射成 state signal、以及哪些信号可以进入长期状态。**

---

## 为什么要单独定义 Feedback Protocol

只要 recommendation runtime 开始处理真实交互，就会遇到三个完全不同的层：

1. `raw event`
   - 用户实际做了什么
2. `interpreted signal`
   - 系统认为这个行为意味着什么
3. `state update`
   - 这个信号应该如何写进 session / working / durable

如果这三层不分开，系统会出现两个典型问题：

- 把系统内部判断误写成用户反馈
- 把一次性行为过早写成长期偏好

---

## 三层对象

### 1. FeedbackEvent

用户或系统刚刚发生的原始行为。

```ts
type FeedbackEvent = {
  id: string;
  actor: "user" | "system";
  action:
    | "dismiss"
    | "focus"
    | "open"
    | "like"
    | "save"
    | "watch"
    | "clarify";
  targetRef: string;
  timestampMs: number;
  metadata?: Record<string, unknown>;
};
```

这层尽量贴近事实，不做太多推理。

### 2. FeedbackSignal

系统对行为的解释。

```ts
type FeedbackSignal = {
  kind:
    | "negative_interest"
    | "positive_interest"
    | "focus_shift"
    | "goal_refinement"
    | "high_intent_engagement";
  key?: string;
  strength?: number;
  confidence?: number;
  sourceEventId: string;
};
```

例子：

- `dismiss(luxury-haul)` -> `negative_interest(luxury-haul)`
- `watch(shanghai-citywalk)` -> `positive_interest(shanghai-citywalk)`
- `clarify("不要先搜论文")` -> `goal_refinement`

### 3. StateProjection

信号如何落到 state 上。

```ts
type StateProjection = {
  target: "session" | "working" | "durable";
  operation: "set" | "append" | "merge" | "remove";
  path: string;
  value: unknown;
  reason: string;
  sourceSignalKinds: string[];
};
```

---

## 推荐的写入纪律

### 用户反馈进入 `session`

例如：

- `dismiss(luxury-haul)` -> `session.rejectedPatterns += ["luxury-haul"]`
- `like(office-ootd)` -> `session.acceptedPatterns += ["office-ootd"]`
- `save(citywalk-post)` -> `session.acceptedPatterns += ["shanghai-citywalk"]`

### 系统判断进入 `working`

例如：

- `recover_flow`
- `explore`
- `deepen_current_object`

这些是系统解释，不应该被直接写成用户 rejection / preference。

### 只有稳定信号才 promotion 到 `durable`

例如：

- 同一主题多次被 watch / like / save
- 多个 session 中重复出现
- 明确的长期偏好信号

---

## 一个现实例子：内容 feed

### 错误写法

```text
用户 dismiss 一条奢侈品内容
-> 系统判断进入 recover_flow
-> session.rejectedPatterns += ["recover_flow"]
```

问题：

- `recover_flow` 是系统状态，不是用户讨厌的内容主题。

### 正确写法

```text
用户 dismiss 一条奢侈品内容
-> FeedbackSignal = negative_interest("luxury-haul")
-> session.rejectedPatterns += ["luxury-haul"]
-> working.intent = "recover_flow"
```

这样：

- 用户反馈和系统策略被明确分开。

---

## 框架层建议

未来 SDK 里建议单独增加一层：

```ts
interface FeedbackInterpreter {
  interpret(event: FeedbackEvent): Promise<FeedbackSignal[]>;
}

interface FeedbackProjector {
  project(signals: FeedbackSignal[]): Promise<StateProjection[]>;
}
```

然后 runtime 链路变成：

```text
event
-> feedback interpretation
-> state projection
-> session / working update
-> next recommendation pass
```

当前 `framework/` 里已经落了第一版 reference code：

- `framework/core/recommendation-runtime-feedback.ts`
- `framework/runtime/default-feedback-services.ts`
- `framework/runtime/in-memory-recommendation-runtime.ts`

其中 `InMemoryRecommendationRuntime.handleFeedback()` 已经把这条链打通。

---

## 更细的 extension points

现在默认 feedback 实现已经不是一整块硬编码，而是拆成了可组合规则：

- `FeedbackKeyResolver`
- `FeedbackSignalRule`
- `FeedbackProjectionRule`
- `ComposableFeedbackInterpreter`
- `ComposableFeedbackProjector`

这意味着业务方如果只想改一件事，比如：

- `save` 应该比 `like` 更强多少
- 哪些 action 应该生成 `high_intent_engagement`
- `negative_interest` 写到哪条 session path

不需要整块替换 interpreter / projector，只要替换单条 rule 或 resolver。 

---

## 和 demo 的边界

### 属于 framework

- `FeedbackEvent`
- `FeedbackSignal`
- `StateProjection`
- feedback -> state 的标准映射规则

### 属于 demo / overlay

- `social-feed` 里 `like/save/watch`
- `research-flow` 里 `clarify/run`
- 页面上的按钮文案和交互形式

---

## 当前结论

下一步 SDK 化时，不能只暴露 `decideNext()` 和 `executeSelection()`。

还应该正式补上：

- `feedback event` 写入协议
- `feedback interpretation` 层
- `state projection` 层

因为真正让推荐系统可持续进化的，不是“下一条推荐什么”，而是：

**用户刚才做的事，被系统如何正确理解并写回。**
