'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dist = path.join(__dirname, '..', 'agent-office-deploy', 'dist');
const server = fs.readFileSync(path.join(dist, 'server.js'), 'utf8');
const client = fs.readFileSync(path.join(dist, 'app-shared.js'), 'utf8');

test('deployment endpoint exposes the Railway deployment and process start time', () => {
  assert.match(server, /pathname === '\/api\/deployment-info'/);
  assert.match(server, /RAILWAY_DEPLOYMENT_ID/);
  assert.match(server, /updatedAt: PROCESS_STARTED_AT/);
});

test('topbar renders and refreshes the Railway update age', () => {
  assert.match(client, /id = 'railway-updated'/);
  assert.match(client, /Railway updated/);
  assert.match(client, /setInterval\(renderDeploymentUpdate, 60000\)/);
});
