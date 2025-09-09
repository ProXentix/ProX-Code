/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as ProX-Code from 'ProX-Code';

(ProX-Code.env.uiKind === ProX-Code.UIKind.Web ? suite.skip : suite)('ipynb NotebookSerializer', function () {
	test('Can open an ipynb notebook', async () => {
		assert.ok(ProX-Code.workspace.workspaceFolders);
		const workspace = ProX-Code.workspace.workspaceFolders[0];
		const uri = ProX-Code.Uri.joinPath(workspace.uri, 'test.ipynb');
		const notebook = await ProX-Code.workspace.openNotebookDocument(uri);
		await ProX-Code.window.showNotebookDocument(notebook);

		const notebookEditor = ProX-Code.window.activeNotebookEditor;
		assert.ok(notebookEditor);

		assert.strictEqual(notebookEditor.notebook.cellCount, 2);
		assert.strictEqual(notebookEditor.notebook.cellAt(0).kind, ProX-Code.NotebookCellKind.Markup);
		assert.strictEqual(notebookEditor.notebook.cellAt(1).kind, ProX-Code.NotebookCellKind.Code);
		assert.strictEqual(notebookEditor.notebook.cellAt(1).outputs.length, 1);
	});
});
