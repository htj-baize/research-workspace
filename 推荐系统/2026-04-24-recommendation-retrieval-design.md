# Recommendation Runtime 里的 Retrieval 设计

日期：2026-04-24

## 目标

这份文档回答的问题是：

> 在一套 agent-native recommendation runtime 里，retrieval 应该怎么设计，才能既原子化，又不碎。

这里的 retrieval 不再只是传统召回层，而是：

- state-aware
- intent-aware
- policy-aware
- 可服务 candidate construction

的能力层。

## 核心判断

推荐系统里的 retrieval 不应该直接等同于：

- ANN 检索
- item recall
- 向量库查询

更准确地说，它应该被定义为：

> 在当前 context 和 intent 下，为下一步决策供应相关对象、记忆、候选素材和约束信息的能力层。

所以 retrieval 的目标不是“把最多东西找回来”，而是：

- 找对
- 找够
- 找得可解释
- 找得能支撑后续 candidate construction 和 policy

## Retrieval 在 runtime 里的位置

推荐的整体链路是：

```text
State / Memory
-> Retrieval
-> Candidate Construction
-> Policy / Decision
-> Action Execution
-> Outcome / Writeback
```

其中 retrieval 负责给 Candidate Construction 和 Policy 提供输入材料，但不直接决定最终机会。

## 为什么 retrieval 不能直接等于 recall

传统推荐里经常写成：

```text
recall -> rank
```

但在 agent-native 场景里，这个抽象不够。

因为被取回的东西可能不是：

- 一个现成 item

还可能是：

- 用户最近行为片段
- 当前任务相关 memory
- 约束和 policy
- 供给池切片
- 某个对象相关的局部上下文
- 构造 opportunity 所需的 source refs

所以 retrieval 更适合分成四类输入。

## 四类 retrieval 目标

### 1. State Retrieval

取回当前决策所需的状态切片。

例如：

- 当前 session 局部状态
- 当前 focus object
- 最近 exposure / reject 历史
- 最近一次 action / outcome

### 2. Memory Retrieval

取回可重用的过去。

例如：

- 长期偏好
- 历史任务轨迹
- 已验证的关系或对象事实
- 过去高质量 outcome

### 3. Supply Retrieval

取回当前可供推荐或可供构造机会的供给切片。

例如：

- item 集合
- content 单元
- world objects
- continuation sources
- 可用工具

### 4. Constraint Retrieval

取回当前决策必须服从的限制。

例如：

- 风险阈值
- 成本上限
- surface 限制
- 权限
- experiment policy

## Retrieval 的设计原则

### 1. Query 要带语义，不要只带关键词

推荐 retrieval 的输入不应只是文本 query，而至少要带：

- `context`
- `intent`
- `target`
- `scope`
- `limit`

否则 retrieval 很容易退化成裸搜索。

### 2. 返回引用，不返回全量对象

retrieval 层更适合返回：

- `Ref`
- `CandidateMaterial`
- `Slice`

而不是把整个对象一次性塞满。

原因：

- 降成本
- 降耦合
- 便于后续按需 hydrate

### 3. 区分“取素材”和“产候选”

retrieval 负责取素材。

candidate construction 负责：

- 组装
- 推断
- 去重
- 翻译成 `Opportunity`

这条边界不能混。

### 4. 支持 local-first 和 cloud-backed 混合模式

retrieval 天然会跨本地和云端：

- session / working state 适合本地优先
- durable memory / global supply 更适合云端

上层不应感知存储位置，但 retrieval runtime 必须支持这种路由。

## 建议的 retrieval query 抽象

第一版可以先抽成一个非常薄的结构：

```ts
type RetrievalTarget =
  | "state"
  | "memory"
  | "supply"
  | "constraint";

type RetrievalScope =
  | "local"
  | "cloud"
  | "hybrid";

type RetrievalQuery = {
  target: RetrievalTarget;
  context: Context;
  intent?: Intent;
  query?: string;
  objectRefs?: Id[];
  limit?: number;
  scope?: RetrievalScope;
  metadata?: Metadata;
};
```

