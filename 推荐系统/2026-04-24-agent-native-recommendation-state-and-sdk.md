# Agent-Native 推荐系统里的 State、运行时与 SDK 抽象

日期：2026-04-24

## 这份文档回答什么问题

这份文档聚焦一个更工程化的问题：

> 如果未来推荐系统越来越 agent-native，那么系统的核心能力到底应该怎么抽象？

这里不再从传统的 `user / item / feature / ranker` 出发，而是从以下问题出发：

- `state` 到底是什么
- `state` 应该在本地还是云端
- agent 和 app 服务应该通过什么形态消费这些能力
- 未来工程的核心，是不是提供原子化检索能力
- 如果要抽象成一套统一接口，最小公共对象是什么

本文的结论是：

1. 未来工程提供的不只是原子化检索，而是一套可组合、可约束、可验证、可写回的能力基础设施。
2. `state` 不是单一存储，而是分层现实表示。
3. `state` 不会只在云端，也不会只在本地，而会是本地运行时状态与云端持久状态的混合体系。
4. 对上层最有价值的，不是低级数据访问 SDK，而是面向任务的高阶能力 SDK。
5. 如果要提炼最小公共抽象，推荐从 `Context -> Intent -> Opportunity -> Action -> Outcome` 这条闭环开始。

## 1. 未来工程的能力到底在哪里

一个自然的问题是：如果一切都 agent-native 化了，未来工程的能力是不是会退化成提供原子化检索？

答案是：检索很重要，但不够。

更准确地说，未来工程提供的是：

> 一套能让 agent 稳定感知、决策、执行、写回和评估的能力基础设施。

检索只是其中一层。

一条更完整的链路是：

```text
感知
-> 检索
-> 构造候选
-> 决策
-> 执行
-> 写回
-> 评估
```

所以未来工程能力至少包含：

- 原子化检索能力
- 原子化决策能力
- 原子化执行能力
- 原子化写回能力
- 原子化评估能力
- 原子化约束能力

如果只有检索，没有候选构造、策略判断、结果写回和评估闭环，那么系统仍然是脆弱的。

## 2. `state` 到底是什么

`state` 可以被定义为：

> 系统此刻为了做出下一步决策，所相信的当前现实。

它不是简单的：

- 用户画像
- 特征表
- memory store
- session log
- item metadata

这些都可能是 `state` 的来源，但都不等于 `state` 本身。

更工程化的定义是：

> `state` 是系统在当前时间点，对用户、任务、内容、环境、历史交互和可执行机会的压缩表示，用于支持检索、决策、执行和写回。

它必须服务四类动作：

- 检索什么
- 决定什么
- 执行什么
- 写回什么

## 3. `state` 的五层语义分层

如果从语义上拆，`state` 至少可以分成五层。

### 1. Identity State

回答：

> 这个人 / 这个对象是谁。

例如：

- 用户长期偏好
- 明确约束和禁忌
- 账户属性
- 角色设定
- 世界设定
- 稳定关系结构

特点：

- 相对稳定
- 更新慢
- 不应被短期噪声轻易污染

### 2. Session State

回答：

> 当前这次会话正在发生什么。

例如：

- 当前页面 / surface
- 最近几步点击和跳过
- 当前 attention object
- 最近展示过的候选
- 最近一次 continuation 结果

特点：

- 变化快
- 对当前推荐极敏感
- 应该有过期与衰减机制

### 3. Task / Intent State

回答：

> 系统认为用户现在想完成什么。

例如：

- explore
- compare
- decide
- continue current object
- deepen relationship
- find low-cost option

特点：

- 这是推断，不是原始事实
- 直接影响下一步推荐和执行策略

### 4. Opportunity State

回答：

> 当前有哪些下一步在现实里成立。

例如：

- 当前候选 item
- 当前 workflow 下一步
- 当前 valid continuation
- 已展示和被拒绝的机会
- 当前不该推的高成本候选

这一层对 agent-native 推荐尤其关键，因为推荐目标不再只是静态 item，而可能是动态构造出来的“下一步机会”。

### 5. Outcome State

回答：

> 做完之后发生了什么。

例如：

- 用户是否接受
- 执行是否成功
- 生成结果质量如何
- 是否产生下一轮互动
- 哪些信号该写回 durable state

没有 outcome state，系统就没有真正的闭环。

## 4. `state` 和 memory 的关系

`memory` 不是 `state` 的同义词。

更准确地说：

- `memory` 是可以被保留和再次检索的过去
- `state` 是当前决策所依赖的现实表示

memory 是 state 的来源之一，但不是全部。

举例：

- “用户三个月来偏爱某类角色”是 memory
- “用户今天连续三次点了同一对象的 continuation”是 session state
- “系统判断用户现在进入了深挖同对象模式”是 intent state
- “当前最值得推的是关系深化，不是世界扩展”是 opportunity / policy 结果

所以“做一个 memory 层”不等于“state 问题解决了”。

## 5. `state` 的四层存储结构

