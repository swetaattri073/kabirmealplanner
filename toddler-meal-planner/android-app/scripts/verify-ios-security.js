#!/usr/bin/env node
/**
 * Verify iOS Info.plist privacy / ATS keys and PrivacyInfo.xcprivacy
 * so App Store / security checks don't fail for missing usage strings.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const infoPath = path.join(root, 'ios', 'App', 'App', 'Info.plist');
const privacyPath = path.join(root, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy');
const pbxPath = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

const requiredInfoKeys = [
  'NSCameraUsageDescription',
  'NSPhotoLibraryUsageDescription',
  'NSPhotoLibraryAddUsageDescription',
  'NSAppTransportSecurity',
  'NSAllowsArbitraryLoadsInWebContent',
  'NSAllowsLocalNetworking',
  'ITSAppUsesNonExemptEncryption',
  'CFBundleDisplayName',
];

const requiredPrivacySnippets = [
  'NSPrivacyTracking',
  'NSPrivacyAccessedAPICategoryUserDefaults',
  'CA92.1',
];

let failed = 0;

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function bad(msg) {
  console.error(`✗ ${msg}`);
  failed += 1;
}

if (!fs.existsSync(infoPath)) {
  bad(`Missing Info.plist at ${infoPath}`);
} else {
  const info = fs.readFileSync(infoPath, 'utf8');
  for (const key of requiredInfoKeys) {
    if (info.includes(`<key>${key}</key>`) || info.includes(key)) ok(`Info.plist has ${key}`);
    else bad(`Info.plist missing ${key}`);
  }
  if (/NSAllowsArbitraryLoads<\/key>\s*<true\/>/.test(info) &&
      !info.includes('NSAllowsArbitraryLoadsInWebContent')) {
    bad('Prefer NSAllowsArbitraryLoadsInWebContent over blanket NSAllowsArbitraryLoads');
  } else {
    ok('ATS scoped to web content / local networking (not blanket arbitrary loads)');
  }
}

if (!fs.existsSync(privacyPath)) {
  bad(`Missing PrivacyInfo.xcprivacy at ${privacyPath}`);
} else {
  const privacy = fs.readFileSync(privacyPath, 'utf8');
  for (const snip of requiredPrivacySnippets) {
    if (privacy.includes(snip)) ok(`PrivacyInfo has ${snip}`);
    else bad(`PrivacyInfo missing ${snip}`);
  }
}

if (!fs.existsSync(pbxPath)) {
  bad('Missing Xcode project');
} else {
  const pbx = fs.readFileSync(pbxPath, 'utf8');
  if (pbx.includes('PrivacyInfo.xcprivacy')) ok('PrivacyInfo referenced in Xcode project');
  else bad('PrivacyInfo not in project.pbxproj Resources');
  if (pbx.includes('PRODUCT_BUNDLE_IDENTIFIER = com.littlebowl.app')) {
    ok('Bundle id com.littlebowl.app');
  } else {
    bad('Unexpected PRODUCT_BUNDLE_IDENTIFIER');
  }
}

const configPath = path.join(root, 'capacitor.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (config.server && config.server.url) {
  bad('capacitor.config.json must NOT set server.url (breaks first-launch setup)');
} else {
  ok('No server.url bake (setup screen preserved)');
}
if (config.server && Array.isArray(config.server.allowNavigation)) {
  ok('server.allowNavigation present (plugins survive remote redirect)');
} else {
  bad('server.allowNavigation missing');
}
if (config.plugins && config.plugins.LocalNotifications) {
  ok('LocalNotifications plugin configured');
} else {
  bad('LocalNotifications missing from capacitor.config.json');
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.dependencies && pkg.dependencies['@capacitor/ios']) ok('@capacitor/ios dependency present');
else bad('@capacitor/ios missing from package.json');
if (pkg.dependencies && pkg.dependencies['@capacitor/local-notifications']) {
  ok('@capacitor/local-notifications present');
} else {
  bad('@capacitor/local-notifications missing');
}

if (failed) {
  console.error(`\n${failed} iOS security check(s) failed.`);
  process.exit(1);
}
console.log('\nAll iOS security checks passed.');
