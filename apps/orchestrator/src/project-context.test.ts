import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from '@irc/db';
import { projectForChannel, workspaceForChannel } from './project-context.js';

test('workspaceForChannel returns configured workspace for project channel', () => {
  const repos = createRepositories(':memory:');
  repos.projects.connectChannelProject({
    channel: '#client-a',
    name: 'client-a',
    workspace: 'C:/work/client-a',
  });

  assert.equal(workspaceForChannel(repos, '#CLIENT-A', 'C:/main/irc'), 'C:/work/client-a');
  assert.equal(workspaceForChannel(repos, '#control', 'C:/main/irc'), 'C:/main/irc');
  repos.close();
});

test('projectForChannel describes mapped and unmapped channels', () => {
  const repos = createRepositories(':memory:');
  repos.projects.connectChannelProject({ channel: '#app', name: 'app', workspace: 'C:/work/app' });

  assert.deepEqual(projectForChannel(repos, '#app'), {
    channel: '#app',
    name: 'app',
    workspace: 'C:/work/app',
  });
  assert.equal(projectForChannel(repos, '#none'), null);
  repos.close();
});
