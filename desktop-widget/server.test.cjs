const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { startServer } = require('./server.cjs');

async function listen(handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
function urlOf(server) { return `http://127.0.0.1:${server.address().port}`; }

test('reuses an existing NewsNow server and does not stop it on exit', async (t) => {
  const server = await listen((req, res) => res.end(JSON.stringify({ v: '0.0.42' })));
  t.after(() => server.close());
  const url = urlOf(server);
  const service = await startServer({ url, version: '0.0.42' });
  assert.equal(service.owned, false);
  await service.stop();
  assert.equal((await fetch(`${url}/api/latest`)).status, 200);
});

test('refuses an occupied port belonging to a different service', async (t) => {
  const server = await listen((req, res) => res.end('<html>other app</html>'));
  t.after(() => server.close());
  await assert.rejects(startServer({ url: urlOf(server), version: '0.0.42' }), /占用/);
});

test('launches a real Node server from a path with spaces and stops only its child', async (t) => {
  const reservation = await listen((req, res) => res.end());
  const url = urlOf(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'newsnow 卡片 test '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'dist/output/server'), { recursive: true });
  fs.writeFileSync(path.join(root, '.env.server'), 'TEST_NEWSNOW_VERSION=0.0.42\n');
  fs.writeFileSync(path.join(root, 'dist/output/server/index.mjs'), `
    import http from 'node:http';
    http.createServer((req, res) => res.end(JSON.stringify({v: process.env.TEST_NEWSNOW_VERSION})))
      .listen(Number(process.env.PORT), process.env.HOST);
  `);
  const service = await startServer({ root, nodePath: process.execPath, url, version: '0.0.42' });
  t.after(() => service.stop());
  assert.equal(service.owned, true);
  assert.equal((await (await fetch(`${url}/api/latest`)).json()).v, '0.0.42');
  await service.stop();
  await assert.rejects(fetch(url));
});
