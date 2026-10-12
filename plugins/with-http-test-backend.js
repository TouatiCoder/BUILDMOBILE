/**
 * Allows cleartext HTTP in release builds ONLY when EXPO_PUBLIC_API_URL is an
 * http:// URL (temporary test backend). With an https:// URL nothing changes,
 * so production builds keep Android's default cleartext block.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withHttpTestBackend(config) {
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim().toLowerCase();
  if (!apiUrl.startsWith('http://')) return config;

  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:usesCleartextTraffic'] = 'true';
    return cfg;
  });
};
