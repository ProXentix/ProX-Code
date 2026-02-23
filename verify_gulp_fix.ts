/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import path from 'path';
import * as task from './build/lib/task.ts';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const globModule = require('glob');
const rceditCallback = require('rcedit');
const { promisify } = require('util');

const glob = promisify(globModule.glob || globModule);
const rcedit = promisify(rceditCallback);

async function testFixes() {
    console.log("Testing glob promisification...");
    try {
        const files = await glob('build/*.ts');
        console.log(`Found ${files.length} files.`);
    } catch (e) {
        console.error("Glob failed:", e);
    }

    console.log("Testing task execution...");
    const subTask = task.define('sub-task', async () => {
        console.log("Inside sub-task");
        await new Promise(r => setTimeout(r, 100));
        console.log("Sub-task finishing");
    });

    const mainTask = task.define('main-task', task.series(subTask));

    console.log("Executing main-task...");
    try {
        // task.series returns an async function, so we can just call it
        await mainTask();
        console.log("Main-task completed successfully!");
    } catch (e) {
        console.error("Main-task failed:", e);
    }
}

testFixes().catch(console.error);
