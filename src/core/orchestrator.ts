import {
  Agent,
  AgentConfig,
  AgentMessage,
  AgentResult,
  LLMAdapter,
  ToolDefinition,
} from './types.js';
import { InMemoryMemory } from './memory.js';
import { shouldEscalate, summarize } from './escalation.js';
import { MockLLM } from './mock-llm.js';

export const DEFAULT_MAX_TOOL_ROUNDS = 2;

/** Strong human-handoff phrases detected directly by the orchestrator. */
const HUMAN_HANDOFF_RE =
  /(escalate\b|talk to a human|speak to a (human|person|real person)|human agent|customer care|real person|i want(a| to talk to)? a human|call support)/i;

/** Built-in tool that always exists so "talk to a human" works in every vertical. */
const escalateTool: ToolDefinition = {
  name: 'escalate',
  description: 'Hand the conversation to a human support agent immediately.',
  keywords: ['human', 'person', 'agent', 'escalate', 'customer care', 'support rep', 'talk to someone'],
  extract: () => ({}),
  parameters: { type: 'object', properties: {}, required: [] },
  execute: () => ({ ok: true, data: { escalate: true } }),
};

/**
 * Core agent: message -> decide -> tool -> respond, with a built-in
 * human-handoff (escalation) after `maxToolRounds` unresolved tool rounds.
 */
export function createAgent(config: AgentConfig): Agent {
  const maxRounds = config.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS;
  const memory = config.memory ?? new InMemoryMemory();
  const tools: ToolDefinition[] = [escalateTool, ...config.tools];
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const llm: LLMAdapter =
    config.llm ??
    new MockLLM(tools, { systemPrompt: config.systemPrompt });

  return {
    async handle(userId: string, message: string): Promise<AgentResult> {
      const stored = (await memory.get(userId)) ?? { messages: [], profile: {} };
      const messages: AgentMessage[] = [...stored.messages];
      const profile = { ...stored.profile };
      messages.push({ role: 'user', content: message });

      // Direct hand-off intent takes priority and needs no tool round.
      if (HUMAN_HANDOFF_RE.test(message)) {
        await memory.append(userId, { role: 'assistant', content: escalationReply() });
        return {
          reply: escalationReply(),
          escalate: true,
          transcript: [...messages],
          summary: summarize(messages),
        };
      }

      const ctx = { userId, messages, profile, now: () => new Date() };
      let toolRounds = 0;
      const leanMsg: AgentMessage[] = messages.slice();

      for (let guard = 0; guard < 10; guard++) {
        const res = await llm.generate(leanMsg, { systemPrompt: config.systemPrompt });

        if (res.toolCalls && res.toolCalls.length > 0) {
          toolRounds++;
          const call = res.toolCalls[0];
          const tool = toolMap.get(call.name);
          if (!tool) {
            leanMsg.push({ role: 'tool', content: `No such tool: ${call.name}`, toolName: call.name });
            continue;
          }
          let result;
          try {
            result = await tool.execute(call.arguments as never, ctx);
          } catch (err) {
            result = { ok: false, error: err instanceof Error ? err.message : 'tool failed' };
          }
          leanMsg.push({ role: 'tool', content: JSON.stringify(result), toolName: call.name });
          ctx.messages.push(leanMsg[leanMsg.length - 1]);

          await memory.saveProfile(userId, profile);

          const willEscalate = (result.data as { escalate?: boolean } | undefined)?.escalate === true;
          if (willEscalate || shouldEscalate(toolRounds, maxRounds)) {
            await memory.append(userId, { role: 'assistant', content: escalationReply() });
            return {
              reply: escalationReply(),
              escalate: true,
              transcript: [...ctx.messages],
              summary: summarize(ctx.messages),
            };
          }
          continue;
        }

        const reply = res.content.trim() || 'I’m not sure I caught that — could you rephrase?';
        leanMsg.push({ role: 'assistant', content: reply });
        ctx.messages.push(leanMsg[leanMsg.length - 1]);
        await memory.saveProfile(userId, profile);
        return { reply, escalate: false, transcript: [...ctx.messages] };
      }

      await memory.append(userId, { role: 'assistant', content: escalationReply() });
      return {
        reply: escalationReply(),
        escalate: true,
        transcript: [...ctx.messages],
        summary: summarize(ctx.messages),
      };
    },
  };
}

function escalationReply(): string {
  return 'I’m having trouble resolving this automatically, so I’ve escalated it to a member of our team who will take over shortly. Meanwhile, you can reach us directly at hello@shadowspark.tech or ‎+234‎ (0) 803 000 0000.';
}
