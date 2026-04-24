# Studio Quest 到 Recommendation Runtime 的映射示例

日期：2026-04-24

## 目标

这份文档回答一个更落地的问题：

> 如果把 `Studio Quest` 作为一个具体产品，它应该怎么映射到前面定义的 recommendation runtime。

目标不是写实现细节，而是证明这套抽象不是空的。

## 一句话映射

可以把 `Studio Quest` 理解成：

> 一个 world-state-driven 的 continuation recommendation runtime。

其中：

- 世界状态提供 context 和 source material
- Quest engine 提供 candidate construction
- Offer priority 提供 policy / decision
- continuation execution 提供 action execution
- world writeback 提供 outcome -> state update

## 对象映射

### 1. State

在 `Studio Quest` 里，state 至少分成这几层：

#### Durable / World State

- `world.config`
- `atoms`
- `works`

#### Session State

- 当前查看的 atom / work
- 最近展示过的 Quest offers
- 最近接受 / 拒绝过的 Quest
- 最近一次 continuation 结果

#### Working State

- 当前 intent 判断
- 当前 candidate Quest 集合
- 当前 repetition penalty 输入
- 当前 price / intensity 策略上下文

#### Outcome State

- 哪个 Quest 被点了
- confirm 是否通过
- continuation 是否成功
- 是否写回 world

## 核心协议映射

### `Context`

可映射为：

```ts
type StudioQuestContext = {
  sessionId: string;
  userId?: string;
  surface: "studio" | "overview" | "detail";
  focusObjectIds: string[];
  recentEvents: EventRef[];
  constraints: ConstraintRef[];
  metadata: {
    worldId?: string;
    currentAtomIds?: string[];
    currentWorkIds?: string[];
  };
};
```

这里最重要的是：

- 当前 focus object
- 当前 world slice
- 最近 interaction history

### `Intent`

在 `Studio Quest` 中，最常见的几个 intent 是：

- `continue_current_object`
- `deepen_current_object`
- `recover_flow`

例如：

```ts
Intent = {
  name: "continue_current_object",
  confidence: 0.86,
  metadata: {
    objectType: "character"
  }
}
```

### `Opportunity`

`Opportunity` 在这里基本对应：

- `QuestPossibility` 的后半段语义
- `ContinuationOffer` 的前台形态

最接近的是 `ContinuationOffer`。

例如：

```ts
Opportunity = {
  id: "offer_1",
  kind: "continuation",
  headline: "给白槿一次第一次露出破绽的场面",
  reason: "她的隐藏身份已经被雨夜重逢推到边缘，现在最适合让破绽第一次出现。",
  sourceRefs: ["atom_baijin", "work_rain_reunion"],
  actionRef: "action_generate_scene_1",
  cost: { level: "low", label: "12 credits" },
  value: { level: "high", label: "strong continuation pull" },
  metadata: {
    dynamicType: "tension",
    expectedOutput: "new_work",
    intensity: "light"
  }
}
```

### `Action`

在 `Studio Quest` 中，常见 action 可以是：

- `confirm`
- `generate`
- `open`

比如：

```ts
Action = {
  id: "action_generate_scene_1",
  type: "confirm",
  input: {
    nextActionType: "generate",
    offerId: "offer_1"
  },
  requiresConfirmation: true
}
```

确认后再进入真正执行：

```ts
Action = {
  id: "action_run_scene_1",
  type: "generate",
  input: {
    mode: "new_work",
    sourceRefs: ["atom_baijin", "work_rain_reunion"]
  },
  requiresConfirmation: false
}
```

### `Outcome`

对应：

- shown
- accepted
- executed
- failed

例如：

```ts
Outcome = {
  actionId: "action_run_scene_1",
  status: "executed",
  artifactRefs: ["work_new_scene_42"],
  feedbackSignals: [
    { type: "continuation_success", value: true }
  ]
}
```

## Retrieval 映射

`Studio Quest` 的 retrieval 不是“召回 Quest”，而是召回 Quest 材料。

### `retrieveState`

取：

- 当前 `world.config`
- 当前 focus atom / work
- 最近展示 / 拒绝历史
- 最近 continuation 结果

