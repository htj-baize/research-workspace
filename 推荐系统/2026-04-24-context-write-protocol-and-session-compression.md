# Context Write Protocol 与 Session Compression 设计

日期：2026-04-24

## 目标

这份文档回答 recommendation runtime 的另一半问题：

> 如果 runtime 不只是读取 state，还要在多轮交互里持续更新 state，那么 context 应该如何写入、压缩、升级和丢弃。

前面的设计已经回答了：

- 如何定义 `Context -> Intent -> Opportunity -> Action -> Outcome`
- retrieval / candidate / policy 怎么分层
- local / cloud state 怎么切

这份文档补的是：

- 原始事件如何进入系统
- 事件如何变成 session / working / durable state
- session 如何压缩
- 哪些信息应该 promotion 成 durable memory

## 核心判断

未来 recommendation runtime 的关键难点，不是“读不到信息”，而是：

> 上下文会持续增长、持续漂移、持续被噪声污染。

所以系统不能把 context 当成自然堆积的历史，而必须把它当成：

> 一种受控写入、受控压缩、受控升级的运行时状态。

## 为什么必须有 Write Protocol

如果没有 write protocol，系统通常会退化成三种坏状态：

### 1. 什么都写

结果：

- session 越来越大
- context 垃圾堆化
- retrieval / intent / policy 都被噪声拖坏

### 2. 每轮都做自由摘要

结果：

- summary 漂移
- 短期状态被模型“脑补”
- 后续决策越来越不可信

### 3. 太保守，几乎不写

结果：

- 系统缺乏连续性
- 每轮都在重新猜
- 用户感觉系统不记得刚刚发生了什么

因此 runtime 必须明确：

- 什么算 event
- 什么算 signal
- 什么进入 session
- 什么只进入 working
- 什么可 promotion 到 durable
- 什么应该被丢弃

## 建议的四层写入链路

推荐的链路是：

```text
raw events
-> event normalization
-> state writes
-> session compression
-> memory promotion / discard
```

这条链里，每一层的语义不同。

## 1. Raw Event

最底层是原始事件。

它尽量接近事实，而不是解释。

建议结构：

```ts
type ContextEvent = {
  id: string;
  type: string;
  timestampMs: number;
  actor: "user" | "agent" | "system" | "tool";
  objectRefs?: string[];
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
```

典型事件：

- 用户发起一个目标
- 用户点击一个机会
- 用户拒绝一个机会
- agent 发起澄清问题
- tool 执行成功 / 失败
- 生成了一个 artifact
- 用户切换了 focus object

这里要注意：

> event 是事实输入，不应该直接等于 state。

## 2. State Write

原始事件进入系统后，需要被转换成状态更新。

建议结构：

```ts
type StateWrite = {
  target: "session" | "working" | "durable";
  operation: "set" | "append" | "merge" | "remove";
  path: string;
  value?: unknown;
  reason: string;
  sourceEventIds?: string[];
  confidence?: number;
};
```

这层的目标是：

- 把 event 翻译成状态变化
- 保留来源和理由
- 允许写入有置信度

例如：

### 例子 A

事件：

- 用户说“先不要搜资料，先帮我列个提纲”

合理写法：

- `working.current_goal = "draft_outline_first"`
- `session.constraints.prefer_low_cost = true`

不合理写法：

- 直接写成 durable long-term preference

### 例子 B

事件：

- 用户连续三次拒绝高成本 tool run

合理写法：

- `session.rejected_patterns += ["high_cost_tool_run"]`
- `working.intent_hint = "recover_flow"`

是否 promotion 到 durable，要再看更长期行为。

## 3. Session Compression

session 不可能无限增长，所以必须压缩。

但压缩不应只是“生成一段摘要”，而应是：

> 把原始事件转成更稳定、更可决策的 session summary。

建议结构：

```ts
type SessionSummary = {
  sessionId: string;
  currentGoal?: string;
  currentFocusRefs: string[];
  acceptedPatterns?: string[];
  rejectedPatterns?: string[];
  openQuestions?: string[];
  recentArtifacts?: string[];
  inferredIntent?: string;
  lastUpdatedAt: number;
  metadata?: Record<string, unknown>;
};
```

compression 的目标不是“更短”，而是：

- 保留下一步决策最重要的信号
- 去掉不再重要的原始噪声

## 4. Memory Promotion

并不是所有 session summary 都值得进入 durable memory。

所以还需要 promotion 协议。

建议结构：

```ts
type PromotionDecision = {
  sourcePath: string;
  targetPath: string;
  value: unknown;
  confidence: number;
  reason: string;
  approved: boolean;
};
```

只有满足一定条件的信号，才应 promotion。

例如：

- 多轮稳定出现的偏好
- 明确确认过的约束
- 跨会话仍成立的对象关系
- 长期任务状态的关键节点

不应该 promotion 的包括：

- 一次性拒绝
- 临时犹豫
- 瞬时的 recover_flow 状态
- 尚未确认的模型猜测

