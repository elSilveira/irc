const { spawnSync, spawn } = require('node:child_process');
const { existsSync, mkdirSync, renameSync, writeFileSync } = require('node:fs');
const { dirname, join, parse, resolve } = require('node:path');

const ACTIONS = Object.freeze({
  build: { mode: 'sync', command: 'npm', args: ['run', 'typecheck'] },
  restart: { mode: 'async', command: 'powershell.exe' },
  deploy: { mode: 'queued' },
});

function createServiceOps(options = {}) {
  const cwd = resolve(options.cwd || process.cwd());
  const repoRoot = resolveRepoRoot(cwd, options.cwd !== undefined);
  const env = options.env || process.env;
  const spawnProcess = options.spawn || spawn;
  const spawnSyncProcess = options.spawnSync || spawnSync;
  return {
    run(action) {
      if (action === 'build') return runBuild(repoRoot, env, spawnSyncProcess);
      if (action === 'restart') return runRestart(repoRoot, env, spawnProcess);
      if (action === 'deploy') return queueServiceOp(repoRoot, 'deploy');
      return { ok: false, message: `Unknown service op: ${action}` };
    },
  };
}

function resolveRepoRoot(cwd, hasExplicitCwd) {
  return findRepoRoot(cwd) || (hasExplicitCwd ? cwd : findRepoRoot(__dirname)) || cwd;
}

function findRepoRoot(start) {
  let current = resolve(start);
  const root = parse(current).root;

  while (true) {
    if (isRepoRoot(current)) return current;
    if (current === root) return null;
    current = dirname(current);
  }
}

function isRepoRoot(directory) {
  return existsSync(join(directory, 'package.json')) && existsSync(join(directory, 'scripts', 'restart-service.ps1'));
}

function runBuild(cwd, env, spawnSyncProcess) {
  const result = spawnSyncProcess(ACTIONS.build.command, ACTIONS.build.args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status === 0) return { ok: true, message: 'Build passed: npm run typecheck' };
  if (result.error && ['EPERM', 'EACCES', 'ENOENT'].includes(result.error.code)) {
    return queueServiceOp(cwd, 'build');
  }
  const detail = firstLine(result.stderr) || firstLine(result.stdout) || `exit ${result.status}`;
  return { ok: false, message: `Build failed: ${detail}` };
}

function runRestart(cwd, env, spawnProcess) {
  if (process.platform === 'win32' && !env.CODEX_SERVICE_OPS_DIRECT) {
    return queueServiceOp(cwd, 'restart');
  }
  return launchRestartScript(cwd, env, spawnProcess);
}

function launchRestartScript(cwd, env, spawnProcess) {
  const script = join(cwd, 'scripts', 'restart-service.ps1');
  try {
    const child = spawnProcess(ACTIONS.restart.command, ['-ExecutionPolicy', 'Bypass', '-File', script], {
      cwd,
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    return { ok: true, message: 'Restart launched: scripts/restart-service.ps1' };
  } catch (error) {
    return { ok: false, message: `Restart failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function queueServiceOp(cwd, action) {
  const queueDir = join(cwd, 'data', 'service-ops');
  const id = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const requestPath = join(queueDir, `${id}.${action}.request.json`);
  const tempPath = `${requestPath}.tmp`;
  try {
    mkdirSync(queueDir, { recursive: true });
    writeFileSync(tempPath, JSON.stringify({
      id,
      action,
      createdAt: new Date().toISOString(),
    }, null, 2));
    renameSync(tempPath, requestPath);
    const script = action === 'restart' ? 'scripts/restart-service.ps1' : 'npm run typecheck';
    if (action === 'deploy') {
      return { ok: true, message: 'Deploy requested: service-control loop will build then restart' };
    }
    return { ok: true, message: `${titleCase(action)} requested: service-control loop will run ${script}` };
  } catch (error) {
    return { ok: false, message: `${titleCase(action)} request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstLine(value) {
  return (value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

module.exports = { createServiceOps };
