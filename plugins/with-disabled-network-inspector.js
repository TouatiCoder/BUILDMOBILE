/**
 * Turns off the Expo dev-client network inspector on Android
 * (EX_DEV_CLIENT_NETWORK_INSPECTOR=false in android/gradle.properties).
 *
 * In debug builds it records every HTTP request for the DevTools "Network" tab.
 * It shares one java.math.BigDecimal timestamp between two events serialized on
 * different threads, and Android's BigDecimal is not thread-safe, so the app can
 * crash with "NullPointerException: Attempt to get length of null array"
 * (BigInt.putLittleEndianInts ... ExpoRequestCdpInterceptor). Release builds
 * never include the inspector, so this only affects development builds.
 */
const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'EX_DEV_CLIENT_NETWORK_INSPECTOR';

module.exports = function withDisabledNetworkInspector(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((item) => !(item.type === 'property' && item.key === KEY));
    cfg.modResults.push({ type: 'property', key: KEY, value: 'false' });
    return cfg;
  });
};
