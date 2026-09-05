const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream: require.resolve('./empty-module.js'),
  crypto: require.resolve('./empty-module.js'),
  http: require.resolve('./empty-module.js'),
  https: require.resolve('./empty-module.js'),
  net: require.resolve('./empty-module.js'),
  tls: require.resolve('./empty-module.js'),
  zlib: require.resolve('./empty-module.js'),
};

module.exports = config;
