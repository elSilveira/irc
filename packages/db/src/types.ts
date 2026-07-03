export interface Agent {
  id: string;
  nick: string;
  role: string;
  status: string;
  context: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  channel: string;
}

export interface ConversationThread {
  contextKey: string;
  threadId: string;
}
