/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { assertNoRpc, assertNoRpcFromEntry, disposeAll } from '../utils';

suite('ProX-Code', function () {

	const dispo: ProX-Code.Disposable[] = [];

	teardown(() => {
		assertNoRpc();
		disposeAll(dispo);
	});

	test('no rpc', function () {
		assertNoRpc();
	});

	test('no rpc, createDiagnosticCollection()', function () {
		const item = ProX-Code.languages.createDiagnosticCollection();
		dispo.push(item);
		assertNoRpcFromEntry([item, 'DiagnosticCollection']);
	});

	test('no rpc, createTextEditorDecorationType(...)', function () {
		const item = ProX-Code.window.createTextEditorDecorationType({});
		dispo.push(item);
		assertNoRpcFromEntry([item, 'TextEditorDecorationType']);
	});

	test('no rpc, createOutputChannel(...)', function () {
		const item = ProX-Code.window.createOutputChannel('hello');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'OutputChannel']);
	});

	test('no rpc, createDiagnosticCollection(...)', function () {
		const item = ProX-Code.languages.createDiagnosticCollection();
		dispo.push(item);
		assertNoRpcFromEntry([item, 'DiagnosticCollection']);
	});

	test('no rpc, createQuickPick(...)', function () {
		const item = ProX-Code.window.createQuickPick();
		dispo.push(item);
		assertNoRpcFromEntry([item, 'QuickPick']);
	});

	test('no rpc, createInputBox(...)', function () {
		const item = ProX-Code.window.createInputBox();
		dispo.push(item);
		assertNoRpcFromEntry([item, 'InputBox']);
	});

	test('no rpc, createStatusBarItem(...)', function () {
		const item = ProX-Code.window.createStatusBarItem();
		dispo.push(item);
		assertNoRpcFromEntry([item, 'StatusBarItem']);
	});

	test('no rpc, createSourceControl(...)', function () {
		const item = ProX-Code.scm.createSourceControl('foo', 'Hello');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'SourceControl']);
	});

	test('no rpc, createCommentController(...)', function () {
		const item = ProX-Code.comments.createCommentController('foo', 'Hello');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'CommentController']);
	});

	test('no rpc, createWebviewPanel(...)', function () {
		const item = ProX-Code.window.createWebviewPanel('webview', 'Hello', ProX-Code.ViewColumn.Active);
		dispo.push(item);
		assertNoRpcFromEntry([item, 'WebviewPanel']);
	});

	test('no rpc, createTreeView(...)', function () {
		const treeDataProvider = new class implements ProX-Code.TreeDataProvider<string> {
			getTreeItem(element: string): ProX-Code.TreeItem | Thenable<ProX-Code.TreeItem> {
				return new ProX-Code.TreeItem(element);
			}
			getChildren(_element?: string): ProX-Code.ProviderResult<string[]> {
				return ['foo', 'bar'];
			}
		};
		const item = ProX-Code.window.createTreeView('test.treeId', { treeDataProvider });
		dispo.push(item);
		assertNoRpcFromEntry([item, 'TreeView']);
	});


	test('no rpc, createNotebookController(...)', function () {
		const ctrl = ProX-Code.notebooks.createNotebookController('foo', 'bar', '');
		dispo.push(ctrl);
		assertNoRpcFromEntry([ctrl, 'NotebookController']);
	});

	test('no rpc, createTerminal(...)', function () {
		const ctrl = ProX-Code.window.createTerminal({ name: 'termi' });
		dispo.push(ctrl);
		assertNoRpcFromEntry([ctrl, 'Terminal']);
	});

	test('no rpc, createFileSystemWatcher(...)', function () {
		const item = ProX-Code.workspace.createFileSystemWatcher('**/*.ts');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'FileSystemWatcher']);
	});

	test('no rpc, createTestController(...)', function () {
		const item = ProX-Code.tests.createTestController('iii', 'lll');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'TestController']);
	});

	test('no rpc, createLanguageStatusItem(...)', function () {
		const item = ProX-Code.languages.createLanguageStatusItem('i', '*');
		dispo.push(item);
		assertNoRpcFromEntry([item, 'LanguageStatusItem']);
	});
});
