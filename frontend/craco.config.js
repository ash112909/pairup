// craco.config.js
module.exports = {
  webpack: {
    configure: (config) => {
      // Find the top-level rule that uses source-map-loader (enforce: 'pre')
      const preRule = config.module.rules.find(
        (r) =>
          r.enforce === 'pre' &&
          r.use &&
          Array.isArray(r.use) &&
          r.use.some((u) => u.loader && u.loader.includes('source-map-loader'))
      );

      // Exclude @capacitor-community/http from that rule
      if (preRule) {
        preRule.exclude = Array.isArray(preRule.exclude)
          ? preRule.exclude
          : preRule.exclude
          ? [preRule.exclude]
          : [];
        preRule.exclude.push(/@capacitor-community\/http/);
      }

      // Backstop: silence warnings that might still surface from that package
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        (warning) =>
          warning?.module?.resource &&
          /node_modules\/@capacitor-community\/http/.test(warning.module.resource),
      ];

      return config;
    },
  },
};
