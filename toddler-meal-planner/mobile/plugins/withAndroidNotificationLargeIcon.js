/**
 * Expo SDK 57's expo-notifications plugin does not yet expose `largeIcon`.
 * The native module already reads:
 *   expo.modules.notifications.large_notification_icon
 * This config plugin writes that meta-data and density drawables so Android
 * shows a full-color brand mark next to collapsed meal reminders.
 */
const {
  withDangerousMod,
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
} = require('fs');
const { resolve } = require('path');

const META_DATA_LARGE_ICON = 'expo.modules.notifications.large_notification_icon';
const LARGE_ICON_NAME = 'notification_large_icon';
const LARGE_ICON_RESOURCE = `@drawable/${LARGE_ICON_NAME}`;
const BASELINE_PX = 48;
const ANDROID_RES = 'android/app/src/main/res';

const DPI = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

const DEFAULT_SRC = './assets/notification-large-icon.png';

async function writeLargeIconDrawables(projectRoot, iconRelativePath) {
  const src = resolve(projectRoot, iconRelativePath);
  if (!existsSync(src)) {
    throw new Error(
      `[withAndroidNotificationLargeIcon] Missing large icon at ${iconRelativePath}`,
    );
  }

  await Promise.all(
    Object.entries(DPI).map(async ([dpi, scale]) => {
      const folder = resolve(projectRoot, ANDROID_RES, `drawable-${dpi}`);
      if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
      const px = Math.round(BASELINE_PX * scale);
      const { source } = await generateImageAsync(
        { projectRoot, cacheType: 'android-notification-large' },
        {
          src: iconRelativePath,
          width: px,
          height: px,
          resizeMode: 'cover',
          backgroundColor: 'transparent',
        },
      );
      writeFileSync(resolve(folder, `${LARGE_ICON_NAME}.png`), source);
    }),
  );
}

function removeLargeIconDrawables(projectRoot) {
  for (const dpi of Object.keys(DPI)) {
    const file = resolve(projectRoot, ANDROID_RES, `drawable-${dpi}`, `${LARGE_ICON_NAME}.png`);
    if (existsSync(file)) unlinkSync(file);
  }
}

function withLargeIconManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      META_DATA_LARGE_ICON,
      LARGE_ICON_RESOURCE,
      'resource',
    );
    return config;
  });
}

function withLargeIconAssets(config, iconRelativePath) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.projectRoot;
      removeLargeIconDrawables(root);
      await writeLargeIconDrawables(root, iconRelativePath);
      return config;
    },
  ]);
}

function withAndroidNotificationLargeIcon(config, props = {}) {
  const icon = props.icon || DEFAULT_SRC;
  config = withLargeIconAssets(config, icon);
  config = withLargeIconManifest(config);
  return config;
}

module.exports = withAndroidNotificationLargeIcon;
