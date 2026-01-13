/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
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
	'extensions/configuration-editing',
	'extensions/git',
	'extensions/git-base',
	'extensions/ini',
	'extensions/json',
	'extensions/json-language-features',
	'extensions/json-language-features/server',
	'extensions/log',
	'extensions/markdown-basics',
	'extensions/markdown-language-features',
	'extensions/markdown-math',
	'extensions/proxpl',
	'extensions/references-view',
	'extensions/search-result',
	'extensions/terminal-suggest',
	'extensions/theme-defaults',
	'extensions/theme-seti',
	'extensions/yaml',
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
