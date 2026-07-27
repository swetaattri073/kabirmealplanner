#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'));
const url = config.server && config.server.url;
if (!url || /REPLACE_WITH/i.test(url)) {
  console.error('Android shell is not pointed at a live server yet.');
  console.error('Run: npm run configure -- https://YOUR_DOMAIN');
  process.exit(1);
}
console.log('OK — Android shell loads', url);
