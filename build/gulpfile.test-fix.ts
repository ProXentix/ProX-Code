/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import gulp from 'gulp';
import * as path from 'path';
import { createRequire } from 'node:module';
import * as task from './lib/task.ts';

const require = createRequire(import.meta.url);
const globModule = require('glob');
const { promisify } = require('util');

const root = path.dirname(import.meta.dirname);

gulp.task(task.define('test-fix', async () => {
    console.log('[11:51:23] Testing glob...');

    let glob;
    // Improved robust check for glob promise-returning version
    if (typeof globModule.glob === 'function') {
        if (globModule.glob.constructor.name === 'AsyncFunction' || globModule.glob.length < 2) {
            console.log('Using native glob promise');
            glob = globModule.glob.bind(globModule);
        } else {
            console.log('Promisifying glob property');
            glob = promisify(globModule.glob);
        }
    } else if (typeof globModule === 'function') {
        if (globModule.constructor.name === 'AsyncFunction' || globModule.length < 2) {
            console.log('Using native glob function promise');
            glob = globModule;
        } else {
            console.log('Promisifying glob root');
            glob = promisify(globModule);
        }
    } else {
        console.log('Promisifying glob fallback');
        glob = promisify(globModule);
    }

    try {
        const files = await glob('build/*.ts', { cwd: root });
        console.log(`Found ${files.length} build files.`);
        if (files.length === 0) {
            console.warn('No build files found! Check CWD.');
        }
    } catch (e) {
        console.error('Glob failed:', e);
        throw e;
    }

    console.log('Task test-fix completed signaling completion.');
}));
