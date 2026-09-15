import type { Agent, Repositories } from '@irc/db';
import { listAgentSkills, normalizeAgentSkills, validateAgentSkills } from '@irc/shared';
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

export interface CommandResult { handled: boolean; prompt?: string }

export function handleCommand(command: { name: string; args: string[] }, services: CommandServices): CommandResult {
  try {
    if (isTaskCommand(command.name)) { reply(services, handleTaskCommand(command, services)); return { handled: true }; }
    switch (command.name) {
      case 'help': reply(services, helpLines().join(' | ')); return { handled: true };
      case 'agents': reply(services, formatAgents(services.repos)); return { handled: true };
      case 'agent': reply(services, handleAgentCommand(command.args, services)); return { handled: true };
      case 'skills': reply(services, handleSkillsCommand(command.args, services)); return { handled: true };
      case 'projects': reply(services, formatProjects(services.repos)); return { handled: true };
      case 'project': reply(services, handleProjectCommand(command.args, services)); return { handled: true };
      case 'join': reply(services, handleJoinCommand(command.args, services)); return { handled: true };
      case 'status':
      case 'tasks': reply(services, formatTasks(services.repos)); return { handled: true };
      case 'new': return handleNewTask(command.args, services);
      default: return { handled: false };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reply(services, `ERR ${command.name} failed: ${message}`);
    return { handled: true };
  }
}

function handleNewTask(args: string[], services: CommandServices): CommandResult {
  const title = args.join(' ');
  if (!title) { reply(services, 'Usage: @orc new "task title"'); return { handled: true }; }
  const sourceChannel = services.channels[0] ?? '#control';
  const project = projectForChannel(services.repos, sourceChannel);
  const task = services.repos.tasks.createTask(title, { projectChannel: project?.channel ?? null, workspace: project?.workspace ?? null });
  services.irc.join(task.channel);
  const hadQa = services.repos.agents.findAgent('qa') !== null;
  ensureQaAgent(services.repos);
  if (!hadQa) requestQaAgent(services);
  const routed = chooseAgentForTask({ title, agents: services.repos.agents.listAgents().filter((agent) => !isQaAgent(agent)), tasks: services.repos.tasks.listTasks() });
  const projectSuffix = project ? ` for ${project.name}` : '';
  if (!routed) { reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}. No agents registered.`); return { handled: true }; }
  services.repos.tasks.assignTask(task.id, routed.agent.id, routed.status);
  const assignedTask = services.repos.tasks.findTask(task.id) ?? task;
  if (routed.status === 'ready') {
    services.agentSupervisor?.assignTaskChannel?.(routed.agent.nick, assignedTask);
    reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}; assigned ${routed.agent.id}.`);
  } else reply(services, `Created ${task.id} in ${task.channel}${projectSuffix}; queued for ${routed.agent.id}.`);
  return { handled: true };
}

function handleAgentCommand(args: string[], services: CommandServices): string {
  const [subcommand, id, ...rest] = args;
  if (!subcommand || !id || !['create', 'update', 'delete'].includes(subcommand)) return agentUsage();
  if (subcommand === 'delete') return services.repos.agents.deleteAgent(id) ? `Agent ${id} deleted.` : `Agent ${id} not found.`;
  const options = normalizeSkillOption(parseOptions(rest));
  const invalid = validateAgentSkills(options.skills);
  if (invalid.length > 0) return `Unknown skills: ${invalid.join(',')}. Use @orc skills to list available skills.`;
  if (subcommand === 'create') {
    if (!options.nick || !options.role || !options.context) return agentUsage();
    const agent = services.repos.agents.createAgent({ id, nick: options.nick, role: options.role, context: options.context, skills: options.skills, channels: options.channels });
    joinAgentChannels(agent.nick, agent.channels, services);
    return agentConfigLine('created', agent);
  }
  const fields = pickAgentFields(options);
  if (Object.keys(fields).length === 0) return agentUsage();
  const agent = services.repos.agents.updateAgent(id, fields);
  joinAgentChannels(agent.nick, agent.channels, services);
  return agentConfigLine('updated', agent);
}

function handleSkillsCommand(args: string[], services: CommandServices): string {
  const [agentRef, ...skillParts] = args;
  if (!agentRef) return formatSkills();
  const agent = services.repos.agents.listAgents().find((candidate) => matchesAgent(candidate, agentRef));
  if (!agent) return `No agent found for ${agentRef}.`;
  const skills = skillParts.join(' ');
  const invalid = validateAgentSkills(skills);
  if (invalid.length > 0) return `Unknown skills: ${invalid.join(',')}. Use @orc skills to list available skills.`;
  const normalized = normalizeAgentSkills(skills);
  services.repos.agents.updateAgent(agent.id, { skills: normalized });
  return `Agent ${agent.id} skills updated: ${normalized || '(none)'}`;
}