### `retrieveMemory`

取：

- 过去哪些 continuation 模式成功
- 已确认的角色关系与对象事实

### `retrieveSupply`

取：

- 可用 atoms
- 可用 works
- 最近生成的结果
- 当前可用于 continuation 的 source objects

### `retrieveConstraints`

取：

- intensity policy
- credit / price 上限
- repetition penalty 输入
- 风险与安全约束

## Candidate Construction 映射

这层正好对应 Quest Engine runtime core。

可以理解成：

```text
retrieved materials
-> buildQuestPossibilities()
-> translate to ContinuationOffer
```

也就是：

- `QuestPossibility`
  - 回答什么 continuation 在世界里成立
- `ContinuationOffer`
  - 回答哪些 continuation 值得被推到前台

所以在 runtime 术语里：

- `QuestPossibility` 更接近 candidate material / pre-opportunity
- `ContinuationOffer` 更接近最终 `Opportunity`

## Policy / Decision 映射

这层直接对应 `Offer Priority Layer`。

### Filter

- world fit 不够的压掉
- 和最近拒绝项太像的压掉
- 成本超预算的压掉

### Score

- attachment
- urgency
- fantasy / pull
- world fit
- cost penalty
- repetition penalty

### Diversify

保证前台 1-3 个 offers 不是同一种欲望换皮。

例如：

- 一个轻 continuation
- 一个关系深化
- 一个更高强度的升级

## Runtime 时序映射

一次完整 `Studio Quest` 决策大致可以写成：

```text
User creates a character or work
-> getContext(studio surface)
-> resolveIntent(continue_current_object)
-> retrieveState / retrieveSupply / retrieveConstraints
-> buildQuestPossibilities
-> translate to ContinuationOffer
-> PolicyService.decide
-> return top 1-3 continuation opportunities
-> user selects one
-> confirm if needed
-> execute generate action
-> recordOutcome
-> write new work / variant back to world
-> trigger next decide cycle
```

## 一个具体例子

### 输入

- Character: 白槿
- 描述：冷静、危险、像在隐藏身份的女外交官
- 最近生成 work：`雨夜重逢`

### Context

- `focusObjectIds = ["atom_baijin", "work_rain_reunion"]`
- `surface = "studio"`

### Intent

- `continue_current_object`

### Retrieved Materials

- world config
- 白槿角色设定
- `雨夜重逢`
- 最近未兑现 tension

### Opportunities

1. 给白槿一次第一次露出破绽的场面
2. 让白槿和一个关键人物形成危险关系
3. 把她推进一个再也洗不清的秘密夜晚

### Actions

- 每个机会先 `confirm`
- 确认后 `generate`

### Outcome

- 新增 `new_work`
- 关联 `atom_baijin`
- 写回世界
- 再长出下一轮 continuation

## 这套映射说明了什么

它说明 `Studio Quest` 不是对 runtime 抽象的例外，而是一个非常适合验证这套抽象的实例。

原因是它天然具备：

- state
- retrieval
- candidate construction
- policy
- action execution
- outcome writeback

也就是说，它本来就是一个完整的 recommendation runtime，只不过推荐的不是 item，而是 continuation。

## 实现建议

如果真的往代码走，一个比较合理的模块映射会是：

### `src/lib/quest-engine/`

负责：

- `buildQuestPossibilities`
- `toContinuationOffer`

### `src/lib/recommendation-runtime/`

负责：

- `getContext`
- `resolveIntent`
- `decideNext`
- `executeSelection`

### `src/lib/recommendation-runtime/retrieval`

负责：

- state / memory / supply / constraint retrieval

### `src/lib/recommendation-runtime/policy`

负责：

- filter
- score
- diversify
- top-N decision

### `src/lib/recommendation-runtime/writeback`

负责：

- world update
- session update
- outcome aggregation

## 结论

如果用一句话总结：

> `Studio Quest` 不是对 recommendation runtime 的特例，而是一个把“推荐下一步机会”这件事暴露得非常清楚的领域化实现。

这使它非常适合作为下一代 recommendation runtime 的验证样本。

