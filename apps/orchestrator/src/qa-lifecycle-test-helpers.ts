import { createRepositories } from '@irc/db';

export function setupQaLifecycleTest() {
  const repos = createRepositories(':memory:');
  const task = repos.tasks.createTask('Build the thing');
  repos.agents.createAgent({
    id: 'feature-implementer',
    nick: 'FeatureImpl',
    role: 'implementer',
    context: 'implements features',
  });
  repos.tasks.assignTask(task.id, 'feature-implementer', 'doing');
  const messages: string[] = [];
  const assigned: string[] = [];
  return {
    repos,
    task,
    messages,
    supervisor: {
      spawn: (agent: { nick: string }) => {
        messages.push(`spawn:${agent.nick}`);
        return {};
      },
      assignTaskChannel: (nick: string, t: { id: string; title: string; channel: string }) => {
        assigned.push(`${nick}:${t.id}:${t.title}`);
        return true;
      },
    },
    irc: { privmsg: (target: string, text: string) => messages.push(`${target}:${text}`) },
    assigned,
  };
}
