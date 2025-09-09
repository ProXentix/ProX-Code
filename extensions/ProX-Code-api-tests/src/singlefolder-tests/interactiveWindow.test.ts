/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as ProX-Code from 'ProX-Code';
import { asPromise, disposeAll } from '../utils';
import { Kernel, saveAllFilesAndCloseAll } from './notebook.api.test';

export type INativeInteractiveWindow = { notebookUri: ProX-Code.Uri; inputUri: ProX-Code.Uri; notebookEditor: ProX-Code.NotebookEditor };

async function createInteractiveWindow(kernel: Kernel) {
	const { notebookEditor, inputUri } = (await ProX-Code.commands.executeCommand(
		'interactive.open',
		// Keep focus on the owning file if there is one
		{ viewColumn: ProX-Code.ViewColumn.Beside, preserveFocus: false },
		undefined,
		`ProX-Code.ProX-Code-api-tests/${kernel.controller.id}`,
		undefined
	)) as unknown as INativeInteractiveWindow;
	assert.ok(notebookEditor, 'Interactive Window was not created successfully');

	return { notebookEditor, inputUri };
}

async function addCell(code: string, notebook: ProX-Code.NotebookDocument) {
	const cell = new ProX-Code.NotebookCellData(ProX-Code.NotebookCellKind.Code, code, 'typescript');
	const edit = ProX-Code.NotebookEdit.insertCells(notebook.cellCount, [cell]);
	const workspaceEdit = new ProX-Code.WorkspaceEdit();
	workspaceEdit.set(notebook.uri, [edit]);
	const event = asPromise(ProX-Code.workspace.onDidChangeNotebookDocument);
	await ProX-Code.workspace.applyEdit(workspaceEdit);
	await event;
	return notebook.cellAt(notebook.cellCount - 1);
}

async function addCellAndRun(code: string, notebook: ProX-Code.NotebookDocument) {
	const initialCellCount = notebook.cellCount;
	const cell = await addCell(code, notebook);

	const event = asPromise(ProX-Code.workspace.onDidChangeNotebookDocument);
	await ProX-Code.commands.executeCommand('notebook.cell.execute', { start: initialCellCount, end: initialCellCount + 1 }, notebook.uri);
	try {
		await event;
	} catch (e) {
		const result = notebook.cellAt(notebook.cellCount - 1);
		assert.fail(`Notebook change event was not triggered after executing newly added cell. Initial Cell count: ${initialCellCount}. Current cell count: ${notebook.cellCount}. execution summary: ${JSON.stringify(result.executionSummary)}`);
	}
	assert.strictEqual(cell.outputs.length, 1, `Executed cell has no output. Initial Cell count: ${initialCellCount}. Current cell count: ${notebook.cellCount}. execution summary: ${JSON.stringify(cell.executionSummary)}`);
	return cell;
}


(ProX-Code.env.uiKind === ProX-Code.UIKind.Web ? suite.skip : suite)('Interactive Window', function () {

	const testDisposables: ProX-Code.Disposable[] = [];
	let defaultKernel: Kernel;
	let secondKernel: Kernel;

	setup(async function () {
		defaultKernel = new Kernel('mainKernel', 'Notebook Default Kernel', 'interactive');
		secondKernel = new Kernel('secondKernel', 'Notebook Secondary Kernel', 'interactive');
		testDisposables.push(defaultKernel.controller);
		testDisposables.push(secondKernel.controller);
		await saveAllFilesAndCloseAll();
	});

	teardown(async function () {
		disposeAll(testDisposables);
		testDisposables.length = 0;
		await saveAllFilesAndCloseAll();
	});

	test.skip('Can open an interactive window and execute from input box', async () => {
		assert.ok(ProX-Code.workspace.workspaceFolders);
		const { notebookEditor, inputUri } = await createInteractiveWindow(defaultKernel);

		const inputBox = ProX-Code.window.visibleTextEditors.find(
			(e) => e.document.uri.path === inputUri.path
		);
		await inputBox!.edit((editBuilder) => {
			editBuilder.insert(new ProX-Code.Position(0, 0), 'print foo');
		});
		await ProX-Code.commands.executeCommand('interactive.execute', notebookEditor.notebook.uri);

		assert.strictEqual(notebookEditor.notebook.cellCount, 1);
		assert.strictEqual(notebookEditor.notebook.cellAt(0).kind, ProX-Code.NotebookCellKind.Code);
	});

	test('Interactive window scrolls after execute', async () => {
		assert.ok(ProX-Code.workspace.workspaceFolders);
		const { notebookEditor } = await createInteractiveWindow(defaultKernel);

		// Run and add a bunch of cells
		for (let i = 0; i < 10; i++) {
			await addCellAndRun(`print ${i}`, notebookEditor.notebook);
		}

		// Verify visible range has the last cell
		if (!lastCellIsVisible(notebookEditor)) {
			// scroll happens async, so give it some time to scroll
			await new Promise<void>((resolve) => setTimeout(() => {
				assert.ok(lastCellIsVisible(notebookEditor), `Last cell is not visible`);
				resolve();
			}, 1000));
		}
	});

	test('Interactive window has the correct kernel', async () => {
		assert.ok(ProX-Code.workspace.workspaceFolders);
		await createInteractiveWindow(defaultKernel);

		await ProX-Code.commands.executeCommand('workbench.action.closeActiveEditor');

		// Create a new interactive window with a different kernel
		const { notebookEditor } = await createInteractiveWindow(secondKernel);
		assert.ok(notebookEditor);

		// Verify the kernel is the secondary one
		await addCellAndRun(`print`, notebookEditor.notebook);

		assert.strictEqual(secondKernel.associatedNotebooks.has(notebookEditor.notebook.uri.toString()), true, `Secondary kernel was not set as the kernel for the interactive window`);

	});
});

function lastCellIsVisible(notebookEditor: ProX-Code.NotebookEditor) {
	if (!notebookEditor.visibleRanges.length) {
		return false;
	}
	const lastVisibleCell = notebookEditor.visibleRanges[notebookEditor.visibleRanges.length - 1].end;
	return notebookEditor.notebook.cellCount === lastVisibleCell;
}
