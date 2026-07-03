import type { DatabaseSync } from 'node:sqlite';
import type { ConversationThread } from './types.js';

export function createConversationRepository(database: DatabaseSync) {
  return {
    saveThread(contextKey: string, threadId: string) {
      assertRequired(contextKey, 'contextKey');
      assertRequired(threadId, 'threadId');

      database.prepare(`
        INSERT INTO codex_conversations (context_key, thread_id)
        VALUES (?, ?)
        ON CONFLICT(context_key) DO UPDATE SET
          thread_id = excluded.thread_id,
          updated_at = CURRENT_TIMESTAMP
      `).run(contextKey, threadId);
    },

    findThread(contextKey: string): ConversationThread | null {
      const row = database
        .prepare('SELECT context_key AS contextKey, thread_id AS threadId FROM codex_conversations WHERE context_key = ?')
        .get(contextKey) as ConversationThread | undefined;
      return row ? { ...row } : null;
    },

    close: () => database.close(),
  };
}

function assertRequired(value: unknown, name: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
}
