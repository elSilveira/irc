import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepositories } from './index.js';

test('connectChannelProject stores a channel project mapping', () => {
  const repos = createRepositories(':memory:');

  const project = repos.projects.connectChannelProject({
    channel: '#client-a',
    name: 'client-a',
    workspace: 'C:/work/client-a',
  });

  assert.equal(project.channel, '#client-a');
  assert.equal(project.name, 'client-a');
  assert.equal(project.workspace, 'C:/work/client-a');
  assert.deepEqual(repos.projects.findByChannel('#CLIENT-A'), project);
  repos.close();
});

test('connectChannelProject updates an existing channel mapping', () => {
  const repos = createRepositories(':memory:');
  repos.projects.connectChannelProject({ channel: '#project', name: 'old', workspace: 'C:/old' });

  const updated = repos.projects.connectChannelProject({ channel: '#project', name: 'new', workspace: 'C:/new' });

  assert.equal(updated.name, 'new');
  assert.equal(updated.workspace, 'C:/new');
  assert.equal(repos.projects.listProjects().length, 1);
  repos.close();
});

test('connectChannelProject requires channel name and workspace', () => {
  const repos = createRepositories(':memory:');

  assert.throws(() => repos.projects.connectChannelProject({ channel: 'project', workspace: 'C:/work/project' }));
  assert.throws(() => repos.projects.connectChannelProject({ channel: '#project', workspace: '   ' }));
  repos.close();
});
