const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const { createServiceOps } = require('../src/service-ops');

test('restart can directly launch the full service restart script', () => {
  const calls = [];
  const ops = createServiceOps({
    cwd: 'C:/repo',
    env: { PATH: 'test', CODEX_SERVICE_OPS_DIRECT: '1' },
    spawn(command, args, options) {
      calls.push({ command, args, options });
      return { unref() {} };
    },
  });

  assert.deepEqual(ops.run('restart'), {
    ok: true,
    message: 'Restart launched: scripts/restart-service.ps1',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'powershell.exe');
  assert.deepEqual(calls[0].args.slice(0, 3), ['-ExecutionPolicy', 'Bypass', '-File']);
  assert.match(calls[0].args[3], /^C:[\\/]repo[\\/]scripts[\\/]restart-service\.ps1$/);
  assert.equal(calls[0].options.detached, true);
  assert.equal(calls[0].options.stdio, 'ignore');
});

test('restart queues a service-control request by default on Windows', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'irc-service-ops-'));
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  writeFileSync(join(repoRoot, 'package.json'), '{}');
  writeFileSync(join(repoRoot, 'scripts', 'restart-service.ps1'), '');

  try {
    const ops = createServiceOps({ cwd: repoRoot, env: {} });
    const result = ops.run('restart');
    const queueDir = join(repoRoot, 'data', 'service-ops');
    const requests = readdirSync(queueDir).filter((file) => file.endsWith('.restart.request.json'));
    const request = JSON.parse(readFileSync(join(queueDir, requests[0]), 'utf8'));

    assert.deepEqual(result, {
      ok: true,
      message: 'Restart requested: service-control loop will run scripts/restart-service.ps1',
    });
    assert.equal(request.action, 'restart');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('restart reports launcher failures', () => {
  const ops = createServiceOps({
    cwd: 'C:/repo',
    env: { CODEX_SERVICE_OPS_DIRECT: '1' },
    spawn() {
      throw new Error('powershell missing');
    },
  });

  assert.deepEqual(ops.run('restart'), {
    ok: false,
    message: 'Restart failed: powershell missing',
  });
});

test('build runs from the repo root when triggered from a subdirectory', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'irc-service-ops-'));
  const nestedCwd = join(repoRoot, 'apps', 'orchestrator');
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  mkdirSync(nestedCwd, { recursive: true });
  writeFileSync(join(repoRoot, 'package.json'), '{}');
  writeFileSync(join(repoRoot, 'scripts', 'restart-service.ps1'), '');

  try {
    const calls = [];
    const ops = createServiceOps({
      cwd: nestedCwd,
      spawnSync(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    assert.deepEqual(ops.run('build'), {
      ok: true,
      message: 'Build passed: npm run typecheck',
    });
    assert.equal(calls[0].options.cwd, repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('build queues through service-control when direct npm launch is blocked', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'irc-service-ops-'));
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  writeFileSync(join(repoRoot, 'package.json'), '{}');
  writeFileSync(join(repoRoot, 'scripts', 'restart-service.ps1'), '');

  try {
    const ops = createServiceOps({
      cwd: repoRoot,
      spawnSync() {
        return { status: null, error: Object.assign(new Error('blocked'), { code: 'EPERM' }) };
      },
    });

    assert.deepEqual(ops.run('build'), {
      ok: true,
      message: 'Build requested: service-control loop will run npm run typecheck',
    });
    const requests = readdirSync(join(repoRoot, 'data', 'service-ops')).filter((file) => file.endsWith('.build.request.json'));
    assert.equal(requests.length, 1);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('deploy queues one build-then-restart service-control request', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'irc-service-ops-'));
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  writeFileSync(join(repoRoot, 'package.json'), '{}');
  writeFileSync(join(repoRoot, 'scripts', 'restart-service.ps1'), '');

  try {
    const ops = createServiceOps({ cwd: repoRoot });

    assert.deepEqual(ops.run('deploy'), {
      ok: true,
      message: 'Deploy requested: service-control loop will build then restart',
    });
    const requests = readdirSync(join(repoRoot, 'data', 'service-ops')).filter((file) => file.endsWith('.deploy.request.json'));
    const request = JSON.parse(readFileSync(join(repoRoot, 'data', 'service-ops', requests[0]), 'utf8'));
    assert.equal(request.action, 'deploy');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('restart launches the repo root script when triggered from a subdirectory', () => {
  const repoRoot = mkdtempSync(join(tmpdir(), 'irc-service-ops-'));
  const nestedCwd = join(repoRoot, 'packages', 'orchestrator');
  mkdirSync(join(repoRoot, 'scripts'), { recursive: true });
  mkdirSync(nestedCwd, { recursive: true });
  writeFileSync(join(repoRoot, 'package.json'), '{}');
  writeFileSync(join(repoRoot, 'scripts', 'restart-service.ps1'), '');

  try {
    const calls = [];
    const ops = createServiceOps({
      cwd: nestedCwd,
      env: { CODEX_SERVICE_OPS_DIRECT: '1' },
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { unref() {} };
      },
    });

    assert.equal(ops.run('restart').ok, true);
    assert.equal(calls[0].args[3], join(repoRoot, 'scripts', 'restart-service.ps1'));
    assert.equal(calls[0].options.cwd, repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});

test('restart finds the repo root when the process cwd is outside the repo', () => {
  const originalCwd = process.cwd();
  const outsideCwd = mkdtempSync(join(tmpdir(), 'irc-service-ops-outside-'));
  const repoRoot = resolve(__dirname, '../../..');

  try {
    process.chdir(outsideCwd);
    const calls = [];
    const ops = createServiceOps({
      env: { CODEX_SERVICE_OPS_DIRECT: '1' },
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { unref() {} };
      },
    });

    assert.equal(ops.run('restart').ok, true);
    assert.equal(calls[0].args[3], join(repoRoot, 'scripts', 'restart-service.ps1'));
    assert.equal(calls[0].options.cwd, repoRoot);
  } finally {
    process.chdir(originalCwd);
    rmSync(outsideCwd, { recursive: true, force: true });
  }
});

test('restart script logs docker failures and continues node restart', () => {
  const script = readFileSync(join(__dirname, '../../../scripts/restart-service.ps1'), 'utf8');

  assert.match(script, /WARN docker restart failed/);
  assert.match(script, /Restart completed for Node control-plane services/);
  assert.ok(script.indexOf('WARN docker restart failed') < script.indexOf('Stopping Node control-plane processes'));
});

test('restart script stops control-plane processes launched with relative paths', () => {
  const script = readFileSync(join(__dirname, '../../../scripts/restart-service.ps1'), 'utf8');

  assert.match(script, /Normalize-CommandLinePath/);
  assert.match(script, /packages\/orchestrator\/src\/codex-bot\.js/);
  assert.match(script, /apps\/orchestrator\/src\/index\.ts/);
  assert.doesNotMatch(script, /\$_.CommandLine -and \$_.CommandLine -match \$escapedRoot -and \$_.CommandLine -match \$Pattern/);
});

test('service scripts start the service-control loop', () => {
  const restartScript = readFileSync(join(__dirname, '../../../scripts/restart-service.ps1'), 'utf8');
  const startScript = readFileSync(join(__dirname, '../../../scripts/start-helper.ps1'), 'utf8');
  const loopScript = readFileSync(join(__dirname, '../../../scripts/service-control-loop.ps1'), 'utf8');

  assert.match(restartScript, /service-control-loop\.ps1/);
  assert.match(startScript, /service-control-loop\.ps1/);
  assert.match(loopScript, /Invoke-Restart/);
  assert.match(loopScript, /Invoke-Build/);
  assert.match(loopScript, /Get-Command npm\.cmd/);
  assert.match(loopScript, /restart-service\.ps1/);
});
