/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check
import path from 'path';
import { fileURLToPath } from 'url';

try {
    console.log('Starting debug script...');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    console.log('__dirname:', __dirname);

    const srcDir = path.join(__dirname, 'preview-src');
    const outDir = path.join(__dirname, 'media');
    console.log('srcDir:', srcDir);
    console.log('outDir:', outDir);

    const entryPoint1 = path.join(srcDir, 'index.ts');
    const entryPoint2 = path.join(srcDir, 'pre');
    console.log('entryPoint1:', entryPoint1);
    console.log('entryPoint2:', entryPoint2);

    const { run } = await import('../esbuild-webview-common.mjs');
    console.log('esbuild-webview-common loaded successfully');

    await run({
        entryPoints: [
            entryPoint1,
            entryPoint2,
        ],
        srcDir,
        outdir: outDir,
    }, process.argv);

    console.log('Build completed successfully!');
    process.exit(0);
} catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
}
