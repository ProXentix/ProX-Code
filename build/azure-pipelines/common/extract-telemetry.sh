#!/usr/bin/env bash
set -e

cd $BUILD_STAGINGDIRECTORY
mkdir extraction
cd extraction
git clone --depth 1 https://github.com/microsoft/ProX-Code-extension-telemetry.git
git clone --depth 1 https://github.com/microsoft/ProX-Code-chrome-debug-core.git
git clone --depth 1 https://github.com/microsoft/ProX-Code-node-debug2.git
git clone --depth 1 https://github.com/microsoft/ProX-Code-node-debug.git
git clone --depth 1 https://github.com/microsoft/ProX-Code-html-languageservice.git
git clone --depth 1 https://github.com/microsoft/ProX-Code-json-languageservice.git
node $BUILD_SOURCESDIRECTORY/node_modules/.bin/ProX-Code-telemetry-extractor --sourceDir $BUILD_SOURCESDIRECTORY --excludedDir $BUILD_SOURCESDIRECTORY/extensions --outputDir . --applyEndpoints
node $BUILD_SOURCESDIRECTORY/node_modules/.bin/ProX-Code-telemetry-extractor --config $BUILD_SOURCESDIRECTORY/build/azure-pipelines/common/telemetry-config.json -o .
mkdir -p $BUILD_SOURCESDIRECTORY/.build/telemetry
mv declarations-resolved.json $BUILD_SOURCESDIRECTORY/.build/telemetry/telemetry-core.json
mv config-resolved.json $BUILD_SOURCESDIRECTORY/.build/telemetry/telemetry-extensions.json
cd ..
rm -rf extraction
