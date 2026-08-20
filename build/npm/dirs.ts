/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { existsSync } from 'fs';

/**
 * Complete list of directories where npm should be executed to install node modules
 */
export const dirs = [
	'',
	'build',
	'build/vite',
	'extensions',
	'extensions/git',
	'extensions/git-base',
	'extensions/github',
	'extensions/github-authentication',
	'extensions/proxpl',
	'extensions/proxpl/server',
	'remote',
	'remote/web',
	'test/automation',
	'test/integration/browser',
	'test/monaco',
	'test/mcp',
	'test/smoke',
];

if (existsSync(`${import.meta.dirname}/../../.build/distro/npm`)) {
	dirs.push('.build/distro/npm');
	dirs.push('.build/distro/npm/remote');
	dirs.push('.build/distro/npm/remote/web');
}
