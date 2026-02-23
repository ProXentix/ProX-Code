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
    // Improved check for glob v11/v10
    if (typeof globModule.glob === 'function' && (globModule.glob.toString().includes('async') || !globModule.glob.length)) {
        console.log('Using native glob promise');
        glob = globModule.glob;
    } else {
        console.log('Promisifying glob');
        glob = promisify(globModule.glob || globModule);
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
