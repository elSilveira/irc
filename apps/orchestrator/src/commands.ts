import type { Repositories } from '@irc/db';
import type { IrcClient } from './irc.js';

export interface CommandServices {
  irc: IrcClient;
  repos: Repositories;
  nick: string;
  channels: string[];
}

export interface CommandResult {
  handled: boolean;
  /** Optional prompt to forward to the brain instead of a fixed reply. */
  prompt?: string;
}

export function handleCommand(command: { name: string; args: string[] }, services: CommandServices): CommandResult {
  switch (command.name) {
    case 'help':
      reply(services, helpLines().join(' | '));
      return { handled: true };
    case 'agents':
      reply(services, formatAgents(services.repos));
      return { handled: true };
    case 'status':
    case 'tasks':
      reply(services, formatTasks(services.repos));
      return { handled: true };
    case 'new': {
      const title = command.args.join(' ');
      if (!title) {
        reply(services, 'Usage: @orc new "task title"');
        return { handled: true };
      }
      const task = services.repos.tasks.createTask(title);
      services.irc.join(task.channel);
      reply(services, `Created ${task.id} in ${task.channel}.`);
      return { handled: true };
    }
    default:
      return { handled: false };
  }
}

function helpLines(): string[] {
  return [
    '@orc help',
    '@orc agents - list registered agents',
    '@orc tasks - list tasks',
    '@orc new "title" - create a task channel',
    '@orchestrator <question> - ask me to use tools (read files, git, manage agents)',
    'or DM me directly',
  ];
}

function formatAgents(repos: Repositories): string {
  const agents = repos.agents.listAgents();
  if (agents.length === 0) return 'No agents registered. Ask me to create one.';
  return `Agents: ${agents.map((agent) => agent.id).join(', ')}`;
}

function formatTasks(repos: Repositories): string {
  const tasks = repos.tasks.listTasks();
  if (tasks.length === 0) return 'No tasks yet. Use @orc new "title".';
  return tasks.map((task) => `${task.id} ${task.title} (${task.status})`).join(' | ');
}

function reply(services: CommandServices, text: string): void {
  services.irc.privmsg(services.channels[0] ?? '#control', text);
}
