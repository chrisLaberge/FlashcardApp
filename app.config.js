// Test builds (development, preview) only build for 64-bit phones: much faster. Production keeps every
// architecture Play needs. eas.json sets ARM64_ONLY for the test profiles.
module.exports = ({ config }) => {
  // The real AdMob app id (from the AdMob site) replaces Google's test id when ADMOB_ANDROID_APP_ID is set for the build.
  const realAppId = process.env.ADMOB_ANDROID_APP_ID;
  let plugins = config.plugins ?? [];
  if (realAppId) {
    plugins = plugins.map((p) => (Array.isArray(p) && p[0] === "react-native-google-mobile-ads" ? [p[0], { ...p[1], androidAppId: realAppId }] : p));
  }
  if (process.env.ARM64_ONLY === "1") plugins = [...plugins, ["expo-build-properties", { android: { buildArchs: ["arm64-v8a"] } }]];
  return { ...config, plugins };
};