function handleProjectCommand(args: string[], services: CommandServices): string {
  const [subcommand, first, second] = args;
  if (subcommand !== 'connect' || !first || !second) return 'Usage: @orc project connect <#channel|name> <workspace>';
  const explicitChannel = first.startsWith('#');
  const channel = explicitChannel ? first : services.channels[0] ?? '#control';
  const name = explicitChannel ? first.slice(1) : first;
  const project = services.repos.projects.connectChannelProject({ channel, name, workspace: second });
  services.irc.join(project.channel);
  return `${project.channel} connected to project ${project.name} at ${project.workspace}.`;
}

function handleJoinCommand(args: string[], services: CommandServices): string {
  const [channel, agentRef] = args;
  if (!channel?.startsWith('#') || !agentRef) return 'Usage: @orc join <#channel> <agent|all>';
  services.irc.join(channel);
  const project = projectForChannel(services.repos, channel);
  const agents = services.repos.agents.listAgents();
  const selected = agentRef.toLowerCase() === 'all' ? agents : agents.filter((agent) => matchesAgent(agent, agentRef));
  if (selected.length === 0) return `No agent found for ${agentRef}.`;
  const joined = selected.filter((agent) => services.agentSupervisor?.joinChannel?.(agent.nick, channel, project?.workspace) ?? false);
  if (selected.length === 1) return joined.length === 1 ? `Joined ${selected[0]!.nick} to ${channel}.` : `${selected[0]!.nick} is not running; orchestrator joined ${channel}.`;
  return `Joined ${joined.length} agents to ${channel}.`;
}

function helpLines(): string[] {
  return ['@orc help', '@orc agents - list registered agents and configs', '@orc agent create|update|delete <id> --nick <nick> --role <role> --context <prompt> [--skills <csv>] [--channels <csv>]', '@orc skills [agent <csv>] - list skills or update one agent skill selection', '@orc projects - list project channels', '@orc project connect <name> <workspace> - map this channel to a project', '@orc join <#channel> <agent|all> - join managed agents to a project channel', '@orc tasks - list tasks', '@orc new "title" - create a task channel', '@orc logs <TASK-0001> - show a task event timeline', '@orc approvals - list pending approvals', '@orc approve|deny <TASK-0001> - resolve a blocked task', '@orc assign <TASK-0001> <agent> - assign a task and notify the agent', '@orc review <TASK-0001> - move a task into review', '@orc summarize <TASK-0001> - task overview with event counts'];
}

function formatAgents(repos: Repositories): string {
  const agents = repos.agents.listAgents();
  if (agents.length === 0) return 'No agents registered. Ask me to create one.';
  return `Agents: ${agents.map((agent) => agentConfigLine('', agent)).join(' | ')}`;
}

function formatSkills(): string { return `Skills: ${listAgentSkills().map((skill) => `${skill.id}: ${skill.description}`).join(' | ')}`; }
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

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value !== undefined) options[key] = value;
  }
  return options;
}
function normalizeSkillOption(options: Record<string, string>): Record<string, string> {
  return options.skills === undefined ? options : { ...options, skills: normalizeAgentSkills(options.skills) };
}
function pickAgentFields(options: Record<string, string>): Partial<Omit<Agent, 'id'>> {
  const fields: Partial<Omit<Agent, 'id'>> = {};
  for (const key of ['nick', 'role', 'context', 'skills', 'channels'] as const) if (options[key] !== undefined) fields[key] = options[key];
  return fields;
}
function joinAgentChannels(nick: string, channels: string, services: CommandServices): void {
  for (const channel of channels.split(',').map((c) => c.trim()).filter(Boolean)) services.agentSupervisor?.joinChannel?.(nick, channel, projectForChannel(services.repos, channel)?.workspace);
}
function agentConfigLine(prefix: string, agent: Agent): string {
  const lead = prefix ? `Agent ${agent.id} ${prefix}` : agent.id;
  return `${lead} nick=${agent.nick} role=${agent.role} status=${agent.status} channels=${agent.channels || '(none)'} skills=${agent.skills || '(none)'} context="${truncate(agent.context, 60)}"`;
}
function agentUsage(): string { return 'Usage: @orc agent create|update|delete <id> --nick <nick> --role <role> --context <prompt> [--skills <csv>] [--channels <csv>]'; }
function reply(services: CommandServices, text: string): void { services.irc.privmsg(services.channels[0] ?? '#control', text); }
function matchesAgent(agent: { id: string; nick: string }, ref: string): boolean { const lower = ref.toLowerCase(); return agent.id.toLowerCase() === lower || agent.nick.toLowerCase() === lower; }
function requestQaAgent(services: CommandServices): void { services.irc.privmsg('helper', 'Please create managed QA agent `qa` nick `QA` for task validation.'); }
function truncate(value: string, size: number): string { return value.length > size ? `${value.slice(0, size)}...` : value; }
