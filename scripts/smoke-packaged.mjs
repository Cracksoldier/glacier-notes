import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const requestedPlatform = process.argv[2] ?? process.platform;
const executables = {
  linux: path.join('release', 'linux-unpacked', 'glacier-notes'),
  win32: path.join('release', 'win-unpacked', 'Glacier Notes.exe'),
  darwin: path.join('release', 'mac', 'Glacier Notes.app', 'Contents', 'MacOS', 'Glacier Notes'),
};
const relativeExecutable = executables[requestedPlatform];

if (!relativeExecutable) {
  throw new Error(`Unsupported smoke platform: ${requestedPlatform}`);
}

const executable = path.resolve(relativeExecutable);
if (!fs.existsSync(executable)) {
  throw new Error(`Packaged executable not found: ${executable}`);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glacier-packaged-smoke-'));
const resultFile = path.join(tempDir, 'result.json');
const child = spawn(executable, [], {
  env: {
    ...process.env,
    GLACIER_SMOKE: '1',
    GLACIER_SMOKE_OFFLINE: '1',
    GLACIER_SMOKE_RESULT: resultFile,
    GLACIER_SMOKE_USER_DATA: path.join(tempDir, 'user-data'),
  },
  stdio: 'inherit',
});

const timer = setTimeout(() => {
  child.kill('SIGKILL');
}, 30_000);

const exitResult = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ code, signal }));
});
clearTimeout(timer);

try {
  if (exitResult.code !== 0) {
    const reason =
      exitResult.code === null
        ? `signal ${exitResult.signal ?? 'unknown'}`
        : `code ${exitResult.code}`;
    throw new Error(`Packaged app exited with ${reason}`);
  }
  if (!fs.existsSync(resultFile)) throw new Error('Packaged app did not write a smoke result');

  const result = JSON.parse(fs.readFileSync(resultFile, 'utf-8'));
  if (result.ping !== 'pong') throw new Error(`Unexpected preload result: ${result.ping}`);
  if (result.requireType !== 'undefined') {
    throw new Error(`Renderer exposed Node require: ${result.requireType}`);
  }
  if (!String(result.title).includes('Glacier Notes')) {
    throw new Error(`Unexpected rendered title: ${result.title}`);
  }
  if (!Array.isArray(result.remoteRequests) || result.remoteRequests.length > 0) {
    throw new Error(`Runtime attempted network access: ${JSON.stringify(result.remoteRequests)}`);
  }
  const remoteResources = (result.resources ?? []).filter((resource) =>
    /^(?:https?|wss?):\/\//i.test(resource),
  );
  if (remoteResources.length > 0) {
    throw new Error(`Renderer loaded remote resources: ${JSON.stringify(remoteResources)}`);
  }

  console.log(`Packaged ${requestedPlatform} smoke verification passed.`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
