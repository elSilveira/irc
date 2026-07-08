import type { Repositories } from '@irc/db';
import { listAgentSkills } from '@irc/shared';
import type { IrcClient } from './irc.js';
import { isTaskCommand, handleTaskCommand } from './task-commands.js';
import { chooseAgentForTask } from './agent-routing.js';
import { ensureQaAgent, isQaAgent } from './qa-agent.js';
import { projectForChannel } from './project-context.js';

export interface CommandServices {
  irc: IrcClient;
  repos: Repositories;
  nick: string;
  channels: string[];
  agentSupervisor?: {
    assignTaskChannel?(nick: string, task: { id: string; title: string; channel: string; workspace?: string | null }): boolean;
    joinChannel?(nick: string, channel: string, workspace?: string): boolean;
  };
}

export interface CommandResult {
  handled: boolean;
  prompt?: string;
}

export function handleCommand(command: { name: string; args: string[] }, services: CommandServices): CommandResult {
  try {
    if (isTaskCommand(command.name)) {
      reply(services, handleTaskCommand(command, services));
      return { handled: true };
    }

    switch (command.name) {
      case 'help':
        reply(services, helpLines().join(' | '));
        return { handled: true };
      case 'agents':
        reply(services, formatAgents(services.repos));
        return { handled: true };
      case 'skills':
        reply(services, formatSkills());
        return { handled: true };
      case 'projects':
        reply(services, formatProjects(services.repos));
        return { handled: true };
      case 'project':
        reply(services, handleProjectCommand(command.args, services));
        return { handled: true };
      case 'join':
        reply(services, handleJoinCommand(command.args, services));
        return { handled: true };
      case 'status':
      case 'tasks':
        reply(services, formatTasks(services.repos));
        return { handled: true };
      case 'new':
        return handleNewTask(command.args, services);
      default:
        return { handled: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply(services, `ERR ${command.name} failed: ${message}`);
    return { handled: true };
  }
}

function handleNewTask(args: string[], services: CommandServices): CommandResult {
  const title = args.join(' ');
  if (!title) {
    reply(services, 'Usage: @orc new "task title"');
    return { handled: true };
  }
  const sourceChannel = services.channels[0] ?? '#control';
  const project = projectForChannel(services.repos, sourceChannel);
  const task = services.repos.tasks.createTask(title, {
    projectChannel: project?.channel ?? null,
    workspace: project?.workspace ?? null,
  });
  services.irc.join(task.channel);
  const hadQa = services.repos.agents.findAgent('qa') !== null;
  ensureQaAgent(services.repos);
  if (!hadQa) requestQaAgent(services);
  const routed = chooseAgentForTask({
    title,
    agents: services.repos.agents.listAgents().filter((agent) => !isQaAgent(agent)),
    tasks: services.repos.tasks.listTasks(),
  });
  const projectSuffix = project ? ` for ${project.name}` : '';
  if (!routed) {
    reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}. No agents registered.`);
    return { handled: true };
  }
  services.repos.tasks.assignTask(task.id, routed.agent.id, routed.status);
  const assignedTask = services.repos.tasks.findTask(task.id) ?? task;
  if (routed.status === 'ready') {
    services.agentSupervisor?.assignTaskChannel?.(routed.agent.nick, assignedTask);
    reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}; assigned ${routed.agent.id}.`);
  } else {
    reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}; queued for ${routed.agent.id}.`);
  }
  return { handled: true };
}

function handleProjectCommand(args: string[], services: CommandServices): string {
  const [subcommand, first, second] = args;
  if (subcommand !== 'connect' || !first || !second) return 'Usage: @orc project connect <#channel|name> <workspace>';
  const explicitChannel = first.startsWith('#');
  const channel = explicitChannel ? first : services.channels[0] ?? '#control';
  const name = explicitChannel ? first.slice(1) : first;
  const workspace = second;
  const project = services.repos.projects.connectChannelProject({ channel, name, workspace });
  services.irc.join(project.channel);
  return `${project.channel} connected to project ${project.name} at ${project.workspace}.`;
}

function handleJoinCommand(args: string[], services: CommandServices): string {
  const [channel, agentRef] = args;
  if (!channel?.startsWith('#') || !agentRef) return 'Usage: @orc join <#channel> <agent|all>';

  services.irc.join(channel);
  const project = projectForChannel(services.repos, channel);
  const agents = services.repos.agents.listAgents();
  const selected = agentRef.toLowerCase() === 'all'
    ? agents
    : agents.filter((agent) => matchesAgent(agent, agentRef));
  if (selected.length === 0) return `No agent found for ${agentRef}.`;

  const joined = selected.filter((agent) => services.agentSupervisor?.joinChannel?.(agent.nick, channel, project?.workspace) ?? false);
  if (selected.length === 1) {
    return joined.length === 1
      ? `Joined ${selected[0]!.nick} to ${channel}.`
      : `${selected[0]!.nick} is not running; orchestrator joined ${channel}.`;
  }
  return `Joined ${joined.length} agents to ${channel}.`;
}

function helpLines(): string[] {
  return [
    '@orc help',
    '@orc agents - list registered agents',
    '@orc skills - list available skills with descriptions',
    '@orc projects - list project channels',
    '@orc project connect <name> <workspace> - map this channel to a project',
    '@orc join <#channel> <agent|all> - join managed agents to a project channel',
    '@orc tasks - list tasks',
    '@orc new "title" - create a task channel',
    '@orc logs <TASK-0001> - show a task event timeline',
    '@orc approvals - list pending approvals',
    '@orc approve|deny <TASK-0001> - resolve a blocked task',
    '@orc assign <TASK-0001> <agent> - assign a task and notify the agent',
    '@orc review <TASK-0001> - move a task into review',
    '@orc summarize <TASK-0001> - task overview with event counts',
  ];
}

function formatAgents(repos: Repositories): string {
  const agents = repos.agents.listAgents();
  if (agents.length === 0) return 'No agents registered. Ask me to create one.';
  return `Agents: ${agents.map((agent) => agent.id).join(', ')}`;
}

function formatSkills(): string {
  return `Skills: ${listAgentSkills().map((skill) => `${skill.id}: ${skill.description}`).join(' | ')}`;
}

function formatProjects(repos: Repositories): string {
  const projects = repos.projects.listProjects();
  if (projects.length === 0) return 'No project channels yet. Use @orc project connect <name> <workspace>.';
  return `Projects: ${projects.map((project) => `${project.channel}=${project.name} (${project.workspace})`).join(' | ')}`;
}

function formatTasks(repos: Repositories): string {
  const tasks = repos.tasks.listTasks();
  if (tasks.length === 0) return 'No tasks yet. Use @orc new "title".';
  return tasks.map((task) => `${task.id} ${task.title} (${task.status})`).join(' | ');
}

function reply(services: CommandServices, text: string): void {
  services.irc.privmsg(services.channels[0] ?? '#control', text);
}

function matchesAgent(agent: { id: string; nick: string }, ref: string): boolean {
  const lower = ref.toLowerCase();
  return agent.id.toLowerCase() === lower || agent.nick.toLowerCase() === lower;
}

function requestQaAgent(services: CommandServices): void {
  services.irc.privmsg('helper', 'Please create managed QA agent `qa` nick `QA` for task validation.');
}
