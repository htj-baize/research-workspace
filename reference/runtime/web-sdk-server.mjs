import http from "node:http";

import { InMemoryRecommendationRuntime } from "./in-memory-recommendation-runtime.ts";
import {
  BasicCandidateConstructionService,
  InMemoryRetrievalService,
  SimplePolicyService,
} from "./default-services.ts";
import { loadResearchFlowStorage } from "./storage/file-state-storage.mjs";
import { InMemoryContextStateService } from "./storage/in-memory-context-state-service.mjs";

const PORT = Number(process.env.PORT || 4321);

async function seedContextState(contextState, session) {
  for (const event of session.recentEvents ?? []) {
    await contextState.appendEvent({
      sessionId: session.sessionId,
      event: {
        ...event,
        actor: "user",
      },
    });
  }
}

async function buildResearchRuntime(strategy) {
  const storage = loadResearchFlowStorage(strategy);
  const contextState = new InMemoryContextStateService({
    sessions: [{ sessionId: storage.session.sessionId }],
  });

  await seedContextState(contextState, storage.session);

  const runtime = new InMemoryRecommendationRuntime({
    sessions: [
      {
        sessionId: storage.session.sessionId,
        userId: storage.session.userId,
        surface: storage.session.surface,
        focusObjectIds: storage.session.focusObjectIds,
        recentEvents: storage.session.recentEvents,
        constraints: storage.constraints.map((item) => ({
          id: item.id,
          kind: item.kind,
          value: item.metadata?.value,
          metadata: item.metadata,
        })),
        metadata: storage.session.metadata,
      },
    ],
    services: {
      retrieval: new InMemoryRetrievalService({
        state: {
          refs: storage.state,
        },
        memory: {
          refs: storage.memory,
        },
        supply: {
          refs: storage.supply,
        },
        constraint: {
          refs: storage.constraints,
        },
      }),
      candidateConstruction: new BasicCandidateConstructionService({
        continue_current_object: {
          headlinePrefix: "Next",
          reasonPrefix: "High-signal next step for",
        },
        recover_flow: {
          headlinePrefix: "Recover",
          reasonPrefix: "Low-friction recovery for",
        },
      }),
      policy: new SimplePolicyService(3),
    },
    contextState,
  });

  return {
    runtime,
    contextState,
    sessionId: storage.session.sessionId,
    userId: storage.session.userId,
    surface: storage.session.surface,
  };
}

const runtimes = new Map();

async function getRuntime(strategy) {
  if (!runtimes.has(strategy)) {
    runtimes.set(strategy, await buildResearchRuntime(strategy));
  }
  return runtimes.get(strategy);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function getStrategy(url) {
  const strategy = url.searchParams.get("strategy") || "hybrid";
  if (!["cloud-heavy", "hybrid", "local-heavy"].includes(strategy)) {
    throw new Error(`Unsupported strategy: ${strategy}`);
  }
  return strategy;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "recommendation-runtime-sdk-server",
      });
    }

    if (req.method === "POST" && url.pathname === "/sdk/decide") {
      const body = await readJsonBody(req);
      const strategy = body.strategy || getStrategy(url);
      const runtimeHandle = await getRuntime(strategy);
      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: body.sessionId || runtimeHandle.sessionId,
        userId: body.userId || runtimeHandle.userId,
        surface: body.surface || runtimeHandle.surface,
        limit: body.limit || 3,
        metadata: body.metadata,
      });

      return sendJson(res, 200, {
        strategy,
        decision,
        trace: runtimeHandle.runtime.getLastDecisionTrace?.(),
      });
    }

    if (req.method === "POST" && url.pathname === "/sdk/execute") {
      const body = await readJsonBody(req);
      const strategy = body.strategy || getStrategy(url);
      const runtimeHandle = await getRuntime(strategy);

      if (!body.opportunity) {
        return sendJson(res, 400, {
          error: "Missing `opportunity` in request body",
        });
      }

      const execution = await runtimeHandle.runtime.executeSelection({
        opportunity: body.opportunity,
        context: body.context,
        metadata: body.metadata,
      });

      return sendJson(res, 200, {
        strategy,
        execution,
        trace: runtimeHandle.runtime.getLastExecutionTrace?.(),
      });
    }

    if (req.method === "GET" && url.pathname === "/sdk/state") {
      const strategy = getStrategy(url);
      const runtimeHandle = await getRuntime(strategy);
      return sendJson(res, 200, {
        strategy,
        session: runtimeHandle.contextState.getSessionSnapshot(
          runtimeHandle.sessionId
        ),
      });
    }

    if (req.method === "POST" && url.pathname === "/sdk/demo-run") {
      const body = await readJsonBody(req);
      const strategy = body.strategy || getStrategy(url);
      const runtimeHandle = await getRuntime(strategy);

      const decision = await runtimeHandle.runtime.decideNext({
        sessionId: runtimeHandle.sessionId,
        userId: runtimeHandle.userId,
        surface: runtimeHandle.surface,
        limit: body.limit || 3,
        metadata: body.metadata,
      });

      const selected = decision.opportunities[0];
      if (!selected) {
        return sendJson(res, 200, {
          strategy,
          decision,
          decisionTrace: runtimeHandle.runtime.getLastDecisionTrace?.(),
          execution: null,
          executionTrace: null,
        });
      }

      const execution = await runtimeHandle.runtime.executeSelection({
        opportunity: selected,
        context: decision.context,
      });

      return sendJson(res, 200, {
        strategy,
        decision,
        decisionTrace: runtimeHandle.runtime.getLastDecisionTrace?.(),
        execution,
        executionTrace: runtimeHandle.runtime.getLastExecutionTrace?.(),
      });
    }

    return sendJson(res, 404, {
      error: "Not found",
      path: url.pathname,
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, () => {
  console.log(
    JSON.stringify(
      {
        ok: true,
        port: PORT,
        endpoints: [
          "GET /health",
          "POST /sdk/decide",
          "POST /sdk/execute",
          "POST /sdk/demo-run",
          "GET /sdk/state?strategy=hybrid",
        ],
      },
      null,
      2
    )
  );
});
