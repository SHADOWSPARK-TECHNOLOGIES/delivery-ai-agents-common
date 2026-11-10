import { AgentMessage, LLMAdapter, ToolCall, ToolDefinition } from './types.js';

export interface OpenAILLMOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * OpenAI-compatible chat-completions adapter (works with OpenAI, OpenRouter,
 * DeepSeek, etc.). Tools are sent as `functions`; `tool_calls` are decoded.
 *
 * Throws if no API key is present so callers can fall back to {@link MockLLM}.
 */
export function createOpenAILLM(
  tools: ToolDefinition[],
  opts: OpenAILLMOptions
): LLMAdapter {
  const apiKey = opts.apiKey;
  const baseUrl = (opts.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = opts.model || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Provide a key or use the MockLLM fallback.'
    );
  }

  const functions = tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));

  return {
    async generate(messages: AgentMessage[], { systemPrompt }): Promise<{ content: string; toolCalls?: ToolCall[] }> {
      const body = {
        model,
        temperature: 0.4,
        messages: [{ role: 'system', content: systemPrompt }, ...messages.map(toApiMessage)],
        tools: functions.map((f) => ({ type: 'function', function: f })),
        tool_choice: 'auto',
      };

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`LLM request failed ${res.status}: ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
          };
        }>;
      };
      const msg = json.choices?.[0]?.message;
      const content = msg?.content ?? '';
      const calls = (msg?.tool_calls ?? []).filter((c) => c.function?.name);

      const toolCalls: ToolCall[] = calls.map((c) => ({
        name: c.function!.name!,
        arguments: parseArgs(c.function!.arguments),
      }));

      return { content, toolCalls };
    },
  };
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toApiMessage(m: AgentMessage) {
  if (m.role === 'tool') {
    return {
      role: 'tool',
      content: m.content,
      tool_call_id: m.toolName ?? 'tool',
    };
  }
  return { role: m.role, content: m.content };
}
