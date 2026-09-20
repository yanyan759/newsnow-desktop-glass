const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

async function probe(url, version) {
  let response;
  try {
    response = await fetch(`${url}/api/latest`, { signal: AbortSignal.timeout(1500), redirect: 'error' });
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') return false;
    throw new Error('本地端口可能被占用，或服务没有响应。请检查 4444 端口。', { cause: error });
  }
  let data;
  try { data = await response.json(); } catch { /* A non-NewsNow HTTP server. */ }
  if (!response.ok || data?.v !== version) throw new Error('本地端口已被其他程序或不同版本占用，请关闭冲突程序后重试。');
  return true;
}

async function startServer({ root, nodePath, url, version, log = () => {} }) {
  if (await probe(url, version)) return { owned: false, stop: async () => {} };
  const entry = path.join(root, 'dist/output/server/index.mjs');
  if (!fs.existsSync(entry)) throw new Error('缺少生产构建，请在项目目录运行 corepack pnpm build。');
  const envFile = path.join(root, '.env.server');
  if (!fs.existsSync(envFile)) throw new Error('找不到 .env.server 配置文件。');
  const target = new URL(url);
  const child = spawn(nodePath, ['--env-file', envFile, entry], {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, HOST: target.hostname, PORT: target.port, NITRO_HOST: target.hostname, NITRO_PORT: target.port, NODE_USE_ENV_PROXY: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => log(data.toString()));
  child.stderr.on('data', data => log(data.toString()));
  let failure;
  child.on('error', error => { failure = error; });
  const stopped = new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); });
  async function stop() {
    if (child.exitCode === null && child.signalCode === null && !failure) child.kill();
    await stopped;
  }
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure) throw new Error(`无法启动 Node：${failure.message}`);
      if (child.exitCode !== null || child.signalCode !== null) throw new Error('新闻服务启动后退出，请查看卡片菜单中的日志。');
      if (await probe(url, version)) return { owned: true, stop };
      await delay(200);
    }
    throw new Error('本地新闻服务启动超时，请查看卡片菜单中的日志。');
  } catch (error) {
    await stop();
    throw error;
  }
}

module.exports = { startServer };
