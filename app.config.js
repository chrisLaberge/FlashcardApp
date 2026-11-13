// Test builds (development, preview) only build for 64-bit phones: much faster. Production keeps every
// architecture Play needs. eas.json sets ARM64_ONLY for the test profiles.
module.exports = ({ config }) => {
  if (process.env.ARM64_ONLY !== "1") return config;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ["expo-build-properties", { android: { buildArchs: ["arm64-v8a"] } }]],
  };
};
