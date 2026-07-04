export interface StartupChannelInput {
  configured: string[];
  tasks: { channel: string }[];
}

export function buildStartupChannels(input: StartupChannelInput): string[] {
  return [...new Set([...input.configured, ...input.tasks.map((task) => task.channel)])];
}
