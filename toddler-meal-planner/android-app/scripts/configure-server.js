#!/usr/bin/env node
/**
 * Set the Capacitor server.url used by the Android WebView shell.
 *
 * Usage:
 *   npm run configure -- https://your-littlebowl-host
 *   SERVER_URL=https://your-littlebowl-host npm run configure
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'capacitor.config.json');
const envPath = path.join(root, '.env');

function readEnvFile() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function normalizeUrl(raw) {
  const url = String(raw || '').trim().replace(/\/+$/, '');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`SERVER_URL must start with http:// or https:// (got: ${url})`);
  }
  return url;
}

const fromArg = process.argv[2];
const fromEnv = process.env.SERVER_URL || readEnvFile().SERVER_URL;
const serverUrl = normalizeUrl(fromArg || fromEnv);

if (!serverUrl) {
  console.error('Missing server URL.');
  console.error('Usage: npm run configure -- https://your-domain');
  console.error('   or: SERVER_URL=https://your-domain npm run configure');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
config.server = {
  url: serverUrl,
  cleartext: /^http:\/\//i.test(serverUrl),
  androidScheme: /^http:\/\//i.test(serverUrl) ? 'http' : 'https',
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
fs.writeFileSync(
  envPath,
  `# LittleBowl Android shell\nSERVER_URL=${serverUrl}\n`
);

console.log(`Configured Capacitor server.url → ${serverUrl}`);
console.log('Next: npm run sync');
