# DECISIONS.md — delivery-ai-agents-common

Documented judgment calls (per contract §0 rule 1: pick the production-grade default and log it).

1. **Memory default**: `InMemoryMemory` for short-term + long-term. Production deployments replace it via the `Memory` interface (Prisma/Redis).
2. **Consumption model**: local `file:` dependency in each vertical's `package.json` (not a git submodule). Simpler, npm-standard, and the repo layout keeps one shared checkout. Documented in each vertical README.
3. **Module resolution**: `"moduleResolution": "Bundler"` + `module ESNext` — produces clean ESM that Next/webpack/Vite bundlers resolve with no `.js` extension noise. `dist/` is committed as the build artifact for `file:` consumers.
4. **Escalation semantics**: contract says "2 failed attempts → escalate". Interpreted as `maxToolRounds = 2` tool-call rounds, plus an immediate `escalate` tool (matching "talk to a human" intents).
5. **MockLLM intent matching**: keyword-overlap scoring against each tool's `keywords`, plus a per-tool `extract(message)` to parse args from free text. Documented contract so verticals keep tools MockLLM-friendly — this keeps a live chat demo working with zero API keys.
6. **Built so verticals stay thin**: all four tool domains live here as factories (`createOrderTools`, `createMapTools`, `createPricingTools`, `createDispatchTools`); verticals only inject data access.
