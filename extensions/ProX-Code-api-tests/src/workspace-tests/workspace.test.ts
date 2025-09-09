/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { join } from 'path';
import * as ProX-Code from 'ProX-Code';
import { closeAllEditors, pathEquals } from '../utils';

suite('ProX-Code API - workspace', () => {

	teardown(closeAllEditors);

	test('rootPath', () => {
		assert.ok(pathEquals(ProX-Code.workspace.rootPath!, join(__dirname, '../../testWorkspace')));
	});

	test('workspaceFile', () => {
		assert.ok(pathEquals(ProX-Code.workspace.workspaceFile!.fsPath, join(__dirname, '../../testworkspace.code-workspace')));
	});

	test('workspaceFolders', () => {
		assert.strictEqual(ProX-Code.workspace.workspaceFolders!.length, 2);
		assert.ok(pathEquals(ProX-Code.workspace.workspaceFolders![0].uri.fsPath, join(__dirname, '../../testWorkspace')));
		assert.ok(pathEquals(ProX-Code.workspace.workspaceFolders![1].uri.fsPath, join(__dirname, '../../testWorkspace2')));
		assert.ok(pathEquals(ProX-Code.workspace.workspaceFolders![1].name, 'Test Workspace 2'));
	});

	test('getWorkspaceFolder', () => {
		const folder = ProX-Code.workspace.getWorkspaceFolder(ProX-Code.Uri.file(join(__dirname, '../../testWorkspace2/far.js')));
		assert.ok(!!folder);

		if (folder) {
			assert.ok(pathEquals(folder.uri.fsPath, join(__dirname, '../../testWorkspace2')));
		}
	});
});
