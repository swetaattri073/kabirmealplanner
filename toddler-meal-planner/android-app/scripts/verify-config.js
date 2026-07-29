#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const webConfig = fs.readFileSync(path.join(root, 'www', 'config.js'), 'utf8');
const hasBaked = /LITTLEBOWL_DEFAULT_SERVER\s*=\s*['"]https?:\/\//.test(webConfig);

if (config.server && config.server.url) {
  console.warn('Warning: capacitor server.url is set. Prefer local www + in-app setup.');
  console.warn('server.url =', config.server.url);
}

console.log('OK — Capacitor shell uses local setup screen (Android + iOS).');
if (hasBaked) {
  console.log('Default server is baked into www/config.js');
} else {
  console.log('No baked default — users enter the server URL on first launch.');
}
if (!(config.server && Array.isArray(config.server.allowNavigation))) {
  console.warn('Warning: server.allowNavigation missing — plugins may break after redirect.');
}
