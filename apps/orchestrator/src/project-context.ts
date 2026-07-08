import type { Project, Repositories } from '@irc/db';

export function projectForChannel(repos: Pick<Repositories, 'projects'>, channel: string): Project | null {
  if (!channel.startsWith('#')) return null;
  return repos.projects.findByChannel(channel);
}

export function workspaceForChannel(
  repos: Pick<Repositories, 'projects'>,
  channel: string,
  fallbackWorkspace: string,
): string {
  return projectForChannel(repos, channel)?.workspace ?? fallbackWorkspace;
}