从系统设计角度看，建议把 state 拆成四层存储。

### 1. Durable State

长期稳定层。

适合存：

- 长期偏好
- 明确约束
- 世界基础设定
- 稳定对象属性
- 经过验证的长期信号

特征：

- 可审计
- 更新慢
- 写回门槛高

### 2. Session State

当前会话层。

适合存：

- 最近行为
- 当前焦点对象
- 当前页面与阶段
- 最近推荐和反馈

特征：

- 实时
- 可过期
- 高度服务当前决策

### 3. Working State

运行时推导层。

适合存：

- 当前 intent 推断
- 当前候选集
- 当前去重状态
- 当前策略标记
- 当前风险与成本上下文

特征：

- 生命周期短
- 可重建
- 需明确区分事实与推断

### 4. Outcome State

结果沉淀层。

适合存：

- accept / reject / execute / fail
- 执行 artifacts
- 结果质量信号
- 写回建议

特征：

- 支撑归因和 eval
- 决定是否升级为 durable signal

## 6. `state` 的两条更新路径

建议把更新分成 fast path 和 slow path。

### 1. Fast Path

目标：

> 服务当前推荐和当前 agent 决策。

路径：

```text
用户动作 / 环境变化
-> session state 更新
-> working state 重算
-> 新一轮 retrieval / candidate / policy
```

特点：

- 快
- 局部
- 可撤销
- 不直接污染长期层

### 2. Slow Path

目标：

> 服务长期学习和谨慎写回。

路径：

```text
多轮行为 / 高置信结果 / 明确确认
-> outcome aggregation
-> durable state 更新
```

特点：

- 慢
- 有阈值
- 更强调置信度和审计性

一个重要纪律是：

> 不要把一次点击直接写成长期偏好。

## 7. `state` 应该在本地还是云端

答案不是二选一，而是分层混合。

### 云端更适合承载

- durable user state
- 多设备共享状态
- 全局 item / object index
- policy 配置
- 推荐日志
- experimentation 配置
- 全局 recall / candidate 架构

### 本地更适合承载

- 当前 session state
- 当前 working state
- 高频缓存
- 临时推断
- 私密上下文
- 低延迟决策上下文

因此可以概括为：

```text
Cloud = durable + shared + global
Local = realtime + private + ephemeral
```

更合理的系统形态是三层：

### 1. Local Runtime State

给当前 agent 立即消费的运行时状态。

### 2. Synced User State

跨设备同步的用户级共享状态。

### 3. Global System State

平台级索引、策略、供给和配置。

## 8. Agent 和 app 服务应该怎么消费这些 state

未来理想形态不是让调用方直接感知：

- 数据在本地还是云端
- 查询走了哪个索引
- 写回先落本地还是直接上云

这些都应该被 runtime / SDK 隐藏。

对上层更合理的原则是：

> 隐藏存储实现，暴露能力语义。

也就是说：

- 上层不需要知道数据存在 SQLite、Redis、向量库还是远程服务
- 但上层可能需要知道这次读取要的是实时性、强一致性、本地优先还是全局共享

因此更好的接口不是暴露存储位置，而是暴露语义属性：

- `freshness`
- `consistency`
- `privacy scope`
- `durability`
- `confidence`

## 9. 为什么不能只做数据访问 SDK

一种看起来自然的做法是只提供数据访问 SDK：

```ts
getUserProfile()
getSessionState()
queryMemory()
searchIndex()
writeOutcome()
```

它的问题是：虽然隐藏了存储细节，但业务仍然要自己拼：

- retrieval 顺序
- candidate 构造
- 排序策略
- confirm 逻辑
- 写回规则

这会把复杂性继续抛给 agent 和 app 服务。

因此，未来更有价值的不是 data access SDK，而是：

> 建立在分层 state 之上的 task-oriented capability SDK。

## 10. 推荐的 SDK 分层

建议至少分三层。

### Layer 1: Primitive SDK

最底层原子能力，例如：

- `retrieveMemory`
- `getSessionState`
- `searchCandidates`
- `estimateCost`
- `writeOutcome`

用途：

- 给高级开发者和底层系统保留 escape hatch

### Layer 2: Workflow SDK

中层组合能力，例如：

- `buildCandidateSet`
- `rankForGoal`
- `prepareExecutionContext`
- `updateUserStateFromFeedback`

用途：

- 给大多数 app 服务和编排层使用

### Layer 3: Task SDK

面向任务的高阶能力，例如：

- `getNextBestActions`
- `recommendForExploration`
- `continueCurrentObject`
- `handleRecommendationFeedback`

用途：

- 给 agent 和产品能力直接消费

所以最合理的结构不是二选一，而是：

> 底层保留 primitive，上层主推 task-oriented capability。

## 11. 统一运行时的最小公共抽象

如果要进一步抽象 agent-native 推荐系统的统一运行时，最小公共对象不应该从 `user / item / feature` 开始，而应该从决策闭环开始。

