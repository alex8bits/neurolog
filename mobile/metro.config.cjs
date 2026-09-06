/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// React Native 0.87 removed `react-native/rn-get-polyfills`; the polyfills are
// now loaded via `Libraries/Core/InitializeCore` (see `getModulesRunBeforeMainModule`).
// `@expo/metro-config@57.0.x` still does `require(<rn-path>/rn-get-polyfills')()`
// inside its default `serializer.getPolyfills`, which 500s every native bundle.
// Returning an empty polyfill list matches the effect of the removed RN file.
config.serializer.getPolyfills = () => [];

module.exports = config;
