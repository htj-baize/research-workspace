# Agent Recommendation Flow Validation Plan

日期：2026-04-24

## 目标

这份文档的目标不是验证某个具体推荐模型，而是验证：

> 这套 recommendation runtime 的核心抽象，是否能够在一个更通用的 agent recommendation flow 里成立。

这里要验证的不是 Quest 领域逻辑，而是这些更基础的问题：

- `state` 分层是否真的有必要
- local / cloud 的边界怎么切更合理
- `Context -> Intent -> Opportunity -> Action -> Outcome` 是否足够表达真实流程
- retrieval / candidate / policy 的分层是否正确
- SDK 暴露的能力边界是否顺手

## 为什么选通用 agent flow

选择通用 agent flow，而不是先选 `Studio Quest`，是因为它更能验证：

- 这套 runtime 是不是通用骨架
- `clarify_goal`、`recover_flow` 是否真的必要
- `workflow_step`、`tool_run`、`clarification` 这些机会类型是否自然成立
- state 是否真的需要 working / session / durable 分层

换句话说：

> 如果这套抽象在通用 agent 场景里也成立，再回到 Quest 时，才能更清楚地看见什么是 runtime core，什么是 Quest overlay。

## 验证场景定义

推荐验证的场景不是“万能助理”，而是一个更小、更可控的任务型 agent flow。

建议选型：

> 用户和 assistant 共同完成一个多步任务，系统需要在每一步推荐当前最合适的下一步动作。

这个任务要满足以下条件：

- 有明确但可能漂移的目标
- 有多步流程，但不是严格固定流程
- 可能需要澄清目标
- 可能需要推荐内容、页面、工具或 workflow step
- 需要在执行后更新状态

## 推荐的具体任务样本

建议从下面三个中选一个作为验证样本：

### 方案 A：研究整理流

用户目标：

- 帮我围绕某个主题整理一份研究框架或提纲

系统在中间可能推荐：

- `clarification`
- `content`
- `workflow_step`
- `tool_run`
- `navigation`

优点：

- 信息丰富
- 适合测试 goal drift
- 适合测试 clarify / compare / decide

### 方案 B：采购 / 选型流

用户目标：

- 帮我选一个工具、服务或方案

系统在中间可能推荐：

- `clarification`
- `compare`
- `content`
- `navigation`
- `complete_task`

优点：

- 更接近传统推荐 + agent 决策的结合
- 很适合测试 compare / decide

### 方案 C：多步工作流流

用户目标：

- 帮我完成一个流程，例如“提交一个申请/发起一个项目/完成一份任务”

系统在中间可能推荐：

- `workflow_step`
- `tool_run`
- `clarification`
- `recover_flow`

优点：

- 非常适合验证 action 和 outcome 写回
- 非常适合验证 execution 和 confirmation

## 建议优先选型

优先推荐：

> 研究整理流

原因：

- 它既不是纯消费推荐，也不是纯任务自动化
- 足够通用
- 能覆盖：
  - `explore`
  - `clarify_goal`
  - `compare`
  - `decide`
  - `recover_flow`
- 同时能产生内容型、工具型和 workflow 型机会

## 要验证的五个核心问题

### 1. `Context` 是否足够

要验证：

- runtime 不装载全量状态时，`Context` 是否仍然能支持下一步推荐
- `focusObjectIds` 是否足以表达当前注意力中心
- `recentEvents` 是否足以支持短期意图判断

失败信号：

- 不得不不停往 `Context.metadata` 里塞大块业务对象
- 说明 `Context` 抽象不够或 retrieval 太弱

### 2. `Intent` 是否稳定且有用

要验证：

- `Intent.name` 是否会在真实场景中自然落到：
  - `explore`
  - `clarify_goal`
  - `compare`
  - `decide`
  - `complete_task`
  - `recover_flow`
- intent 是否真的影响后续机会选择

失败信号：

- intent 只是标签，不影响 retrieval / policy
- 或者 intent 不够表达真实变化

### 3. `Opportunity.kind` 是否够表达下一步

要验证：

- 系统推荐的下一步是否能自然落到：
  - `content`
  - `clarification`
  - `workflow_step`
  - `tool_run`
  - `navigation`

失败信号：

- 所有东西都被迫塞成 `content`
- 或者 `kind` 过粗，导致 policy 无法工作

### 4. `Action.type` 是否够支撑执行

要验证：

- `ask`
- `open`
- `confirm`
- `execute`
- `navigate`

是否足够表达典型下一步。

失败信号：

- 上层必须发明自己的动作体系
- 或 runtime 分不清展示型和执行型动作

### 5. state 分层和写回边界是否清楚

要验证：

- 哪些信息只该进入 session
- 哪些需要 working state
- 哪些值得写进 durable state
- 哪些 outcome 只能用于 fast path，不该进入长期记忆

