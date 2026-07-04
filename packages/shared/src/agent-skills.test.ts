import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listAgentSkillPacks, inferAgentSkills, listAgentSkills } from './agent-skills.js';

test('lists available agent skill packs', () => {
  const skills = listAgentSkillPacks();
  assert.ok(skills.includes('implementation'));
  assert.ok(skills.includes('qa'));
  assert.ok(skills.includes('orchestration'));
});

test('lists every agent skill with editable display metadata', () => {
  const skills = listAgentSkills();
  assert.equal(skills.length, 15);
  for (const skill of skills) {
    assert.match(skill.id, /\S/);
    assert.match(skill.title, /\S/);
    assert.match(skill.description, /\S/);
  }
});

test('infers a matching default skill pack from role and context', () => {
  assert.equal(inferAgentSkills({ role: 'qa', context: 'validates tests' }), 'qa,testing,review');
  assert.equal(inferAgentSkills({ role: 'implementer', context: 'writes code' }), 'implementation,tdd,repo-editing');
  assert.equal(inferAgentSkills({ role: 'manager', context: 'routes tasks' }), 'orchestration,planning,routing');
});