推荐的一阶抽象是：

```text
Context -> Intent -> Opportunity -> Action -> Outcome
```

### 1. `Context`

回答：

> 当前现实是什么。

它是当前决策所需的上下文切片，而不是原始数据库全量。

### 2. `Intent`

回答：

> 系统认为用户现在想完成什么。

这是对当前目标的解释层。

### 3. `Opportunity`

回答：

> 当前有哪些成立的下一步。

这是比传统 item candidate 更宽的抽象，可能是内容、动作、workflow 下一步或 continuation offer。

### 4. `Action`

回答：

> 如果选择这个机会，系统具体要做什么。

它把推荐从展示接到执行。

### 5. `Outcome`

回答：

> 做完之后发生了什么。

它让系统形成写回和学习闭环。

这五个对象之所以重要，是因为它们同时能覆盖：

- 传统内容推荐
- agent 决策系统
- `Studio Quest` 这样的 continuation 推荐系统

## 12. 一版简化的 TypeScript 草图

下面给出一版最小草图，目的不是定接口细节，而是帮助统一术语。

```ts
type Context = {
  sessionId: string;
  surface: string;
  userId?: string;
  focusObjectIds: string[];
  recentEvents: Event[];
  constraints: Constraint[];
  stateRefs: StateRef[];
};

type Intent = {
  name: string;
  confidence: number;
  horizon: "immediate" | "session" | "longer";
  evidence: string[];
};

type Opportunity = {
  id: string;
  kind: string;
  headline: string;
  reason: string;
  sourceRefs: string[];
  actionRef: string;
  expectedValue?: ValueEstimate;
  expectedCost?: CostEstimate;
};

type Action = {
  id: string;
  type: string;
  input: Record<string, unknown>;
  requiresConfirmation: boolean;
  sideEffects: string[];
};

type Outcome = {
  actionId: string;
  status: "shown" | "accepted" | "rejected" | "executed" | "failed";
  feedbackSignals: FeedbackSignal[];
  artifacts?: ArtifactRef[];
  stateUpdates?: StateUpdate[];
};
```

## 13. 一版面向运行时的接口草图

如果把这套抽象包装成统一 SDK，更自然的接口不是直接暴露底层存储，而是围绕这五个对象暴露能力。

例如：

```ts
interface RecommendationRuntime {
  getContext(input?: ContextQuery): Promise<Context>;
  resolveIntent(input: ResolveIntentInput): Promise<Intent>;
  listOpportunities(input: OpportunityQuery): Promise<Opportunity[]>;
  executeAction(input: ExecuteActionInput): Promise<ActionExecutionResult>;
  recordOutcome(input: RecordOutcomeInput): Promise<void>;
}
```

进一步可以封成更高阶能力：

```ts
interface RecommendationTaskSdk {
  decideNext(input: DecideNextInput): Promise<{
    context: Context;
    intent: Intent;
    opportunities: Opportunity[];
  }>;

  handleSelection(input: HandleSelectionInput): Promise<ActionExecutionResult>;
}
```

这类接口的核心价值不在于“能查数据”，而在于：

> 能把 retrieval、candidate construction、policy、execution、writeback 收束成稳定的能力边界。

## 14. 对 `Studio Quest` 的映射

把这套抽象映射回 `Studio Quest`，会更直观：

- `Context`
  - `world.config`
  - `atoms`
  - `works`
  - 当前 focus object
  - 最近 session 事件
- `Intent`
  - continue same object
  - deepen relationship
  - escalate tension
- `Opportunity`
  - `QuestPossibility`
  - `ContinuationOffer`
- `Action`
  - continuation run
  - confirm
  - generate work / variant / scene
- `Outcome`
  - 用户是否接受
  - continuation 是否成功
  - 写回了什么
  - 是否长出了下一轮 Quest

这说明这套抽象不只是理论上成立，也能落到一个具体产品里。

## 15. 当前阶段最值得坚持的三条纪律

### 1. 不要把 state 直接暴露给上层

上层更应该消费的是能力，而不是底层存储布局。

### 2. 不要只做检索层

如果没有 candidate construction、policy、execution、outcome，系统不会形成真正闭环。

### 3. 不要只做低级数据访问 SDK

未来更有价值的是 task-oriented capability SDK。

## 结论

如果用一句话收束全文：

> Agent-native 推荐系统的核心，不是把推荐做成一个更大的黑盒模型，而是建设一套围绕 state、context、intent、opportunity、action、outcome 运转的推荐运行时。

这套运行时的关键特征是：

- state 分层
- 本地与云端协同
- 对上层隐藏存储实现
- 对上层暴露能力语义
- SDK 以任务能力为中心
- 推荐、执行、写回、评估形成闭环

如果后续继续展开，最自然的下一步是继续写两份文档：

1. `retrieval` 在这套运行时里应该如何设计，才能既原子化又不碎。
2. `policy / decision layer` 应该如何抽象，才能支持多目标推荐与 agent 执行。
