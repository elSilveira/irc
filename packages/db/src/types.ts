export interface Agent {
  id: string;
  nick: string;
  role: string;
  status: string;
  context: string;
  strengths: string;
  weaknesses: string;
  capacity: number;
  skills: string;
  channels: string;
  modelProvider?: string;
  modelAuth?: string;
  modelName?: string;
}

export interface Project {
  channel: string;
  name: string;
  workspace: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  channel: string;
  assignedTo: string | null;
  projectChannel: string | null;
  workspace: string | null;
}

export interface ConversationThread {
  contextKey: string;
  threadId: string;
}

export interface TaskEventRecord {
  id: number;
  taskId: string;
  actor: string;
  eventType: string;
  content: string;
  createdAt: string;
}

export type ApprovalDecision = 'approved' | 'denied';

export interface ApprovalRecord {
  id: string;
  taskId: string;
  requestedBy: string;
  action: string;
  status: string;
  createdAt: string;
}

export interface IrcMessageRecord {
  id: number;
  channel: string;
  sender: string;
  message: string;
  taskId: string | null;
  createdAt: string;
}
