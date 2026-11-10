# delivery-ai-agents-common

Shared AI agent toolkit for all ShadowSpark delivery platforms. A dependency-free TypeScript package (`delivery-ai-agents-common`) consumed by `delivery-food-grocery`, `delivery-parcel-courier`, `delivery-marketplace`, and `delivery-enterprise-bulk`.

## What's inside

- **Core agent loop** (`src/core/orchestrator.ts`) — `createAgent(config): Agent` with `.handle(userId, message)`.
  `message → decide → tool → respond`, plus built-in human handoff.
- **Typed tools** (`src/tools/*`) — order, map, pricing, and dispatch tool *interfaces* + factories. Each vertical supplies its own DB/API clients and gets real, wired tools back.
- **Prompts** (`src/prompts/*`) — a shared base system prompt + typed vertical templates (food / parcel / marketplace / enterprise).
- **Two "brains"**:
  - `createOpenAILLM(tools, { apiKey, baseUrl, model })` — OpenAI / OpenRouter / DeepSeek compatible.
  - `MockLLM` — rule-based fallback when no API key is set (fires when last message is a tool result it renders nicely, and when a user message it keyword-matches a tool). Real LLM is a one-line env swap.
- **Memory** — `InMemoryMemory` by default; swap for Prisma/Redis.
- **Escalation** — after `maxToolRounds` (default 2) unresolved tool rounds, or an explicit `escalate` tool call, returns `{ escalate: true, transcript, summary }`.

## Usage

```ts
import { createAgent, MockLLM, createOrderTools, foodAgentPrompt } from 'delivery-ai-agents-common';

const agent = createAgent({
  systemPrompt: foodAgentPrompt({ storeName: 'Iya Basira' }),
  llm: new MockLLM([/* tools */]),
  tools: createOrderTools({
    async getStatus({ orderId }) { return { ok: true, data: { orderId, status: 'en_route', eta: '18 min' } }; },
    async updateAddress() { return { ok: true, data: { orderId: '', updated: true } }; },
    async reschedule() { return { ok: true, data: { orderId: '', time: '', changed: true } }; },
    async initiateReturn() { return { ok: true }; },
  }),
});

const result = await agent.handle('user-1', 'Where is my order ORD-123ABC?');
if (result.escalate) { /* hand to human */ }
```

## Add to a vertical repo

```bash
pnpm add file:../delivery-ai-agents-common
```

(or add `"delivery-ai-agents-common": "file:../delivery-ai-agents-common"` to `package.json`.)

## Build

```bash
pnpm install
pnpm build     # tsc -> dist/
pnpm typecheck # tsc --noEmit
```

## License
MIT — ShadowSpark Technologies, Owerri, Nigeria.
