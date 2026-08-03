#!/usr/bin/env node
/**
 * Point the native apps at a LittleBowl backend URL.
 * Default / production: http://littlebowl.in/home
 *
 * Usage:
 *   npm run configure
 *   npm run configure -- http://littlebowl.in/home
 *   SERVER_URL=https://your-domain/home npm run configure
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const configPath = path.join(root, 'capacitor.config.json');
const envPath = path.join(root, '.env');
const webConfigPath = path.join(root, 'www', 'config.js');
const DEFAULT_URL = 'http://littlebowl.in/home';

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
  let url = String(raw || '').trim().replace(/\/+$/, '');
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`SERVER_URL must start with http:// or https:// (got: ${url})`);
  }
  try {
    const u = new URL(url);
    if (u.pathname === '' || u.pathname === '/') {
      url = `${u.origin}/home`;
    }
  } catch (e) { /* keep */ }
  return url;
}

const fromArg = process.argv[2];
const fromEnv = process.env.SERVER_URL || readEnvFile().SERVER_URL;
const serverUrl = normalizeUrl(fromArg || fromEnv || DEFAULT_URL);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const host = new URL(serverUrl).hostname;
config.server = {
  url: serverUrl,
  cleartext: true,
  allowNavigation: [
    host,
    `*.${host}`,
    `${new URL(serverUrl).origin}`,
    `${new URL(serverUrl).origin}/*`,
  ],
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

fs.writeFileSync(
  webConfigPath,
  `// Production LittleBowl app entry — baked into the native apps.\n` +
    `window.LITTLEBOWL_DEFAULT_SERVER = ${JSON.stringify(serverUrl)};\n`
);

fs.writeFileSync(
  envPath,
  `# LittleBowl native apps (Android + iOS)\nSERVER_URL=${serverUrl}\n`
);

console.log(`Native apps open → ${serverUrl}`);
console.log('No first-launch URL prompt — production app endpoint.');
console.log('Next: npm run sync');
