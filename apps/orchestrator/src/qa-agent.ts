import type { Agent, Repositories } from '@irc/db';

export const QA_AGENT = {
  id: 'qa',
  nick: 'QA',
  role: 'qa',
  context: 'Validates task results against the initial request before final answer.',
  strengths: 'qa,testing,validation,review,regression,acceptance',
  weaknesses: '',
  capacity: 1,
  skills: 'qa,testing,review',
};

export function isQaAgent(agent: Pick<Agent, 'id' | 'role'>): boolean {
  return agent.id.toLowerCase() === QA_AGENT.id || agent.role.toLowerCase() === QA_AGENT.role;
}

export function ensureQaAgent(repos: Repositories): Agent {
  return repos.agents.findAgent(QA_AGENT.id) ?? repos.agents.createAgent(QA_AGENT);
}
