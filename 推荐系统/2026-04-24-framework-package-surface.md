# Framework Package Surface

这份文档回答的是：

**当 framework 作为 SDK 提供给业务方时，业务方应该 import 什么，而不应该直接依赖哪些内部路径。**

---

## 当前建议

业务方应优先从：

- [framework/index.ts](/Users/joany/Documents/Codex/2026-04-23-new-chat/imported/research-workspace/framework/index.ts)

导入。

而不是直接 import：

- `framework/runtime/default-services.ts`
- `framework/runtime/in-memory-recommendation-runtime.ts`
- `framework/core/...`

这些内部路径更适合 framework 自身演进，不适合作为长期稳定的业务侧入口。

---

## 当前公开入口包含什么

`framework/index.ts` 现在统一导出：

- protocol types
- service interfaces
- context / feedback / overlay contracts
- default services
- composable feedback rules and resolvers
- `InMemoryRecommendationRuntime`
- `buildReferenceRuntime()`
- `sessionFromContext()`

---

## 推荐的业务接入方式

优先用：

```ts
import {
  buildReferenceRuntime,
  sessionFromContext,
} from "framework";
```

这条路径更稳定，因为业务方通常需要的是：

- 快速组装一套 reference runtime
- 注入自己的 retrievalData / candidateTemplates / overlay
- 再逐步替换成更真实的 service

---

## 为什么要加 builder

如果没有 `buildReferenceRuntime()`，业务方通常会被迫自己拼这些对象：

- retrieval
- candidate construction
- policy
- feedback interpreter
- feedback projector
- context state

这会让业务方直接依赖太多内部文件和默认实现。

builder 的作用是把“参考级装配路径”收成一个稳定入口。

---

## 当前结论

framework 接下来 SDK 化时，应该坚持两层：

1. `index.ts` 作为 package surface
2. `runtime/` 和 `core/` 继续作为内部实现与协议演进层

这样业务方看到的是稳定入口，而不是一组散落的内部文件。 
