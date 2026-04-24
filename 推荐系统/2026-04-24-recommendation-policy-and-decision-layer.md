# Recommendation Runtime 里的 Policy 与 Decision Layer 设计

日期：2026-04-24

## 目标

这份文档回答的问题是：

> 在 recommendation runtime 里，policy 和 decision layer 到底应该负责什么，边界怎么切。

它要解决的是推荐系统从：

- “给我一批候选”

变成：

- “在当前 context 下，决定现在最该做的下一步”

之后的核心控制问题。

## 核心判断

policy layer 的职责不是简单排序。

更准确地说，它负责：

> 在当前 context、intent、retrieved materials 和候选 opportunities 上，做出受约束的下一步决策。

它需要同时处理：

- relevance
- cost
- value
- risk
- diversity
- timing
- flow recovery
- exploration / exploitation

所以它更像 decision layer，而不是单纯 rerank。

## Policy Layer 在 runtime 里的位置

推荐的链路是：

```text
State / Memory
-> Retrieval
-> Candidate Construction
-> Policy / Decision
-> Action Execution
-> Outcome / Writeback
```

其中：

- Candidate Construction 负责把素材变成 `Opportunity`
- Policy / Decision 负责决定当前应该展示/执行哪些 `Opportunity`

## Policy Layer 的五项职责

### 1. Validity Filtering

先判断哪些机会根本不该进入前台。

例如：

- 不贴当前 intent
- 与当前 context 冲突
- 已被强拒绝且过于相似
- 成本明显越界
- 不满足 surface 限制

这一步是必要的，因为后续 rerank 不能拯救坏候选。

### 2. Scoring

给候选打分，但分数不应只反映相关性。

建议至少考虑：

- relevance / attachment
- urgency / timing
- expected value
- cost penalty
- risk penalty
- repetition penalty

### 3. Constraint Enforcement

把硬约束真正执行下去。

例如：

- 成本上限
- 权限限制
- 风险限制
- 当前 surface 的交互规则
- 需要 confirmation 的动作不能直推执行

### 4. Diversification

防止 top-N 只是同一机会的不同表述。

多样性可以体现在：

- 不同 `Opportunity.kind`
- 不同 intensity
- 不同 source object
- 不同 action mode

### 5. Final Decision

最终决定：

- 当前返回几个机会
- 这些机会的顺序
- 是否先澄清
- 是否先恢复 flow
- 是否直接执行某一步

## 为什么要显式建模 `recover_flow`

在 agent-native 产品里，很多时候最优决策不是“价值最高”，而是“让系统重新进入可持续互动状态”。

例如：

- 用户停住了
- 刚拒绝了多个机会
- 上一步执行失败
- 用户没有明确目标

这时候 policy 的目标不是最大化即时收益，而是：

> 最小摩擦地把用户带回 flow。

因此 `Intent = recover_flow` 在 decision layer 里应有特殊语义。

## 建议的 scoring 抽象

第一版不需要固化复杂公式，但可以统一一层弱抽象：

```ts
type ScoreBreakdown = {
  relevance?: number;
  urgency?: number;
  value?: number;
  costPenalty?: number;
  riskPenalty?: number;
  repetitionPenalty?: number;
  diversityAdjustment?: number;
  finalScore: number;
  metadata?: Metadata;
};
```

注意：

- 这不是核心 protocol 对象
- 更适合作为 policy 内部或 debug 输出

## 建议的 decision 输入

```ts
type DecisionInput = {
  context: Context;
  intent: Intent;
  opportunities: Opportunity[];
  constraints?: ConstraintRef[];
  metadata?: Metadata;
};
```

## 建议的 decision 输出

```ts
type DecisionResult = {
  selected: Opportunity[];
  suppressed?: Array<{
    opportunityId: Id;
    reason: string;
  }>;
  metadata?: Metadata;
};
```

说明：

- `selected`
  - 当前保留下来的 top opportunities
- `suppressed`
  - 被过滤或压掉的候选及原因

我建议保留 `suppressed`，因为这对 debug、eval、policy 调参很重要。

## Policy Layer 的最小服务接口

```ts
interface PolicyService {
  decide(input: DecisionInput): Promise<DecisionResult>;
}
```

如果想更清楚，也可以拆成：

```ts
interface PolicyService {
  filter(input: DecisionInput): Promise<Opportunity[]>;
  score(input: DecisionInput): Promise<Array<Opportunity & {
    scoreBreakdown?: ScoreBreakdown;
  }>>;
  diversify(input: DecisionInput): Promise<Opportunity[]>;
  decide(input: DecisionInput): Promise<DecisionResult>;
}
```

我更建议：

- 外部只稳定 `decide`
- 内部保留 `filter / score / diversify`

原因：

- 对上层接口更稳
- 内部实现仍有足够分层

## `Action` 在 decision layer 里的角色

虽然机会的排序是围绕 `Opportunity`，但最终决策不该忽略 `Action`。

例如：

- `show` 和 `generate` 不该被同样看待
- `purchase_and_run` 需要更高门槛
- `ask` 在 `clarify_goal` 意图下优先级更高
- `confirm` 在高成本场景下更合理

也就是说：

> policy 决定 opportunity，但必须理解 action type。

## `Studio Quest` 映射

放到 `Studio Quest` 里，decision layer 逻辑会很清楚：

### Validity Filter

- 是否绑定当前 atom/work
- 是否贴当前 world
- 是否太抽象
- 是否与最近被拒绝的 Quest 太像

### Score

- attachment
- urgency
- fantasy / pull
- world fit
- cost penalty
- repetition penalty

### Diversify

- 一个轻 continuation
- 一个更深的 continuation
- 一个更高强度但可卖的 continuation

### Final Decision

- 展示 1-3 个 offer
- 某些场景下先 `confirm`
- 某些场景下先 `clarification`

这说明 Quest Engine 的 Offer Priority Layer，本质上就是这一层的领域化实现。

## 常见错误

### 1. 把 policy 等同于排序模型

问题：

- 无法处理 hard constraints
- 无法显式支持 flow recovery
- 无法稳定解释 suppressed reasons

### 2. 让 candidate construction 偷偷做 policy

问题：

- 候选逻辑和决策逻辑搅在一起
- 后续难评估

### 3. 不保留 suppressed reason

问题：

- 很难 debug
- 很难知道为什么某些机会一直出不来

### 4. 不考虑 action type

问题：

- 系统容易在不合适的时候推重动作

## 建议的最小策略

第一版先收成：

1. filter hard
2. score broadly
3. diversify lightly
4. return top few

也就是：

```text
validity first
decision second
execution later
```

## 推荐的参考接口

```ts
interface PolicyService {
  decide(input: {
    context: Context;
    intent: Intent;
    opportunities: Opportunity[];
    constraints?: ConstraintRef[];
    metadata?: Metadata;
  }): Promise<{
    selected: Opportunity[];
    suppressed?: Array<{
      opportunityId: Id;
      reason: string;
    }>;
    metadata?: Metadata;
  }>;
}
```

## 结论

如果用一句话总结：

> Policy / Decision Layer 的职责，不是简单“给候选排序”，而是在约束、成本、风险、节奏和 flow 的共同作用下，决定现在最应该发生的下一步。

这是从传统 rerank 走向 agent-native recommendation runtime 的核心变化之一。

