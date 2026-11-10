// delivery-ai-agents-common — public API surface.

export type {
  Agent,
  AgentConfig,
  AgentContext,
  AgentMessage,
  AgentResult,
  AgentRole,
  LLMAdapter,
  Memory,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from './core/types.js';

export { createAgent, DEFAULT_MAX_TOOL_ROUNDS } from './core/orchestrator.js';
export { InMemoryMemory, makeMemory } from './core/memory.js';
export { summarize, shouldEscalate } from './core/escalation.js';
export { MockLLM, MockLLMOptions } from './core/mock-llm.js';
export { createOpenAILLM, OpenAILLMOptions } from './core/openai.js';

export { createOrderTools } from './tools/order-tools.js';
export type {
  OrderToolClients,
  OrderStatusData,
  RescheduleData,
  UpdateAddressData,
} from './tools/order-tools.js';

export { createMapTools } from './tools/map-tools.js';
export type { EtaData, MapToolClients, RouteData } from './tools/map-tools.js';

export { createPricingTools } from './tools/pricing-tools.js';
export type { PricingToolClients, PromoData, QuoteData } from './tools/pricing-tools.js';

export { createDispatchTools } from './tools/dispatch-tools.js';
export type { DispatchToolClients, DriverAssignment } from './tools/dispatch-tools.js';

export {
  foodAgentPrompt,
  enterpriseAgentPrompt,
  marketplaceAgentPrompt,
  parcelAgentPrompt,
} from './prompts/vertical-templates.js';
export type { VerticalContext } from './prompts/vertical-templates.js';
