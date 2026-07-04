import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface RuntimeGuardian {
  release(): void;
}

export interface RuntimeGuardianOptions {
  lockPath: string;
  processId?: number;
  isProcessAlive?: (pid: number) => boolean;
}

interface LockFile {
  pid: number;
  startedAt: string;
}

const activeLocks = new Map<string, number>();

export function acquireRuntimeGuardian(options: RuntimeGuardianOptions): RuntimeGuardian {
  const processId = options.processId ?? process.pid;
  const isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;

  mkdirSync(dirname(options.lockPath), { recursive: true });
  const activePid = activeLocks.get(options.lockPath);
  if (activePid !== undefined) {
    throw new Error(`orchestrator already running as pid ${activePid}`);
  }

  const lock: LockFile = { pid: processId, startedAt: new Date().toISOString() };
  writeLock(options.lockPath, lock, isProcessAlive, processId);
  activeLocks.set(options.lockPath, processId);

  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      activeLocks.delete(options.lockPath);
      const current = readLock(options.lockPath);
      if (current?.pid === processId) rmSync(options.lockPath, { force: true });
    },
  };
}

function writeLock(
  lockPath: string,
  lock: LockFile,
  isProcessAlive: (pid: number) => boolean,
  processId: number,
): void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        writeFileSync(fd, `${JSON.stringify(lock)}\n`, { encoding: 'utf8' });
      } finally {
        closeSync(fd);
      }
      return;
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
      const existing = readLock(lockPath);
      if (existing && existing.pid !== processId && isProcessAlive(existing.pid)) {
        throw new Error(`orchestrator already running as pid ${existing.pid}`);
      }
      rmSync(lockPath, { force: true });
    }
  }
}

function readLock(lockPath: string): LockFile | null {
  if (!existsSync(lockPath)) return null;
  try {
    const data = JSON.parse(readFileSync(lockPath, 'utf8')) as Partial<LockFile>;
    return typeof data.pid === 'number' ? { pid: data.pid, startedAt: String(data.startedAt ?? '') } : null;
  } catch {
    return null;
  }
}

function isFileExistsError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
