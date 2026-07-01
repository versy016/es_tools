const path = require('path');

// CRACO lets us tweak Create React App's webpack without ejecting.
// Excalidraw's prod bundle imports `roughjs/bin/rough` in a way CRA's resolver
// rejects; alias it straight to the file so Excalidraw (and Toast UI) build.
module.exports = {
    // Scope `--coverage` to the code unit tests are responsible for: config, services,
    // utils, data, the legend, and lightweight components. The heavy canvas UI (the two
    // tool screens, annotators/engines, camera, signature pad, the PDF renderer) is
    // covered by the Playwright E2E suite instead of jsdom unit tests, so it's excluded
    // here to keep the coverage number an honest measure of the logic layer.
    jest: {
        configure: {
            collectCoverageFrom: [
                'src/**/*.{js,jsx}',
                '!src/**/*.test.{js,jsx}',
                '!src/index.js',
                '!src/setupTests.js',
                '!src/reportWebVitals.js',
                '!src/service-worker.js',
                '!src/serviceWorkerRegistration.js',
                '!src/tools/**',
                '!src/screens/**',
                '!src/components/engines/**',
                '!src/components/PhotoAnnotator.js',
                '!src/components/AnnotatorSwitch.js',
                '!src/components/CameraCapture.js',
                '!src/components/SignaturePad.js',
                '!src/report/PhotoReportPdf.jsx',
                '!src/scripts/**',
            ],
        },
    },
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
