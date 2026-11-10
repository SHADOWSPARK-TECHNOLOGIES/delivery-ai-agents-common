import {
  AgentMessage,
  LLMAdapter,
  ToolCall,
  ToolDefinition,
} from './types.js';

export interface MockLLMOptions {
  systemPrompt?: string;
}

/**
 * Rule-based fallback "brain" used when no LLM API key is configured.
 * Same interface as the real LLM adapter; the orchestrator drives the loop.
 * - When the last message is a user message: keyword-match a registered tool.
 * - When the last message is a tool result: synthesize a friendly reply.
 */
export class MockLLM implements LLMAdapter {
  constructor(
    private tools: ToolDefinition[],
    private opts: MockLLMOptions = {}
  ) {}

  async generate(messages: AgentMessage[], _opts: { systemPrompt: string }) {
    const last = messages[messages.length - 1];
    if (!last) return { content: this.greeting() };

    if (last.role === 'tool') return { content: this.replyFromTool(last.content) };
    if (last.role === 'assistant') return { content: last.content };

    // user message -> best tool match by keyword overlap
    const match = this.pickTool(last.content);
    if (match) {
      const call: ToolCall = {
        name: match.name,
        arguments: match.extract ? match.extract(last.content) : {},
      };
      return { content: '', toolCalls: [call] };
    }

    return { content: this.fallbackReply() };
  }

  private pickTool(text: string): ToolDefinition | null {
    const lowered = text.toLowerCase();
    let best: ToolDefinition | null = null;
    let bestScore = 0;
    for (const tool of this.tools) {
      const kws = tool.keywords ?? [];
      const score = kws.reduce((acc, kw) => (lowered.includes(kw.toLowerCase()) ? acc + 1 : acc), 0);
      if (score > bestScore) {
        bestScore = score;
        best = tool;
      }
    }
    // only act when there is a real signal
    return bestScore > 0 ? best : null;
  }

  private replyFromTool(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as { ok: boolean; data?: unknown; error?: string };
      if (!parsed.ok) return `Sorry — that didn't work${parsed.error ? `: ${parsed.error}` : ''}. Could you give me a bit more detail?`;
      const data = parsed.data as Record<string, unknown> | undefined;
      if (data && typeof data === 'object' && 'escalate' in data && data.escalate === true) {
        return '';
      }
      return this.pretty(data);
    } catch {
      return 'Something went wrong while I checked that — one moment.';
    }
  }

  /** Human-readable rendering of a typical tool result. */
  private pretty(data: unknown): string {
    if (data === null || data === undefined) return 'I found nothing there — is that reference correct?';
    if (typeof data === 'string') return data;
    const d = data as Record<string, unknown>;

    if (d.reply) return String(d.reply);

    // order status + ETA
    if (d.status && !d.changed && !d.updated) {
      let s = `Current status: ${d.status}.`;
      if (d.eta) s += ` ETA: ${d.eta}.`;
      if (d.driver) s += ` Driver: ${d.driver}.`;
      if (d.estimatedPrice) s += ` Estimated price: ₦${Number(d.estimatedPrice).toLocaleString('en-NG')}.`;
      if (d.meta) s += ` ${d.meta}`;
      return s;
    }

    // rescheduled
    if (d.changed) {
      return `Done — your delivery is now set for ${d.time ?? 'the new time'}${d.orderId ? ` (ref ${d.orderId})` : ''}.`;
    }

    // address updated
    if (d.updated) {
      return `Your delivery address has been updated${d.orderId ? ` for ${d.orderId}` : ''}.`;
    }

    // delivery quote
    if (typeof d.priceNgn === 'number' || typeof d.estimatedPrice === 'number') {
      const price = Number(d.priceNgn ?? d.estimatedPrice);
      let s = `That comes to ₦${price.toLocaleString('en-NG')}.`;
      if (d.etaMinutes) s += ` ETA ${d.etaMinutes} min.`;
      if (d.service) s += ` Service: ${d.service}.`;
      if (d.eta) s += ` ETA: ${d.eta}.`;
      return s;
    }

    // promo applied
    if (d.applied !== undefined) {
      return d.applied
        ? `✓ Promo ${d.code ? `"${d.code}" ` : ''}applied${d.amountOffNgn ? ` — you saved ₦${Number(d.amountOffNgn).toLocaleString('en-NG')}` : ''}.`
        : `I couldn't apply that code${d.reason ? ` (${d.reason})` : ''} — double-check it and try again.`;
    }

    // driver / dispatch
    if (d.driverName || d.driverId || d.assigned) {
      let s = d.driverName ? `Driver ${d.driverName} is on it` : 'A driver has been assigned.';
      if (d.etaMinutes || d.eta) s += ` ETA ${d.eta ?? `${d.etaMinutes} min`}.`;
      return s;
    }

    return safeJson(d);
  }

  private greeting(): string {
    return 'Hi there 👋 — I’m the ShadowSpark delivery assistant. Ask me about an order, a quote, or a delivery anytime.';
  }

  private fallbackReply(): string {
    return 'I can help with things like order status, delivery quotes, changing a delivery time, or getting a human agent. Try one of the quick suggestions below.';
  }
}

function safeJson(d: Record<string, unknown>): string {
  try {
    return JSON.stringify(d);
  } catch {
    return 'Here you go.';
  }
}
