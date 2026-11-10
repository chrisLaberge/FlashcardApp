const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The Russian dictionary (az) ships as binary files; they are bundled as assets and read at run time.
config.resolver.assetExts.push("dawg", "intdawg", "array", "pdfjs");

// az contains require("fs") for use in Node. The phone has no fs and az is told how to load files
// instead (see src/services/morphology.ts), so that import is answered with nothing.
config.resolver.extraNodeModules = { ...config.resolver.extraNodeModules, fs: path.resolve(__dirname, "src/shims/emptyFs.js") };

module.exports = config;
