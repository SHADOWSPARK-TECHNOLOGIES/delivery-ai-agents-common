// Core shared types for ShadowSpark delivery agents.
// Consumed by every vertical (food, parcel, marketplace, enterprise).

export type AgentRole = 'user' | 'assistant' | 'tool';

/** A single message in an agent conversation. */
export interface AgentMessage {
  role: AgentRole;
  content: string;
  /** set when role === 'tool' — the tool that produced this result */
  toolName?: string;
}

/** A structured tool invocation emitted by the LLM layer. */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** Return value of any registered tool. */
export interface ToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Context handed to every tool execution. */
export interface AgentContext {
  userId: string;
  /** live conversation history (short-term memory) */
  messages: AgentMessage[];
  /** per-user long-term profile (flat key/value) */
  profile: Record<string, unknown>;
  now: () => Date;
}

/** A tool a vertical registers. The SDK drives the loop; the vertical owns data access. */
export interface ToolDefinition<A extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  /** lightweight catch-phrases used by the rule-based MockLLM to pick a tool */
  keywords?: string[];
  /** parse arguments from free-form user text (used by MockLLM); JSON-schema model is used by the LLM path */
  extract?: (message: string) => A;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (args: A, ctx: AgentContext) => ToolResult | Promise<ToolResult>;
}

/** pluggable brain. `delivery-ai-agents-common` ships MockLLM + OpenAI-compatible adapters. */
export interface LLMAdapter {
  generate(
    messages: AgentMessage[],
    opts: { systemPrompt: string }
  ): Promise<{ content: string; toolCalls?: ToolCall[] }>;
}

/** durable memory interface (in-memory by default; swap for Redis/Prisma). */
export interface Memory {
  get(userId: string): Promise<{ messages: AgentMessage[]; profile: Record<string, unknown> } | null>;
  append(userId: string, message: AgentMessage): Promise<void>;
  saveProfile(userId: string, profile: Record<string, unknown>): Promise<void>;
}

export interface AgentConfig {
  /** vertical system prompt (cyberpunk tone, NG context, escalation rules) */
  systemPrompt: string;
  tools: ToolDefinition[];
  llm?: LLMAdapter;
  memory?: Memory;
  /** tool-call rounds allowed before handoff; contract default = 2 */
  maxToolRounds?: number;
}

/** outcome of one Agent.handle() call */
export interface AgentResult {
  reply: string;
  escalate: boolean;
  transcript: AgentMessage[];
  summary?: string;
}

export interface Agent {
  handle(userId: string, message: string): Promise<AgentResult>;
}
