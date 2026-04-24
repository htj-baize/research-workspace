import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(relativePath) {
  const absolutePath = path.resolve(__dirname, relativePath);
  return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function mergeUniqueById(...collections) {
  const result = [];
  const seen = new Set();

  for (const collection of collections) {
    for (const item of collection || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      result.push(item);
    }
  }

  return result;
}

export function loadResearchFlowStorage(strategy) {
  const localSession = readJson("../data/research-flow/local/session.json");
  const cloudSession = readJson("../data/research-flow/cloud/session.json");
  const localMemory = readJson("../data/research-flow/local/memory.json");
  const cloudMemory = readJson("../data/research-flow/cloud/memory.json");
  const localConstraints = readJson(
    "../data/research-flow/local/constraints.json"
  );
  const cloudConstraints = readJson(
    "../data/research-flow/cloud/constraints.json"
  );
  const supply = readJson("../data/research-flow/shared/supply.json");

  const session =
    strategy === "local-heavy"
      ? localSession
      : strategy === "cloud-heavy"
        ? cloudSession
        : {
            ...cloudSession,
            focusObjectIds: mergeUniqueById(
              localSession.focusObjectIds?.map((id) => ({ id })) ?? [],
              cloudSession.focusObjectIds?.map((id) => ({ id })) ?? []
            ).map((item) => item.id),
            recentEvents: mergeUniqueById(
              cloudSession.recentEvents,
              localSession.recentEvents
            ),
            metadata: {
              ...cloudSession.metadata,
              ...localSession.metadata,
            },
          };

  const memory =
    strategy === "local-heavy"
      ? localMemory
      : strategy === "cloud-heavy"
        ? cloudMemory
        : mergeUniqueById(localMemory, cloudMemory);

  const constraints =
    strategy === "local-heavy"
      ? localConstraints
      : strategy === "cloud-heavy"
        ? cloudConstraints
        : mergeUniqueById(localConstraints, cloudConstraints);

  return {
    session,
    state: [
      {
        id: `state:${session.sessionId}`,
        kind: "session_state",
        score: 1,
        metadata: {
          source: strategy,
          eventCount: session.recentEvents?.length ?? 0,
        },
      },
    ],
    memory,
    constraints,
    supply,
  };
}