## 推荐的状态分层写入策略

### 写入 `session`

适合：

- 最近事件窗口
- 当前 focus object
- 最近 accepted / rejected 模式
- 当前 open questions
- 当前 surface / stage

特点：

- 快
- 可撤销
- 生命周期短

### 写入 `working`

适合：

- 当前 inferred intent
- 当前 risk / cost flags
- 当前 suppression hints
- 当前 decision context

特点：

- 更短期
- 多数情况下可重建
- 对当前推荐最关键

### 写入 `durable`

适合：

- 已确认的长期偏好
- 明确稳定的约束
- 跨会话保留的任务状态
- 已验证的事实型 memory

特点：

- 更新谨慎
- 需要 promotion 机制

## Session Compression 不是全文摘要

这点必须强调。

推荐 runtime 里的压缩，不应默认变成：

> 把最近历史丢给模型，让它总结一段自然语言。

更合理的是：

- 规则先抽硬信号
- 模型再补软状态

### 规则层适合抽的东西

- 最近 reject 的 action type
- 最近 accepted 的 opportunity kind
- 当前 focus object
- 最近 artifact refs
- 当前 active task id
- 当前 unanswered clarification

### 模型层适合抽的东西

- 用户目标是否发生漂移
- 当前是在 explore 还是 decide
- 哪些 open question 仍然有效
- 当前 recover_flow 是否仍然需要

## Compression 触发条件

不建议每轮都压缩。

更合理的触发方式包括：

### 1. Event Count Threshold

例如：

- 最近事件超过 20 条

### 2. Stage Shift

例如：

- `clarify_goal -> decide`
- `decide -> execute`
- `execute -> review`

### 3. Significant Artifact

例如：

- 新 outline 生成
- 新文档生成
- 新计划草稿生成

### 4. Goal Shift

例如：

- 用户明确说“算了，换个方向”

这些触发条件比“每轮都总结”更稳定。

## 推荐的服务接口

建议把写协议独立成一层服务：

```ts
interface ContextStateService {
  appendEvent(input: { sessionId: string; event: ContextEvent }): Promise<void>;
  applyStateWrites(input: { sessionId: string; writes: StateWrite[] }): Promise<void>;
  compressSession(input: {
    sessionId: string;
    trigger: string;
  }): Promise<SessionSummary>;
  promoteMemory(input: {
    sessionId: string;
  }): Promise<PromotionDecision[]>;
  buildWorkingContext(input: {
    sessionId: string;
  }): Promise<WorkingContext>;
}
```

这层的价值在于把：

- event log
- session state
- summary
- durable memory

连接起来，而不是让这些更新逻辑散落在 runtime 各处。

## 一个最小的 Working Context

每轮真正给 recommendation runtime 消费的，不应该是全量 session，而是更小的 working context。

例如：

```ts
type WorkingContext = {
  sessionId: string;
  activeGoal?: string;
  focusRefs: string[];
  recentSignals: string[];
  openQuestions?: string[];
  inferredIntent?: string;
  constraints?: string[];
  recentArtifactRefs?: string[];
  metadata?: Record<string, unknown>;
};
```

它应该由：

- recent event window
- session summary
- selected memory slices

动态构造出来。

## 在通用 agent flow 里的例子

假设用户在研究整理流里经历了这些事件：

1. 用户说：帮我整理 agent-native recommendation runtime 的研究框架
2. 系统推荐：跑一轮文献搜索
3. 用户拒绝
4. 系统推荐：先列一个 outline
5. 用户接受

更合理的写入过程是：

### Raw Events

- `goal_stated`
- `opportunity_shown`
- `opportunity_rejected`
- `opportunity_shown`
- `opportunity_accepted`

### Session Writes

- `session.focus_refs += topic`
- `session.rejected_patterns += high_cost_tool_run`
- `session.accepted_patterns += outline_first`

### Working Writes

- `working.intent = recover_flow`
- `working.prefer_low_cost = true`

### Compression

压成：

- current goal = build research outline
- rejected pattern = expensive tool run
- accepted pattern = outline before deep search
- open question = none

### Promotion

如果这种模式在多轮都稳定，再 promotion：

- durable.preference.research_flow = outline_first

## 实现建议

如果继续往 reference runtime 里落，可以先做一个最小版本：

### 第一版

- `appendEvent`
- `applyStateWrites`
- `compressSession`
- `buildWorkingContext`

### 第二版

- `promoteMemory`
- promotion thresholds
- summary refresh triggers

### 第三版

- local / cloud split write adapters
- hybrid compression path
- promotion audit log

## 结论

如果用一句话总结：

> recommendation runtime 不能只有读取协议，还必须有 context 写入协议和 session compression 机制，否则 state 会随着多轮交互快速膨胀并失去可决策性。

这套设计的核心在于：

- event 与 state 分离
- session / working / durable 分层写入
- compression 保留决策信号而不是生成随意摘要
- durable memory 只能通过 promotion 进入

