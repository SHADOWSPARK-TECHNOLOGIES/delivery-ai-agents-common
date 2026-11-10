import type { AgentMessage } from './types.js';

export interface EscalationReport {
  escalate: true;
  reason: string;
  attempts: number;
  transcript: AgentMessage[];
  summary: string;
}

/** Build a short, human-readable handoff summary from a transcript. */
export function summarize(transcript: AgentMessage[]): string {
  if (transcript.length === 0) return 'No conversation to summarize.';
  const userMsgs = transcript
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-3);
  const toolTries = transcript
    .filter((m) => m.role === 'tool' && m.toolName)
    .map((m) => m.toolName);
  const body = userMsgs.length ? `User said: "${userMsgs.join('" / "')}".` : 'No user text captured.';
  const tools = toolTries.length ? ` Tools attempted: ${[...new Set(toolTries)].join(', ')}.` : '';
  return `${body}${tools} Failed to fully resolve automatically.`;
}

/** Contract rule: after `maxAttempts` unresolved tool rounds we hand off to a human. */
export function shouldEscalate(toolRounds: number, maxAttempts: number): boolean {
  return toolRounds >= maxAttempts;
}
