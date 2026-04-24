function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getAtPath(target, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], target);
}

function ensurePath(target, path) {
  const keys = path.split(".");
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  return {
    parent: cursor,
    key: keys[keys.length - 1],
  };
}

function setAtPath(target, path, value) {
  const { parent, key } = ensurePath(target, path);
  parent[key] = value;
}

function removeAtPath(target, path) {
  const { parent, key } = ensurePath(target, path);
  delete parent[key];
}

function mergeAtPath(target, path, value) {
  const current = getAtPath(target, path) ?? {};
  setAtPath(target, path, {
    ...current,
    ...value,
  });
}

function appendAtPath(target, path, value) {
  const current = getAtPath(target, path) ?? [];
  const next = Array.isArray(current) ? [...current, value] : [current, value];
  setAtPath(target, path, next);
}

export class InMemoryContextStateService {
  constructor(seed = {}) {
    this.sessions = new Map();
    this.working = new Map();
    this.durable = new Map();

    for (const session of seed.sessions ?? []) {
      this.sessions.set(session.sessionId, {
        sessionId: session.sessionId,
        events: clone(session.events ?? []),
        sessionState: clone(session.sessionState ?? {}),
        summary: clone(session.summary ?? null),
      });
    }
  }

  async appendEvent({ sessionId, event }) {
    const bucket = this.#ensureSession(sessionId);
    bucket.events.push(clone(event));
  }

  async applyStateWrites({ sessionId, writes }) {
    const bucket = this.#ensureSession(sessionId);

    for (const write of writes) {
      const target =
        write.target === "working"
          ? this.#ensureWorking(sessionId)
          : write.target === "durable"
            ? this.#ensureDurable(sessionId)
            : bucket.sessionState;

      switch (write.operation) {
        case "set":
          setAtPath(target, write.path, clone(write.value));
          break;
        case "append":
          appendAtPath(target, write.path, clone(write.value));
          break;
        case "merge":
          mergeAtPath(target, write.path, clone(write.value));
          break;
        case "remove":
          removeAtPath(target, write.path);
          break;
        default:
          throw new Error(`Unsupported operation: ${write.operation}`);
      }
    }
  }

  async compressSession({ sessionId, trigger }) {
    const bucket = this.#ensureSession(sessionId);
    const sessionState = bucket.sessionState;
    const working = this.#ensureWorking(sessionId);
    const events = bucket.events;

    const summary = {
      sessionId,
      currentGoal:
        sessionState.goal?.current ??
        sessionState.userGoal ??
        sessionState.topic ??
        undefined,
      currentFocusRefs: sessionState.focusRefs ?? [],
      acceptedPatterns: sessionState.acceptedPatterns ?? [],
      rejectedPatterns: sessionState.rejectedPatterns ?? [],
      openQuestions: sessionState.openQuestions ?? [],
      recentArtifacts: sessionState.recentArtifacts ?? [],
      inferredIntent: working.intent?.name,
      lastUpdatedAt: Date.now(),
      metadata: {
        trigger,
        eventCount: events.length,
      },
    };

    bucket.summary = summary;
    return clone(summary);
  }

  async promoteMemory({ sessionId }) {
    const bucket = this.#ensureSession(sessionId);
    const summary = bucket.summary ?? (await this.compressSession({ sessionId, trigger: "promotion" }));
    const decisions = [];

    if (summary.acceptedPatterns?.length) {
      decisions.push({
        sourcePath: "session.acceptedPatterns",
        targetPath: "durable.acceptedPatterns",
        value: clone(summary.acceptedPatterns),
        confidence: 0.72,
        reason: "stable_accepted_patterns",
        approved: true,
      });
      this.#ensureDurable(sessionId).acceptedPatterns = clone(summary.acceptedPatterns);
    }

    return decisions;
  }

  async buildWorkingContext({ sessionId }) {
    const bucket = this.#ensureSession(sessionId);
    const summary =
      bucket.summary ?? (await this.compressSession({ sessionId, trigger: "build_working_context" }));
    const working = this.#ensureWorking(sessionId);

    return {
      sessionId,
      activeGoal: summary.currentGoal,
      focusRefs: summary.currentFocusRefs ?? [],
      recentSignals: [
        ...(summary.acceptedPatterns ?? []).map((value) => `accepted:${value}`),
        ...(summary.rejectedPatterns ?? []).map((value) => `rejected:${value}`),
      ],
      openQuestions: summary.openQuestions ?? [],
      inferredIntent: working.intent?.name ?? summary.inferredIntent,
      constraints: working.constraints ?? [],
      recentArtifactRefs: summary.recentArtifacts ?? [],
      metadata: {
        summaryUpdatedAt: summary.lastUpdatedAt,
      },
    };
  }

  getSessionSnapshot(sessionId) {
    const bucket = this.sessions.get(sessionId);
    return clone(bucket);
  }

  #ensureSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        sessionId,
        events: [],
        sessionState: {},
        summary: null,
      });
    }
    return this.sessions.get(sessionId);
  }

  #ensureWorking(sessionId) {
    if (!this.working.has(sessionId)) {
      this.working.set(sessionId, {});
    }
    return this.working.get(sessionId);
  }

  #ensureDurable(sessionId) {
    if (!this.durable.has(sessionId)) {
      this.durable.set(sessionId, {});
    }
    return this.durable.get(sessionId);
  }
}