说明：

- `target`
  - 取哪类材料
- `context`
  - 当前决策上下文
- `intent`
  - 可选；帮助 retrieval 聚焦
- `query`
  - 文本或结构化检索提示
- `objectRefs`
  - 如果已知某些对象，应优先围绕这些对象
- `limit`
  - 返回数量上限
- `scope`
  - 本地、云端或混合

## 建议的 retrieval result 抽象

返回结构也应保持薄：

```ts
type RetrievedRef = {
  id: Id;
  kind: string;
  score?: number;
  metadata?: Metadata;
};

type RetrievalResult = {
  target: RetrievalTarget;
  refs: RetrievedRef[];
  metadata?: Metadata;
};
```

注意：

- retrieval 层不承诺这些 ref 就是最终 candidate
- 它们只是供下游使用的素材

## 为什么要保留 `scope`

因为虽然上层不应知道底层实现，但 runtime 需要可控地表达：

- 是本地优先
- 是云端优先
- 还是混合拉取

典型场景：

- `state` retrieval 常常 local-first
- `memory` retrieval 常常 hybrid
- `supply` retrieval 常常 cloud-backed
- `constraint` retrieval 常常由 runtime config 与远端 policy 共同决定

## Candidate Construction 应该怎么接 retrieval

建议不要把 candidate construction 做进 retrieval。

更稳的结构是：

```text
retrieve state / memory / supply / constraints
-> build candidate materials
-> construct opportunities
-> rank / filter / diversify
```

这样：

- retrieval 可以独立优化
- candidate logic 可以更贴业务
- policy 可以清楚知道输入来源

## `Studio Quest` 里的 retrieval 映射

在 `Studio Quest` 里，这层会更直观：

### State Retrieval

- 当前 `world.config`
- 当前 focus atom / work
- 最近展示过的 offers
- 最近 continuation outcome

### Memory Retrieval

- 过去成功 continuation 模式
- 已稳定沉淀的关系或对象事实

### Supply Retrieval

- 可用 atoms
- 可用 works
- 最近生成结果
- 可绑定 continuation 的 source objects

### Constraint Retrieval

- 价格上限
- 当前 intensity policy
- repetition penalty 信息
- 当前安全和风险约束

注意：

这里 retrieval 的结果不是 Quest，而是构造 Quest 所需的材料。

## retrieval 的常见错误

### 1. 把 retrieval 做成“大而全对象装载器”

问题：

- 成本高
- 难缓存
- 下游并不都需要完整对象

### 2. 把 retrieval 和 candidate construction 混在一起

问题：

- 难调试
- 难评估
- 难替换 candidate logic

### 3. 不区分 state / memory / supply / constraint

问题：

- 调用语义模糊
- 本地/云端路由难控制
- policy 输入脏

### 4. retrieval 不暴露 enough metadata

问题：

- 下游无法知道来源和相关性
- 评估困难

## 建议的最小服务接口

```ts
interface RetrievalService {
  retrieve(input: RetrievalQuery): Promise<RetrievalResult>;
}
```

如果需要更清晰，也可以拆成：

```ts
interface RetrievalService {
  retrieveState(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveMemory(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveSupply(input: RetrievalQuery): Promise<RetrievalResult>;
  retrieveConstraints(input: RetrievalQuery): Promise<RetrievalResult>;
}
```

我更倾向第二种，因为：

- 调用语义更清楚
- 便于做 local/cloud 路由
- 更容易做性能和命中率评估

## 结论

如果用一句话总结：

> 在 agent-native recommendation runtime 里，retrieval 是一层 state-aware 的材料供应系统，而不是传统意义上的 item recall 黑盒。

它的职责是：

- 给 candidate construction 提供材料
- 给 policy 提供必要现实
- 支持本地/云端混合状态
- 保持语义清晰但对象足够薄

