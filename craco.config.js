const path = require('path');

// CRACO lets us tweak Create React App's webpack without ejecting.
// Excalidraw's prod bundle imports `roughjs/bin/rough` in a way CRA's resolver
// rejects; alias it straight to the file so Excalidraw (and Toast UI) build.
module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            webpackConfig.resolve.alias = {
                ...(webpackConfig.resolve.alias || {}),
                'roughjs/bin': path.resolve(__dirname, 'node_modules/roughjs/bin'),
            };
            // webpack 5 marks Excalidraw's ESM chunks "fullySpecified", which rejects its
            // extension-less `roughjs/bin/rough` imports. Relax it so extensions resolve.
            webpackConfig.module.rules.push({
                test: /\.m?js$/,
                resolve: { fullySpecified: false },
            });
            // Silence noisy "Failed to parse source map" warnings from prebuilt deps
            // (e.g. Excalidraw's mermaid sub-package ships JS without its .ts sources).
            webpackConfig.ignoreWarnings = [
                ...(webpackConfig.ignoreWarnings || []),
                /Failed to parse source map/,
            ];
            return webpackConfig;
        },
    },
};
