import type { AgentMessage, Memory } from './types.js';

/** In-memory `Memory` — the default. Drop-in replace with a Prisma/Redis store. */
export class InMemoryMemory implements Memory {
  private store = new Map<
    string,
    { messages: AgentMessage[]; profile: Record<string, unknown> }
  >();

  async get(userId: string) {
    return this.store.get(userId) ?? null;
  }

  async append(userId: string, message: AgentMessage) {
    const existing = this.store.get(userId) ?? { messages: [], profile: {} };
    existing.messages.push(message);
    this.store.set(userId, existing);
  }

  async saveProfile(userId: string, profile: Record<string, unknown>) {
    const existing = this.store.get(userId) ?? { messages: [], profile: {} };
    existing.profile = profile;
    this.store.set(userId, existing);
  }
}

/** Convenience: short-term conversation + long-term profile accessors. */
export function makeMemory() {
  return new InMemoryMemory();
}
