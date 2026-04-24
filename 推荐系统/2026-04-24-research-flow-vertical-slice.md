# Research Flow Vertical Slice

日期：2026-04-24

## 目标

这份文档说明一个已经落地的最小 vertical slice：

> 用“研究整理流”作为通用 agent recommendation flow 样本，验证 runtime 抽象和 state 架构切法。

这个 slice 的目标不是做一个完整产品，而是把下面这条链真正跑起来：

```text
context
-> intent
-> retrieval
-> opportunity construction
-> policy decision
-> action
-> outcome
```

## 为什么选研究整理流

它同时覆盖：

- `clarify_goal`
- `recover_flow`
- `content`
- `workflow_step`
- `tool_run`
- `navigation`

比 `Studio Quest` 更能验证 runtime 的通用骨架。

## 已实现内容

对应的可执行 demo 在：

- [research-flow-validation-demo.mjs](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/research-flow-validation-demo.mjs)

这个 demo 现在做了四件事：

1. 固定一个真实感足够强的研究整理场景。
2. 从真实文件存储读取 local / cloud / shared 数据，而不是把所有 state 写死在内存里。
3. 用同一套 runtime 思路跑三种 state 架构切法：
   - `cloud-heavy`
   - `hybrid`
   - `local-heavy`
4. 输出每种策略下的：
   - `intent`
   - retrieval summary
   - selected opportunities
   - suppressed reasons
   - action / outcome

## 这个 slice 验证什么

### 1. intent 是否真的在变化

当前场景里，因为 recent events 中存在一次 reject，intent 会优先落在：

- `recover_flow`

这能验证：

- intent 不是装饰字段
- 它会真实影响 policy

### 2. policy 是否会受 state 和 intent 影响

在 `recover_flow` 下，高成本 `tool_run` 会被压掉，原因是：

- `avoid_high_cost_during_recovery`

这验证：

- policy layer 不是简单排序
- 它会基于 flow 状态约束下一步

### 3. retrieval 是否真的在为 candidate construction 供料

这个 slice 明确拆了：

- state
- memory
- supply
- constraint

并在三种策略下改变：

- memory count
- constraint count

这可以直接观察 state 架构切法对决策输入的影响。

### 4. local / cloud / hybrid 是否会表现出不同结构特征

当前 demo 已经通过真实文件存储模拟了：

- local session 比 cloud session 更新得更快
- local session 包含最近一次 `outcome_rejected`
- cloud session 暂时滞后，因此缺少这条事件
- memory 和 constraints 也按 local / cloud 分开存储

这带来了真实可观察的差异：

- `cloud-heavy`
  - recent event 较少
  - intent 更容易落到 `continue_current_object`
  - 会保留高成本 `tool_run`
- `hybrid`
  - 能读到 local reject
  - intent 落到 `recover_flow`
  - 会压掉高成本 `tool_run`
- `local-heavy`
  - 与 `hybrid` 一样能恢复到 `recover_flow`
  - 但 memory / constraints 的输入更少

这已经不再只是静态框架，而是一个最小的 state 架构对比原型。

## 如何运行

在仓库根目录执行：

```bash
node reference/runtime/research-flow-validation-demo.mjs
```

输出将是一个 JSON 数组，每个元素对应一种 state 策略。

## 结果应该重点看什么

重点看这几个字段：

- `intent`
- `retrievalSummary`
- `selectedOpportunities`
- `suppressed`
- `execution.outcome`

推荐观察问题：

1. 三种 state 策略下，selected opportunities 是否一致？
2. `recover_flow` 是否稳定压掉高成本动作？
3. `hybrid` 是否比极端策略保留了更多合理材料？
4. 当前 taxonomy 是否足以表达场景里的下一步？

## 当前真实存储结构

当前 vertical slice 的存储数据位于：

- [file-state-storage.mjs](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/storage/file-state-storage.mjs)
- [local/session.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/local/session.json)
- [cloud/session.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/cloud/session.json)
- [local/memory.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/local/memory.json)
- [cloud/memory.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/cloud/memory.json)
- [local/constraints.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/local/constraints.json)
- [cloud/constraints.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/cloud/constraints.json)
- [shared/supply.json](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/reference/runtime/data/research-flow/shared/supply.json)

也就是说，这个 demo 现在已经具备：

- local state source
- cloud state source
- shared supply source
- strategy-specific merge logic

这使得后续替换成真实 DB、KV、远端服务时，迁移路径会更清楚。

## 下一步怎么扩展

这个 slice 目前仍然是模拟版，但已经足够作为第一轮验证底座。

下一步最自然的扩展是：

### 1. 接真实 SDK facade

让它不再只跑在单个 demo 文件里，而是接到 `InMemoryRecommendationRuntime` 或后续 runtime adapter。

### 2. 加入真实 storage adapter

例如：

- local json / sqlite adapter
- cloud json / mock service adapter

这样才能更真实地比较 local/cloud 边界。

### 3. 加入 shadow mode logging

用统一 summary 结构记录：

- context summary
- retrieval summary
- decision summary
- outcome summary

### 4. 设计第二个通用样本

比如：

- 采购 / 选型流
- 多步 workflow 流

用来验证这套抽象是否不只适合 research flow。

## 结论

如果用一句话总结：

> 这个 vertical slice 的价值，不是证明推荐结果“最优”，而是证明 recommendation runtime 已经可以在一个通用 agent flow 里真实地产生可观察、可比较、可写回的下一步决策。
