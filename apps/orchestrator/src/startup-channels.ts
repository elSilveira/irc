export interface StartupChannelInput {
  configured: string[];
  tasks: { channel: string }[];
  projects?: { channel: string }[];
  agents?: { channels?: string }[];
}

export function buildStartupChannels(input: StartupChannelInput): string[] {
  return [...new Set([
    ...input.configured,
    ...(input.projects ?? []).map((project) => project.channel),
    ...input.tasks.map((task) => task.channel),
    ...(input.agents ?? []).flatMap((agent) => parseChannels(agent.channels ?? '')),
  ])];
}

function parseChannels(value: string): string[] {
  return value.split(',').map((channel) => channel.trim()).filter(Boolean);
}
