# Recommendation Runtime 的端到端 Lifecycle

日期：2026-04-24

## 目标

这份文档回答一个实现侧问题：

> 一次 agent-native recommendation request 从进入 runtime 到产出结果，再到写回 state，完整链路到底怎么跑。

前面的文档已经定义了：

- `state`
- `Context -> Intent -> Opportunity -> Action -> Outcome`
- retrieval
- policy / decision layer

这份文档把这些部件串成一个可运行 lifecycle。

## 总体链路

可以先把一次完整请求看成 9 步：

```text
1. ingest request
2. build context
3. resolve intent
4. retrieve materials
5. construct opportunities
6. decide and rank
7. return / confirm / execute
8. observe outcome
9. write back and update state
```

## Step 1: Ingest Request

runtime 首先接收一个推荐或“下一步决策”请求。

典型输入包括：

- `sessionId`
- `userId`
- `surface`
- 当前 focus object
- 可选的显式 goal

例如：

```ts
type DecideNextInput = {
  sessionId?: string;
  userId?: string;
  surface?: string;
  limit?: number;
  metadata?: Record<string, unknown>;
};
```

这一层的任务不是做决策，而是建立 request boundary。

## Step 2: Build Context

runtime 通过本地和云端状态构建当前 `Context`。

典型来源：

- local session state
- local working state
- synced user state
- global system state 中必要的环境信息

这里的关键纪律是：

> `Context` 只取当前决策所需切片，不装载全量 state。

产出：

```ts
Context
```

## Step 3: Resolve Intent

有了 `Context` 之后，runtime 解析当前 `Intent`。

可能方式：

- heuristics
- model inference
- 上游显式传入 goal
- history + current context 混合判断

产出通常是：

```ts
Intent = {
  name,
  confidence,
  horizon,
  evidence
}
```

这一步是后面 retrieval 与 policy 的关键枢纽。

## Step 4: Retrieve Materials

runtime 不是直接从 `Context` 生出 `Opportunity`，而是先取素材。

通常需要四类 retrieval：

- state retrieval
- memory retrieval
- supply retrieval
- constraint retrieval

注意：

- retrieval 返回的是材料 refs 或 slices
- 不直接返回最终 opportunity

产出：

```ts
RetrievalResult[]
```

## Step 5: Construct Opportunities

candidate construction 层把 retrieval 材料组装成 `Opportunity[]`。

它会做的事包括：

- source binding
- 去重
- 机会翻译
- 粗粒度 `kind` 标注
- actionRef 绑定

这一层产出的仍然是“候选机会”，还没经过最终 decision。

典型输出：

```ts
Opportunity[]
```

## Step 6: Decide And Rank

policy / decision layer 接收：

- `Context`
- `Intent`
- `Opportunity[]`
- `ConstraintRef[]`

然后完成：

- validity filtering
- scoring
- constraint enforcement
- diversification
- top-N selection

最终形成：

```ts
Decision = {
  context,
  intent,
  opportunities
}
```

这里的 `opportunities` 已经是前台可展示或可执行的最终选择集。

## Step 7: Return, Confirm, Or Execute

这一步要根据 `Action.type` 区分路径。

### 展示/交互型 action

例如：

- `show`
- `open`
- `ask`
- `confirm`
- `navigate`

这类 action 可能只把 decision 返回给上层 UI / agent，由上层继续与用户交互。

### 执行型 action

例如：

- `execute`
- `generate`
- `purchase_and_run`

这类 action 可以进一步进入执行路径。

也就是说，一次 `decideNext()` 并不一定直接到执行；很多时候它先返回“下一步建议”。

## Step 8: Observe Outcome

无论是展示还是执行，runtime 最终都要观察 outcome。

典型 outcome 包括：

- shown
- accepted
- rejected
- executed
- failed

以及对应 feedback signals：

- click
- dwell
- confirm
- skip
- execution_success
- execution_failure

这一层的关键不是日志堆积，而是把结果转成可写回信号。

## Step 9: Write Back And Update State

最后一步是写回，但写回必须分层。

### Fast Path

更新：

- session state
- working state
- exposure history
- repetition penalty inputs

特点：

- 快
- 可撤销
- 影响下一次即时决策

### Slow Path

更新：

- durable preference
- stable memory
- persistent object state
- policy learning signals

特点：

- 慢
- 有阈值
- 通常通过 aggregation 后再写入

## 一个推荐的 runtime 时序图

```text
Caller
-> RecommendationSdk.decideNext()
-> RecommendationRuntime.getContext()
-> RecommendationRuntime.resolveIntent()
-> RetrievalService.retrieve*
-> CandidateConstruction.build()
-> PolicyService.decide()
-> return Decision

Caller selects an opportunity
-> RecommendationSdk.executeSelection()
-> RecommendationRuntime.getAction()
-> RecommendationRuntime.executeAction()
-> RecommendationRuntime.recordOutcome()
-> fast-path state update
-> slow-path aggregation
```

## 为什么要显式区分 decide 与 execute

这是很多系统容易混掉的地方。

如果不区分：

- recommendation 逻辑和 execution 逻辑会搅在一起
- 很难支持 confirm
- 很难统计“展示有效，但用户没执行”这种中间层

所以推荐的最小分层是：

```text
decide next
-> user / agent selection
-> execute selected action
-> record outcome
```

## 生命周期中的核心可观测点

为了让 runtime 真的可评估，至少要记录这些点：

### Context Quality

- context 是否过大或过小
- focus object 是否为空

### Intent Quality

- intent 置信度
- intent 与后续 outcome 的一致性

### Retrieval Quality

- 各类 retrieval 命中率
- local/cloud 路由成本

### Candidate Quality

- 生成了多少 opportunities
- 有多少被 suppress

### Decision Quality

- top-N 的多样性
- 被压掉的原因分布

### Outcome Quality

- shown -> accepted
- accepted -> executed
- executed -> next interaction

### Writeback Quality

- 写回了什么
- 哪些写回进入 durable state

## `Studio Quest` 下的一次真实链路

如果把这套 lifecycle 映射到 `Studio Quest`，典型请求会是：

### 请求入口

- 用户刚生成了一个角色或 work
- surface = `studio`

### Context

- 当前 `world.config`
- 当前 focus atom / work
- 最近一次 continuation 结果
- 最近被展示过的 Quest

### Intent

- `continue_current_object`
- 或 `deepen_current_object`
- 犹豫时可能是 `recover_flow`

### Retrieval

- state: 当前 world slice
- memory: 过去成功 continuation 模式
- supply: atoms / works / recent results
- constraints: price/intensity/policy

### Candidate Construction

- 产出一组 continuation opportunities

### Decision

- 过滤不贴世界或过度重复的候选
- 排序
- 保留 1-3 个

### Return / Confirm / Execute

- 用户点一个 Quest
- 如需确认，先 `confirm`
- 再执行 `generate`

### Outcome

- 用户接受
- continuation 生成成功
- 产出新 work / variant / scene

### Writeback

- 更新 world snapshot
- 更新 session exposure history
- 再生成下一轮 Quest

## 结论

如果用一句话总结：

> Recommendation runtime 的本质不是“给出一批推荐”，而是管理一次从 context 建立、intent 解析、材料检索、机会决策、动作执行到状态写回的完整决策生命周期。

这也是它区别于传统 `recall -> rank` 管线的地方。

