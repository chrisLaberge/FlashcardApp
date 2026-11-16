// Test builds (development, preview) only build for 64-bit phones: much faster. Production keeps every
// architecture Play needs. eas.json sets ARM64_ONLY for the test profiles.
module.exports = ({ config }) => {
  // The real AdMob app id (from the AdMob site) replaces Google's test id when ADMOB_ANDROID_APP_ID is set for the build.
  const realAppId = process.env.ADMOB_ANDROID_APP_ID;
  let plugins = config.plugins ?? [];
  if (realAppId) {
    plugins = plugins.map((p) => (Array.isArray(p) && p[0] === "react-native-google-mobile-ads" ? [p[0], { ...p[1], androidAppId: realAppId }] : p));
  }
  // ANDROID_ARCHS (comma separated) picks which phone types to build, e.g. "arm64-v8a,armeabi-v7a" for a lighter build that still
  // keeps almost every real phone. ARM64_ONLY=1 means just arm64-v8a (test builds).
  const archs = process.env.ANDROID_ARCHS ? process.env.ANDROID_ARCHS.split(",").map((a) => a.trim()).filter(Boolean) : process.env.ARM64_ONLY === "1" ? ["arm64-v8a"] : null;
  if (archs) plugins = [...plugins, ["expo-build-properties", { android: { buildArchs: archs } }]];
  return { ...config, plugins };
};
