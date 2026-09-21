/** @type {import('expo/config').ExpoConfig} */
module.exports = () => {
  const base = require('./app.json');
  const expo = { ...base.expo };

  // Play Store / production builds must not ship the Expo dev launcher.
  if (process.env.PLAY_STORE_BUILD === '1') {
    expo.plugins = (expo.plugins || []).filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-dev-client';
    });
  }

  return { expo };
};
