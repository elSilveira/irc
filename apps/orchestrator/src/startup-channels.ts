export interface StartupChannelInput {
  configured: string[];
  tasks: { channel: string }[];
  projects?: { channel: string }[];
}

export function buildStartupChannels(input: StartupChannelInput): string[] {
  return [...new Set([
    ...input.configured,
    ...(input.projects ?? []).map((project) => project.channel),
    ...input.tasks.map((task) => task.channel),
  ])];
}
