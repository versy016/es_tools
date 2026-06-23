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
            return webpackConfig;
        },
    },
};