失败信号：

- durable state 很快被短期噪声污染
- 或 session state 不够导致下一步决策钝化

## state 存储方案实验

这个验证计划里，最重要的不是模型 A/B，而是：

> 架构切法 A/B。

建议直接比较三种 state 切法。

### 方案 1：Cloud-heavy

特点：

- 大部分 state 放服务端
- 本地只保留最轻 UI 上下文

验证问题：

- 是否更一致
- 是否更慢
- 是否更难保留即时状态

### 方案 2：Hybrid

特点：

- session / working local-first
- durable / memory / supply / policy cloud-backed
- SDK 屏蔽细节

验证问题：

- 是否在速度、可解释性和一致性之间平衡最好

### 方案 3：Local-heavy

特点：

- session / working / 部分 memory 本地维护
- 云端主要管 durable 与 global supply

验证问题：

- 是否更快
- 是否更容易脏
- 是否更难多端同步

## 每种方案都要跑的最小闭环

每种 state 切法都应跑同一条闭环：

```text
用户发起任务
-> runtime build context
-> resolve intent
-> retrieve materials
-> construct opportunities
-> decide next
-> 用户接受 / 拒绝 / 澄清 / 执行
-> outcome 写回
-> 再次 decide next
```

如果闭环不完整，实验结论就不可靠。

## 评估指标

### A. 架构有效性指标

- context build latency
- local state hit rate
- cloud retrieval ratio
- context size stability
- outcome writeback success rate

### B. 推荐行为指标

- intent shift frequency
- opportunity kind distribution
- action type distribution
- clarification trigger rate
- recover_flow trigger rate

### C. 交互闭环指标

- shown -> accepted
- accepted -> executed
- executed -> next interaction
- rejected -> recovery success

### D. state 健康指标

- durable state overwrite frequency
- session drift rate
- stale working state rate
- memory promotion precision

## 推荐的实验过程

### Phase 1：Shadow Mode

不直接接管用户体验。

做法：

- 用户仍走现有流程
- recommendation runtime 在后台并行生成 `Decision`
- 不展示给用户
- 只记录它会推荐什么、为什么、怎么写回

目的：

- 看这套 runtime 在真实请求下产出的 shape
- 观察 context / intent / kind / action 是否自然

### Phase 2：Internal Dogfooding

让内部用户或研究团队直接用。

做法：

- 显示 runtime 给出的 next-step recommendations
- 收集：
  - 是否顺手
  - 是否多余
  - 是否解释得通
  - 哪些 state 明显缺失

### Phase 3：Limited Live Slice

只在一小段真实链路上接管。

例如：

- 只接管“当前下一步建议”
- 不接管全部流程
- 可随时 fallback

目的：

- 观察真实闭环是否成立
- 看 writeback 是否改善下一轮推荐

## 推荐的日志结构

每次 request 至少记录：

- `context_summary`
- `intent`
- `retrieval_summary`
- `candidate_count`
- `selected_opportunities`
- `suppressed_reasons`
- `action_taken`
- `outcome`
- `writeback_summary`

这里强调 summary，而不是全量 dump。

## 什么时候说明这套 runtime 基本成立

至少满足下面几个条件：

1. `Intent` 不是装饰字段，而能稳定改变机会选择。
2. `Opportunity.kind` 在真实场景中自然分化，而不是所有东西都塌成一个类。
3. `Action.type` 足够表达展示型和执行型下一步。
4. session / working / durable 的边界能在实验中被稳定观察到。
5. hybrid state 方案比极端 cloud-heavy / local-heavy 更平衡。
6. 一次 outcome 写回后，下一轮 decision 明显受影响。

## 什么时候说明抽象需要重做

如果出现以下信号，说明 runtime 核心抽象可能有问题：

- `Context` 必须不断膨胀才能工作
- `Intent` 不能稳定解释真实流程变化
- `Opportunity.kind` 经常不够用
- `Action.type` 无法表达关键交互
- durable state 很容易被一次性事件污染
- retrieval / candidate / policy 分层不断被真实实现打破

## 对 `Studio Quest` 的位置判断

即使优先验证通用 agent flow，`Studio Quest` 仍然很重要。

它更适合在第二阶段验证：

- 高张力 continuation
- 价格与成本
- 深度写回
- 多轮 world growth

也就是：

- 通用 agent flow 用来验证 runtime core
- `Studio Quest` 用来验证高价值垂直实例

## 结论

如果用一句话总结：

> 验证 recommendation runtime 的正确方式，不是先证明框架优雅，而是用一个通用 agent recommendation flow 去逼出 state、retrieval、policy、SDK 和 writeback 的真实边界。

这份计划的核心思想是：

- 先做 vertical slice
- 再比较 state 架构切法
- 先看闭环和边界
- 再看长期抽象是否成立

