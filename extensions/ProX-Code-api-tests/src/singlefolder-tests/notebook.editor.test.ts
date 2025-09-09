/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as ProX-Code from 'ProX-Code';
import * as utils from '../utils';

(ProX-Code.env.uiKind === ProX-Code.UIKind.Web ? suite.skip : suite.skip)('Notebook Editor', function () {

	const contentSerializer = new class implements ProX-Code.NotebookSerializer {
		deserializeNotebook() {
			return new ProX-Code.NotebookData(
				[new ProX-Code.NotebookCellData(ProX-Code.NotebookCellKind.Code, '// code cell', 'javascript')],
			);
		}
		serializeNotebook() {
			return new Uint8Array();
		}
	};

	const onDidOpenNotebookEditor = (timeout = ProX-Code.env.uiKind === ProX-Code.UIKind.Desktop ? 5000 : 15000) => {
		return new Promise<boolean>((resolve, reject) => {

			const handle = setTimeout(() => {
				sub.dispose();
				reject(new Error('onDidOpenNotebookEditor TIMEOUT reached'));
			}, timeout);

			const sub = ProX-Code.window.onDidChangeActiveNotebookEditor(() => {
				if (ProX-Code.window.activeNotebookEditor === undefined) {
					// skip if there is no active notebook editor (e.g. when opening a new notebook)
					return;
				}

				clearTimeout(handle);
				sub.dispose();
				resolve(true);
			});
		});
	};

	const disposables: ProX-Code.Disposable[] = [];
	const testDisposables: ProX-Code.Disposable[] = [];

	suiteTeardown(async function () {
		utils.assertNoRpc();
		await utils.revertAllDirty();
		await utils.closeAllEditors();
		utils.disposeAll(disposables);
		disposables.length = 0;

		for (const doc of ProX-Code.workspace.notebookDocuments) {
			assert.strictEqual(doc.isDirty, false, doc.uri.toString());
		}
	});

	suiteSetup(function () {
		disposables.push(ProX-Code.workspace.registerNotebookSerializer('notebook.nbdtest', contentSerializer));
	});

	teardown(async function () {
		utils.disposeAll(testDisposables);
		testDisposables.length = 0;
	});

	// #138683
	// TODO@rebornix https://github.com/microsoft/ProX-Code/issues/170072
	test.skip('Opening a notebook should fire activeNotebook event changed only once', utils.withVerboseLogs(async function () {
		const openedEditor = onDidOpenNotebookEditor();
		const resource = await utils.createRandomFile(undefined, undefined, '.nbdtest');
		const document = await ProX-Code.workspace.openNotebookDocument(resource);
		const editor = await ProX-Code.window.showNotebookDocument(document);
		assert.ok(await openedEditor);
		assert.strictEqual(editor.notebook.uri.toString(), resource.toString());
	}));

	// TODO@rebornix https://github.com/microsoft/ProX-Code/issues/173125
	test.skip('Active/Visible Editor', async function () {
		const firstEditorOpen = onDidOpenNotebookEditor();
		const resource = await utils.createRandomFile(undefined, undefined, '.nbdtest');
		const document = await ProX-Code.workspace.openNotebookDocument(resource);

		const firstEditor = await ProX-Code.window.showNotebookDocument(document);
		await firstEditorOpen;
		assert.strictEqual(ProX-Code.window.activeNotebookEditor, firstEditor);
		assert.strictEqual(ProX-Code.window.visibleNotebookEditors.includes(firstEditor), true);

		const secondEditor = await ProX-Code.window.showNotebookDocument(document, { viewColumn: ProX-Code.ViewColumn.Beside });
		// There is no guarantee that when `showNotebookDocument` resolves, the active notebook editor is already updated correctly.
		// assert.strictEqual(secondEditor === ProX-Code.window.activeNotebookEditor, true);
		assert.notStrictEqual(firstEditor, secondEditor);
		assert.strictEqual(ProX-Code.window.visibleNotebookEditors.includes(secondEditor), true);
		assert.strictEqual(ProX-Code.window.visibleNotebookEditors.includes(firstEditor), true);
		assert.strictEqual(ProX-Code.window.visibleNotebookEditors.length, 2);
		await utils.closeAllEditors();
	});

	test('Notebook Editor Event - onDidChangeVisibleNotebookEditors on open/close', async function () {
		const openedEditor = utils.asPromise(ProX-Code.window.onDidChangeVisibleNotebookEditors);
		const resource = await utils.createRandomFile(undefined, undefined, '.nbdtest');
		const document = await ProX-Code.workspace.openNotebookDocument(resource);
		await ProX-Code.window.showNotebookDocument(document);
		assert.ok(await openedEditor);

		const firstEditorClose = utils.asPromise(ProX-Code.window.onDidChangeVisibleNotebookEditors);
		await utils.closeAllEditors();
		await firstEditorClose;
	});

	test('Notebook Editor Event - onDidChangeVisibleNotebookEditors on two editor groups', async function () {
		const resource = await utils.createRandomFile(undefined, undefined, '.nbdtest');
		const document = await ProX-Code.workspace.openNotebookDocument(resource);

		let count = 0;
		testDisposables.push(ProX-Code.window.onDidChangeVisibleNotebookEditors(() => {
			count = ProX-Code.window.visibleNotebookEditors.length;
		}));

		await ProX-Code.window.showNotebookDocument(document, { viewColumn: ProX-Code.ViewColumn.Active });
		assert.strictEqual(count, 1);

		await ProX-Code.window.showNotebookDocument(document, { viewColumn: ProX-Code.ViewColumn.Beside });
		assert.strictEqual(count, 2);

		await utils.closeAllEditors();
		assert.strictEqual(count, 0);
	});
});
