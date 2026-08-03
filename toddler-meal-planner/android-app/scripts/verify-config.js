#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const webConfig = fs.readFileSync(path.join(root, 'www', 'config.js'), 'utf8');
const hasBaked = /LITTLEBOWL_DEFAULT_SERVER\s*=\s*['"]https?:\/\//.test(webConfig);

if (!config.server || !config.server.url) {
  console.error('Error: capacitor server.url must be set (production app endpoint).');
  process.exit(1);
}

console.log('OK — native apps open baked server.url:', config.server.url);
if (hasBaked) {
  console.log('www/config.js default matches production branding splash.');
} else {
  console.warn('Warning: www/config.js has no baked LITTLEBOWL_DEFAULT_SERVER');
}
if (!(config.server && Array.isArray(config.server.allowNavigation))) {
  console.warn('Warning: server.allowNavigation missing — plugins may break after navigation.');
}
