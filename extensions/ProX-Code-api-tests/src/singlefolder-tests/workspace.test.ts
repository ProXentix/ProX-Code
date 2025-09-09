/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { basename, join, posix } from 'path';
import * as ProX-Code from 'ProX-Code';
import { TestFS } from '../memfs';
import { assertNoRpc, closeAllEditors, createRandomFile, delay, deleteFile, disposeAll, pathEquals, revertAllDirty, rndName, testFs, withLogDisabled } from '../utils';

suite('ProX-Code API - workspace', () => {

	let root: ProX-Code.Uri;

	suiteSetup(function () {
		root = ProX-Code.workspace.workspaceFolders![0]!.uri;
	});

	teardown(async function () {
		assertNoRpc();
		await closeAllEditors();
	});

	test('MarkdownString', function () {
		let md = new ProX-Code.MarkdownString();
		assert.strictEqual(md.value, '');
		assert.strictEqual(md.isTrusted, undefined);

		md = new ProX-Code.MarkdownString('**bold**');
		assert.strictEqual(md.value, '**bold**');

		md.appendText('**bold?**');
		assert.strictEqual(md.value, '**bold**\\*\\*bold?\\*\\*');

		md.appendMarkdown('**bold**');
		assert.strictEqual(md.value, '**bold**\\*\\*bold?\\*\\***bold**');
	});


	test('textDocuments', () => {
		assert.ok(Array.isArray(ProX-Code.workspace.textDocuments));
		assert.throws(() => (<any>ProX-Code.workspace).textDocuments = null);
	});

	test('rootPath', () => {
		assert.ok(pathEquals(ProX-Code.workspace.rootPath!, join(__dirname, '../../testWorkspace')));
		assert.throws(() => (ProX-Code.workspace as any).rootPath = 'farboo');
	});

	test('workspaceFile', () => {
		assert.ok(!ProX-Code.workspace.workspaceFile);
	});

	test('workspaceFolders', () => {
		if (ProX-Code.workspace.workspaceFolders) {
			assert.strictEqual(ProX-Code.workspace.workspaceFolders.length, 1);
			assert.ok(pathEquals(ProX-Code.workspace.workspaceFolders[0].uri.fsPath, join(__dirname, '../../testWorkspace')));
		}
	});

	test('getWorkspaceFolder', () => {
		const folder = ProX-Code.workspace.getWorkspaceFolder(ProX-Code.Uri.file(join(__dirname, '../../testWorkspace/far.js')));
		assert.ok(!!folder);

		if (folder) {
			assert.ok(pathEquals(folder.uri.fsPath, join(__dirname, '../../testWorkspace')));
		}
	});

	test('openTextDocument', async () => {
		const uri = await createRandomFile();

		// not yet there
		const existing1 = ProX-Code.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
		assert.strictEqual(existing1, undefined);

		// open and assert its there
		const doc = await ProX-Code.workspace.openTextDocument(uri);
		assert.ok(doc);
		assert.strictEqual(doc.uri.toString(), uri.toString());
		const existing2 = ProX-Code.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
		assert.strictEqual(existing2 === doc, true);
	});

	test('openTextDocument, illegal path', () => {
		return ProX-Code.workspace.openTextDocument('funkydonky.txt').then(_doc => {
			throw new Error('missing error');
		}, _err => {
			// good!
		});
	});

	test('openTextDocument, untitled is dirty', async function () {
		return ProX-Code.workspace.openTextDocument(ProX-Code.workspace.workspaceFolders![0].uri.with({ scheme: 'untitled', path: posix.join(ProX-Code.workspace.workspaceFolders![0].uri.path, 'newfile.txt') })).then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
			assert.ok(doc.isDirty);
		});
	});

	test('openTextDocument, untitled with host', function () {
		const uri = ProX-Code.Uri.parse('untitled://localhost/c%24/Users/jrieken/code/samples/foobar.txt');
		return ProX-Code.workspace.openTextDocument(uri).then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
		});
	});

	test('openTextDocument, untitled without path', function () {
		return ProX-Code.workspace.openTextDocument().then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
			assert.ok(doc.isDirty);
		});
	});

	test('openTextDocument, untitled without path but language ID', function () {
		return ProX-Code.workspace.openTextDocument({ language: 'xml' }).then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
			assert.strictEqual(doc.languageId, 'xml');
			assert.ok(doc.isDirty);
		});
	});

	test('openTextDocument, untitled without path but language ID and content', function () {
		return ProX-Code.workspace.openTextDocument({ language: 'html', content: '<h1>Hello world!</h1>' }).then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
			assert.strictEqual(doc.languageId, 'html');
			assert.ok(doc.isDirty);
			assert.strictEqual(doc.getText(), '<h1>Hello world!</h1>');
		});
	});

	test('openTextDocument, untitled closes on save', function () {
		const path = join(ProX-Code.workspace.rootPath || '', './newfile.txt');

		return ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('untitled:' + path)).then(doc => {
			assert.strictEqual(doc.uri.scheme, 'untitled');
			assert.ok(doc.isDirty);

			const closedDocuments: ProX-Code.TextDocument[] = [];
			const d0 = ProX-Code.workspace.onDidCloseTextDocument(e => closedDocuments.push(e));

			return ProX-Code.window.showTextDocument(doc).then(() => {
				return doc.save().then((didSave: boolean) => {

					assert.strictEqual(didSave, true, `FAILED to save${doc.uri.toString()}`);

					const closed = closedDocuments.filter(close => close.uri.toString() === doc.uri.toString())[0];
					assert.ok(closed);
					assert.ok(closed === doc);
					assert.ok(!doc.isDirty);
					assert.ok(fs.existsSync(path));

					d0.dispose();
					fs.unlinkSync(join(ProX-Code.workspace.rootPath || '', './newfile.txt'));
				});
			});

		});
	});

	test('openTextDocument, uri scheme/auth/path', function () {

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('sc', {
			provideTextDocumentContent() {
				return 'SC';
			}
		});

		return Promise.all([
			ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('sc://auth')).then(doc => {
				assert.strictEqual(doc.uri.authority, 'auth');
				assert.strictEqual(doc.uri.path, '');
			}),
			ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('sc:///path')).then(doc => {
				assert.strictEqual(doc.uri.authority, '');
				assert.strictEqual(doc.uri.path, '/path');
			}),
			ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('sc://auth/path')).then(doc => {
				assert.strictEqual(doc.uri.authority, 'auth');
				assert.strictEqual(doc.uri.path, '/path');
			})
		]).then(() => {
			registration.dispose();
		});
	});

	test('openTextDocument, actual casing first', async function () {

		const fs = new TestFS('this-fs', false);
		const reg = ProX-Code.workspace.registerFileSystemProvider(fs.scheme, fs, { isCaseSensitive: fs.isCaseSensitive });

		const uriOne = ProX-Code.Uri.parse('this-fs:/one');
		const uriTwo = ProX-Code.Uri.parse('this-fs:/two');
		const uriONE = ProX-Code.Uri.parse('this-fs:/ONE'); // same resource, different uri
		const uriTWO = ProX-Code.Uri.parse('this-fs:/TWO');

		fs.writeFile(uriOne, Buffer.from('one'), { create: true, overwrite: true });
		fs.writeFile(uriTwo, Buffer.from('two'), { create: true, overwrite: true });

		// lower case (actual case) comes first
		const docOne = await ProX-Code.workspace.openTextDocument(uriOne);
		assert.strictEqual(docOne.uri.toString(), uriOne.toString());

		const docONE = await ProX-Code.workspace.openTextDocument(uriONE);
		assert.strictEqual(docONE === docOne, true);
		assert.strictEqual(docONE.uri.toString(), uriOne.toString());
		assert.strictEqual(docONE.uri.toString() !== uriONE.toString(), true); // yep

		// upper case (NOT the actual case) comes first
		const docTWO = await ProX-Code.workspace.openTextDocument(uriTWO);
		assert.strictEqual(docTWO.uri.toString(), uriTWO.toString());

		const docTwo = await ProX-Code.workspace.openTextDocument(uriTwo);
		assert.strictEqual(docTWO === docTwo, true);
		assert.strictEqual(docTwo.uri.toString(), uriTWO.toString());
		assert.strictEqual(docTwo.uri.toString() !== uriTwo.toString(), true); // yep

		reg.dispose();
	});

	test('eol, read', () => {
		const a = createRandomFile('foo\nbar\nbar').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				assert.strictEqual(doc.eol, ProX-Code.EndOfLine.LF);
			});
		});
		const b = createRandomFile('foo\nbar\nbar\r\nbaz').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				assert.strictEqual(doc.eol, ProX-Code.EndOfLine.LF);
			});
		});
		const c = createRandomFile('foo\r\nbar\r\nbar').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				assert.strictEqual(doc.eol, ProX-Code.EndOfLine.CRLF);
			});
		});
		return Promise.all([a, b, c]);
	});

	test('eol, change via editor', () => {
		return createRandomFile('foo\nbar\nbar').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				assert.strictEqual(doc.eol, ProX-Code.EndOfLine.LF);
				return ProX-Code.window.showTextDocument(doc).then(editor => {
					return editor.edit(builder => builder.setEndOfLine(ProX-Code.EndOfLine.CRLF));

				}).then(value => {
					assert.ok(value);
					assert.ok(doc.isDirty);
					assert.strictEqual(doc.eol, ProX-Code.EndOfLine.CRLF);
				});
			});
		});
	});

	test('eol, change via applyEdit', () => {
		return createRandomFile('foo\nbar\nbar').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				assert.strictEqual(doc.eol, ProX-Code.EndOfLine.LF);

				const edit = new ProX-Code.WorkspaceEdit();
				edit.set(file, [ProX-Code.TextEdit.setEndOfLine(ProX-Code.EndOfLine.CRLF)]);
				return ProX-Code.workspace.applyEdit(edit).then(value => {
					assert.ok(value);
					assert.ok(doc.isDirty);
					assert.strictEqual(doc.eol, ProX-Code.EndOfLine.CRLF);
				});
			});
		});
	});

	test('eol, change via onWillSave', async function () {
		let called = false;
		const sub = ProX-Code.workspace.onWillSaveTextDocument(e => {
			called = true;
			e.waitUntil(Promise.resolve([ProX-Code.TextEdit.setEndOfLine(ProX-Code.EndOfLine.LF)]));
		});

		const file = await createRandomFile('foo\r\nbar\r\nbar');
		const doc = await ProX-Code.workspace.openTextDocument(file);
		assert.strictEqual(doc.eol, ProX-Code.EndOfLine.CRLF);

		const edit = new ProX-Code.WorkspaceEdit();
		edit.set(file, [ProX-Code.TextEdit.insert(new ProX-Code.Position(0, 0), '-changes-')]);
		const successEdit = await ProX-Code.workspace.applyEdit(edit);
		assert.ok(successEdit);

		const successSave = await doc.save();
		assert.ok(successSave);
		assert.ok(called);
		assert.ok(!doc.isDirty);
		assert.strictEqual(doc.eol, ProX-Code.EndOfLine.LF);
		sub.dispose();
	});


	test('events: onDidOpenTextDocument, onDidChangeTextDocument, onDidSaveTextDocument', async () => {
		const file = await createRandomFile();
		const disposables: ProX-Code.Disposable[] = [];

		await revertAllDirty(); // needed for a clean state for `onDidSaveTextDocument` (#102365)

		const onDidOpenTextDocument = new Set<ProX-Code.TextDocument>();
		const onDidChangeTextDocument = new Set<ProX-Code.TextDocument>();
		const onDidSaveTextDocument = new Set<ProX-Code.TextDocument>();

		disposables.push(ProX-Code.workspace.onDidOpenTextDocument(e => {
			onDidOpenTextDocument.add(e);
		}));

		disposables.push(ProX-Code.workspace.onDidChangeTextDocument(e => {
			onDidChangeTextDocument.add(e.document);
		}));

		disposables.push(ProX-Code.workspace.onDidSaveTextDocument(e => {
			onDidSaveTextDocument.add(e);
		}));

		const doc = await ProX-Code.workspace.openTextDocument(file);
		const editor = await ProX-Code.window.showTextDocument(doc);

		await editor.edit((builder) => {
			builder.insert(new ProX-Code.Position(0, 0), 'Hello World');
		});
		await doc.save();

		assert.ok(Array.from(onDidOpenTextDocument).find(e => e.uri.toString() === file.toString()), 'did Open: ' + file.toString());
		assert.ok(Array.from(onDidChangeTextDocument).find(e => e.uri.toString() === file.toString()), 'did Change: ' + file.toString());
		assert.ok(Array.from(onDidSaveTextDocument).find(e => e.uri.toString() === file.toString()), 'did Save: ' + file.toString());

		disposeAll(disposables);
		return deleteFile(file);
	});

	test('events: onDidSaveTextDocument fires even for non dirty file when saved', async () => {
		const file = await createRandomFile();
		const disposables: ProX-Code.Disposable[] = [];

		await revertAllDirty(); // needed for a clean state for `onDidSaveTextDocument` (#102365)

		const onDidSaveTextDocument = new Set<ProX-Code.TextDocument>();

		disposables.push(ProX-Code.workspace.onDidSaveTextDocument(e => {
			onDidSaveTextDocument.add(e);
		}));

		const doc = await ProX-Code.workspace.openTextDocument(file);
		await ProX-Code.window.showTextDocument(doc);
		await ProX-Code.commands.executeCommand('workbench.action.files.save');

		assert.ok(onDidSaveTextDocument);
		assert.ok(Array.from(onDidSaveTextDocument).find(e => e.uri.toString() === file.toString()), 'did Save: ' + file.toString());
		disposeAll(disposables);
		return deleteFile(file);
	});

	test('openTextDocument, with selection', function () {
		return createRandomFile('foo\nbar\nbar').then(file => {
			return ProX-Code.workspace.openTextDocument(file).then(doc => {
				return ProX-Code.window.showTextDocument(doc, { selection: new ProX-Code.Range(new ProX-Code.Position(1, 1), new ProX-Code.Position(1, 2)) }).then(editor => {
					assert.strictEqual(editor.selection.start.line, 1);
					assert.strictEqual(editor.selection.start.character, 1);
					assert.strictEqual(editor.selection.end.line, 1);
					assert.strictEqual(editor.selection.end.character, 2);
				});
			});
		});
	});

	test('registerTextDocumentContentProvider, simple', function () {

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(uri) {
				return uri.toString();
			}
		});

		const uri = ProX-Code.Uri.parse('foo://testing/virtual.js');
		return ProX-Code.workspace.openTextDocument(uri).then(doc => {
			assert.strictEqual(doc.getText(), uri.toString());
			assert.strictEqual(doc.isDirty, false);
			assert.strictEqual(doc.uri.toString(), uri.toString());
			registration.dispose();
		});
	});

	test('registerTextDocumentContentProvider, constrains', function () {

		// built-in
		assert.throws(function () {
			ProX-Code.workspace.registerTextDocumentContentProvider('untitled', { provideTextDocumentContent() { return null; } });
		});
		// built-in
		assert.throws(function () {
			ProX-Code.workspace.registerTextDocumentContentProvider('file', { provideTextDocumentContent() { return null; } });
		});

		// missing scheme
		return ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('notThere://foo/far/boo/bar')).then(() => {
			assert.ok(false, 'expected failure');
		}, _err => {
			// expected
		});
	});

	test('registerTextDocumentContentProvider, multiple', function () {

		// duplicate registration
		const registration1 = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(uri) {
				if (uri.authority === 'foo') {
					return '1';
				}
				return undefined;
			}
		});
		const registration2 = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(uri) {
				if (uri.authority === 'bar') {
					return '2';
				}
				return undefined;
			}
		});

		return Promise.all([
			ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('foo://foo/bla')).then(doc => { assert.strictEqual(doc.getText(), '1'); }),
			ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('foo://bar/bla')).then(doc => { assert.strictEqual(doc.getText(), '2'); })
		]).then(() => {
			registration1.dispose();
			registration2.dispose();
		});
	});

	test('registerTextDocumentContentProvider, evil provider', function () {

		// duplicate registration
		const registration1 = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri) {
				return '1';
			}
		});
		const registration2 = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri): string {
				throw new Error('fail');
			}
		});

		return ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('foo://foo/bla')).then(doc => {
			assert.strictEqual(doc.getText(), '1');
			registration1.dispose();
			registration2.dispose();
		});
	});

	test('registerTextDocumentContentProvider, invalid text', function () {

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri) {
				return <any>123;
			}
		});
		return ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('foo://auth/path')).then(() => {
			assert.ok(false, 'expected failure');
		}, _err => {
			// expected
			registration.dispose();
		});
	});

	test('registerTextDocumentContentProvider, show virtual document', function () {

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri) {
				return 'I am virtual';
			}
		});

		return ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('foo://something/path')).then(doc => {
			return ProX-Code.window.showTextDocument(doc).then(editor => {

				assert.ok(editor.document === doc);
				assert.strictEqual(editor.document.getText(), 'I am virtual');
				registration.dispose();
			});
		});
	});

	test('registerTextDocumentContentProvider, open/open document', function () {

		let callCount = 0;
		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri) {
				callCount += 1;
				return 'I am virtual';
			}
		});

		const uri = ProX-Code.Uri.parse('foo://testing/path');

		return Promise.all([ProX-Code.workspace.openTextDocument(uri), ProX-Code.workspace.openTextDocument(uri)]).then(docs => {
			const [first, second] = docs;
			assert.ok(first === second);
			assert.ok(ProX-Code.workspace.textDocuments.some(doc => doc.uri.toString() === uri.toString()));
			assert.strictEqual(callCount, 1);
			registration.dispose();
		});
	});

	test('registerTextDocumentContentProvider, empty doc', function () {

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			provideTextDocumentContent(_uri) {
				return '';
			}
		});

		const uri = ProX-Code.Uri.parse('foo:doc/empty');

		return ProX-Code.workspace.openTextDocument(uri).then(doc => {
			assert.strictEqual(doc.getText(), '');
			assert.strictEqual(doc.uri.toString(), uri.toString());
			registration.dispose();
		});
	});

	test('registerTextDocumentContentProvider, change event', async function () {

		let callCount = 0;
		const emitter = new ProX-Code.EventEmitter<ProX-Code.Uri>();

		const registration = ProX-Code.workspace.registerTextDocumentContentProvider('foo', {
			onDidChange: emitter.event,
			provideTextDocumentContent(_uri) {
				return 'call' + (callCount++);
			}
		});

		const uri = ProX-Code.Uri.parse('foo://testing/path3');
		const doc = await ProX-Code.workspace.openTextDocument(uri);

		assert.strictEqual(callCount, 1);
		assert.strictEqual(doc.getText(), 'call0');

		return new Promise<void>(resolve => {

			const subscription = ProX-Code.workspace.onDidChangeTextDocument(event => {
				assert.ok(event.document === doc);
				assert.strictEqual(event.document.getText(), 'call1');
				subscription.dispose();
				registration.dispose();
				resolve();
			});

			emitter.fire(doc.uri);
		});
	});

	test('findFiles', () => {
		return ProX-Code.workspace.findFiles('**/image.png').then((res) => {
			assert.strictEqual(res.length, 2);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'image.png');
		});
	});

	test('findFiles - null exclude', async () => {
		await ProX-Code.workspace.findFiles('**/file.txt').then((res) => {
			// search.exclude folder is still searched, files.exclude folder is not
			assert.strictEqual(res.length, 1);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'file.txt');
		});

		await ProX-Code.workspace.findFiles('**/file.txt', null).then((res) => {
			// search.exclude and files.exclude folders are both searched
			assert.strictEqual(res.length, 2);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'file.txt');
		});
	});

	test('findFiles - exclude', () => {
		return ProX-Code.workspace.findFiles('**/image.png').then((res) => {
			assert.strictEqual(res.length, 2);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'image.png');
		});
	});

	test('findFiles, exclude', () => {
		return ProX-Code.workspace.findFiles('**/image.png', '**/sub/**').then((res) => {
			assert.strictEqual(res.length, 1);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'image.png');
		});
	});

	test('findFiles, cancellation', () => {

		const source = new ProX-Code.CancellationTokenSource();
		const token = source.token; // just to get an instance first
		source.cancel();

		return ProX-Code.workspace.findFiles('*.js', null, 100, token).then((res) => {
			assert.deepStrictEqual(res, []);
		});
	});

	test('`findFiles2`', () => {
		return ProX-Code.workspace.findFiles2(['**/image.png']).then((res) => {
			assert.strictEqual(res.length, 2);
		});
	});

	test('findFiles2 - null exclude', async () => {
		await ProX-Code.workspace.findFiles2(['**/file.txt'], { useExcludeSettings: ProX-Code.ExcludeSettingOptions.FilesExclude }).then((res) => {
			// file.exclude folder is still searched, search.exclude folder is not
			assert.strictEqual(res.length, 1);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'file.txt');
		});

		await ProX-Code.workspace.findFiles2(['**/file.txt'], { useExcludeSettings: ProX-Code.ExcludeSettingOptions.None }).then((res) => {
			// search.exclude and files.exclude folders are both searched
			assert.strictEqual(res.length, 2);
			assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(res[0])), 'file.txt');
		});
	});

	test('findFiles2, exclude', () => {
		return ProX-Code.workspace.findFiles2(['**/image.png'], { exclude: ['**/sub/**'] }).then((res) => {
			assert.strictEqual(res.length, 1);
		});
	});

	test('findFiles2, cancellation', () => {

		const source = new ProX-Code.CancellationTokenSource();
		const token = source.token; // just to get an instance first
		source.cancel();

		return ProX-Code.workspace.findFiles2(['*.js'], {}, token).then((res) => {
			assert.deepStrictEqual(res, []);
		});
	});

	test('findTextInFiles', async () => {
		const options: ProX-Code.FindTextInFilesOptions = {
			include: '*.ts',
			previewOptions: {
				matchLines: 1,
				charsPerLine: 100
			}
		};

		const results: ProX-Code.TextSearchResult[] = [];
		await ProX-Code.workspace.findTextInFiles({ pattern: 'foo' }, options, result => {
			results.push(result);
		});

		assert.strictEqual(results.length, 1);
		const match = <ProX-Code.TextSearchMatch>results[0];
		assert(match.preview.text.indexOf('foo') >= 0);
		assert.strictEqual(basename(ProX-Code.workspace.asRelativePath(match.uri)), '10linefile.ts');
	});

	test('findTextInFiles, cancellation', async () => {
		const results: ProX-Code.TextSearchResult[] = [];
		const cancellation = new ProX-Code.CancellationTokenSource();
		cancellation.cancel();

		await ProX-Code.workspace.findTextInFiles({ pattern: 'foo' }, result => {
			results.push(result);
		}, cancellation.token);
	});

	test('applyEdit', async () => {
		const doc = await ProX-Code.workspace.openTextDocument(ProX-Code.Uri.parse('untitled:' + join(ProX-Code.workspace.rootPath || '', './new2.txt')));

		const edit = new ProX-Code.WorkspaceEdit();
		edit.insert(doc.uri, new ProX-Code.Position(0, 0), new Array(1000).join('Hello World'));

		const success = await ProX-Code.workspace.applyEdit(edit);
		assert.strictEqual(success, true);
		assert.strictEqual(doc.isDirty, true);
	});

	test('applyEdit should fail when editing deleted resource', withLogDisabled(async () => {
		const resource = await createRandomFile();

		const edit = new ProX-Code.WorkspaceEdit();
		edit.deleteFile(resource);
		edit.insert(resource, new ProX-Code.Position(0, 0), '');

		const success = await ProX-Code.workspace.applyEdit(edit);
		assert.strictEqual(success, false);
	}));

	test('applyEdit should fail when renaming deleted resource', withLogDisabled(async () => {
		const resource = await createRandomFile();

		const edit = new ProX-Code.WorkspaceEdit();
		edit.deleteFile(resource);
		edit.renameFile(resource, resource);

		const success = await ProX-Code.workspace.applyEdit(edit);
		assert.strictEqual(success, false);
	}));

	test('applyEdit should fail when editing renamed from resource', withLogDisabled(async () => {
		const resource = await createRandomFile();
		const newResource = ProX-Code.Uri.file(resource.fsPath + '.1');
		const edit = new ProX-Code.WorkspaceEdit();
		edit.renameFile(resource, newResource);
		edit.insert(resource, new ProX-Code.Position(0, 0), '');

		const success = await ProX-Code.workspace.applyEdit(edit);
		assert.strictEqual(success, false);
	}));

	test('applyEdit "edit A -> rename A to B -> edit B"', async () => {
		await testEditRenameEdit(oldUri => oldUri.with({ path: oldUri.path + 'NEW' }));
	});

	test('applyEdit "edit A -> rename A to B (different case)" -> edit B', async () => {
		await testEditRenameEdit(oldUri => oldUri.with({ path: oldUri.path.toUpperCase() }));
	});

	test('applyEdit "edit A -> rename A to B (same case)" -> edit B', async () => {
		await testEditRenameEdit(oldUri => oldUri);
	});

	async function testEditRenameEdit(newUriCreator: (oldUri: ProX-Code.Uri) => ProX-Code.Uri): Promise<void> {
		const oldUri = await createRandomFile();
		const newUri = newUriCreator(oldUri);
		const edit = new ProX-Code.WorkspaceEdit();
		edit.insert(oldUri, new ProX-Code.Position(0, 0), 'BEFORE');
		edit.renameFile(oldUri, newUri);
		edit.insert(newUri, new ProX-Code.Position(0, 0), 'AFTER');

		assert.ok(await ProX-Code.workspace.applyEdit(edit));

		const doc = await ProX-Code.workspace.openTextDocument(newUri);
		assert.strictEqual(doc.getText(), 'AFTERBEFORE');
		assert.strictEqual(doc.isDirty, true);
	}

	function nameWithUnderscore(uri: ProX-Code.Uri) {
		return uri.with({ path: posix.join(posix.dirname(uri.path), `_${posix.basename(uri.path)}`) });
	}

	test('WorkspaceEdit: applying edits before and after rename duplicates resource #42633', withLogDisabled(async function () {
		const docUri = await createRandomFile();
		const newUri = nameWithUnderscore(docUri);

		const we = new ProX-Code.WorkspaceEdit();
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Hello');
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Foo');
		we.renameFile(docUri, newUri);
		we.insert(newUri, new ProX-Code.Position(0, 0), 'Bar');

		assert.ok(await ProX-Code.workspace.applyEdit(we));
		const doc = await ProX-Code.workspace.openTextDocument(newUri);
		assert.strictEqual(doc.getText(), 'BarHelloFoo');
	}));

	test('WorkspaceEdit: Problem recreating a renamed resource #42634', withLogDisabled(async function () {
		const docUri = await createRandomFile();
		const newUri = nameWithUnderscore(docUri);

		const we = new ProX-Code.WorkspaceEdit();
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Hello');
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Foo');
		we.renameFile(docUri, newUri);

		we.createFile(docUri);
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Bar');

		assert.ok(await ProX-Code.workspace.applyEdit(we));

		const newDoc = await ProX-Code.workspace.openTextDocument(newUri);
		assert.strictEqual(newDoc.getText(), 'HelloFoo');
		const doc = await ProX-Code.workspace.openTextDocument(docUri);
		assert.strictEqual(doc.getText(), 'Bar');
	}));

	test('WorkspaceEdit api - after saving a deleted file, it still shows up as deleted. #42667', withLogDisabled(async function () {
		const docUri = await createRandomFile();
		const we = new ProX-Code.WorkspaceEdit();
		we.deleteFile(docUri);
		we.insert(docUri, new ProX-Code.Position(0, 0), 'InsertText');

		assert.ok(!(await ProX-Code.workspace.applyEdit(we)));
		try {
			await ProX-Code.workspace.openTextDocument(docUri);
			assert.ok(false);
		} catch (e) {
			assert.ok(true);
		}
	}));

	test('WorkspaceEdit: edit and rename parent folder duplicates resource #42641', async function () {

		const dir = ProX-Code.Uri.parse(`${testFs.scheme}:/before-${rndName()}`);
		await testFs.createDirectory(dir);

		const docUri = await createRandomFile('', dir);
		const docParent = docUri.with({ path: posix.dirname(docUri.path) });
		const newParent = nameWithUnderscore(docParent);

		const we = new ProX-Code.WorkspaceEdit();
		we.insert(docUri, new ProX-Code.Position(0, 0), 'Hello');
		we.renameFile(docParent, newParent);

		assert.ok(await ProX-Code.workspace.applyEdit(we));

		try {
			await ProX-Code.workspace.openTextDocument(docUri);
			assert.ok(false);
		} catch (e) {
			assert.ok(true);
		}

		const newUri = newParent.with({ path: posix.join(newParent.path, posix.basename(docUri.path)) });
		const doc = await ProX-Code.workspace.openTextDocument(newUri);
		assert.ok(doc);

		assert.strictEqual(doc.getText(), 'Hello');
	});

	test('WorkspaceEdit: rename resource followed by edit does not work #42638', withLogDisabled(async function () {
		const docUri = await createRandomFile();
		const newUri = nameWithUnderscore(docUri);

		const we = new ProX-Code.WorkspaceEdit();
		we.renameFile(docUri, newUri);
		we.insert(newUri, new ProX-Code.Position(0, 0), 'Hello');

		assert.ok(await ProX-Code.workspace.applyEdit(we));

		const doc = await ProX-Code.workspace.openTextDocument(newUri);
		assert.strictEqual(doc.getText(), 'Hello');
	}));

	test('WorkspaceEdit: create & override', withLogDisabled(async function () {

		const docUri = await createRandomFile('before');

		let we = new ProX-Code.WorkspaceEdit();
		we.createFile(docUri);
		assert.ok(!await ProX-Code.workspace.applyEdit(we));
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(docUri)).getText(), 'before');

		we = new ProX-Code.WorkspaceEdit();
		we.createFile(docUri, { overwrite: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(docUri)).getText(), '');
	}));

	test('WorkspaceEdit: create & ignoreIfExists', withLogDisabled(async function () {
		const docUri = await createRandomFile('before');

		let we = new ProX-Code.WorkspaceEdit();
		we.createFile(docUri, { ignoreIfExists: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(docUri)).getText(), 'before');

		we = new ProX-Code.WorkspaceEdit();
		we.createFile(docUri, { overwrite: true, ignoreIfExists: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(docUri)).getText(), '');
	}));

	test('WorkspaceEdit: rename & ignoreIfExists', withLogDisabled(async function () {
		const aUri = await createRandomFile('aaa');
		const bUri = await createRandomFile('bbb');

		let we = new ProX-Code.WorkspaceEdit();
		we.renameFile(aUri, bUri);
		assert.ok(!await ProX-Code.workspace.applyEdit(we));

		we = new ProX-Code.WorkspaceEdit();
		we.renameFile(aUri, bUri, { ignoreIfExists: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));

		we = new ProX-Code.WorkspaceEdit();
		we.renameFile(aUri, bUri, { overwrite: false, ignoreIfExists: true });
		assert.ok(!await ProX-Code.workspace.applyEdit(we));

		we = new ProX-Code.WorkspaceEdit();
		we.renameFile(aUri, bUri, { overwrite: true, ignoreIfExists: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));
	}));

	test('WorkspaceEdit: delete & ignoreIfNotExists', withLogDisabled(async function () {

		const docUri = await createRandomFile();
		let we = new ProX-Code.WorkspaceEdit();
		we.deleteFile(docUri, { ignoreIfNotExists: false });
		assert.ok(await ProX-Code.workspace.applyEdit(we));

		we = new ProX-Code.WorkspaceEdit();
		we.deleteFile(docUri, { ignoreIfNotExists: false });
		assert.ok(!await ProX-Code.workspace.applyEdit(we));

		we = new ProX-Code.WorkspaceEdit();
		we.deleteFile(docUri, { ignoreIfNotExists: true });
		assert.ok(await ProX-Code.workspace.applyEdit(we));
	}));

	test('WorkspaceEdit: insert & rename multiple', async function () {

		const [f1, f2, f3] = await Promise.all([createRandomFile(), createRandomFile(), createRandomFile()]);

		const we = new ProX-Code.WorkspaceEdit();
		we.insert(f1, new ProX-Code.Position(0, 0), 'f1');
		we.insert(f2, new ProX-Code.Position(0, 0), 'f2');
		we.insert(f3, new ProX-Code.Position(0, 0), 'f3');

		const f1_ = nameWithUnderscore(f1);
		we.renameFile(f1, f1_);

		assert.ok(await ProX-Code.workspace.applyEdit(we));

		assert.strictEqual((await ProX-Code.workspace.openTextDocument(f3)).getText(), 'f3');
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(f2)).getText(), 'f2');
		assert.strictEqual((await ProX-Code.workspace.openTextDocument(f1_)).getText(), 'f1');
		try {
			await ProX-Code.workspace.fs.stat(f1);
			assert.ok(false);
		} catch {
			assert.ok(true);
		}
	});

	// TODO: below test is flaky and commented out, see https://github.com/microsoft/ProX-Code/issues/238837
	test.skip('workspace.applyEdit drops the TextEdit if there is a RenameFile later #77735 (with opened editor)', async function () {
		await test77735(true);
	});

	test('workspace.applyEdit drops the TextEdit if there is a RenameFile later #77735 (without opened editor)', async function () {
		await test77735(false);
	});

	async function test77735(withOpenedEditor: boolean): Promise<void> {
		const docUriOriginal = await createRandomFile();
		const docUriMoved = docUriOriginal.with({ path: `${docUriOriginal.path}.moved` });
		await deleteFile(docUriMoved);

		if (withOpenedEditor) {
			const document = await ProX-Code.workspace.openTextDocument(docUriOriginal);
			await ProX-Code.window.showTextDocument(document);
		} else {
			await ProX-Code.commands.executeCommand('workbench.action.closeAllEditors');
		}

		for (let i = 0; i < 4; i++) {
			const we = new ProX-Code.WorkspaceEdit();
			let oldUri: ProX-Code.Uri;
			let newUri: ProX-Code.Uri;
			let expected: string;

			if (i % 2 === 0) {
				oldUri = docUriOriginal;
				newUri = docUriMoved;
				we.insert(oldUri, new ProX-Code.Position(0, 0), 'Hello');
				expected = 'Hello';
			} else {
				oldUri = docUriMoved;
				newUri = docUriOriginal;
				we.delete(oldUri, new ProX-Code.Range(new ProX-Code.Position(0, 0), new ProX-Code.Position(0, 5)));
				expected = '';
			}

			we.renameFile(oldUri, newUri);
			assert.ok(await ProX-Code.workspace.applyEdit(we));

			const document = await ProX-Code.workspace.openTextDocument(newUri);
			assert.strictEqual(document.isDirty, true);

			const result = await document.save();
			assert.strictEqual(result, true, `save failed in iteration: ${i} (docUriOriginal: ${docUriOriginal.fsPath})`);
			assert.strictEqual(document.isDirty, false, `document still dirty in iteration: ${i} (docUriOriginal: ${docUriOriginal.fsPath})`);

			assert.strictEqual(document.getText(), expected);

			await delay(10);
		}
	}

	test('The api workspace.applyEdit failed for some case of mixing resourceChange and textEdit #80688, 1/2', async function () {
		const file1 = await createRandomFile();
		const file2 = await createRandomFile();
		const we = new ProX-Code.WorkspaceEdit();
		we.insert(file1, new ProX-Code.Position(0, 0), 'import1;');

		const file2Name = basename(file2.fsPath);
		const file2NewUri = ProX-Code.Uri.joinPath(file2, `../new/${file2Name}`);
		we.renameFile(file2, file2NewUri);

		we.insert(file1, new ProX-Code.Position(0, 0), 'import2;');
		await ProX-Code.workspace.applyEdit(we);

		const document = await ProX-Code.workspace.openTextDocument(file1);
		// const expected = 'import1;import2;';
		const expected2 = 'import2;import1;';
		assert.strictEqual(document.getText(), expected2);
	});

	test('The api workspace.applyEdit failed for some case of mixing resourceChange and textEdit #80688, 2/2', async function () {
		const file1 = await createRandomFile();
		const file2 = await createRandomFile();
		const we = new ProX-Code.WorkspaceEdit();
		we.insert(file1, new ProX-Code.Position(0, 0), 'import1;');
		we.insert(file1, new ProX-Code.Position(0, 0), 'import2;');

		const file2Name = basename(file2.fsPath);
		const file2NewUri = ProX-Code.Uri.joinPath(file2, `../new/${file2Name}`);
		we.renameFile(file2, file2NewUri);

		await ProX-Code.workspace.applyEdit(we);

		const document = await ProX-Code.workspace.openTextDocument(file1);
		const expected = 'import1;import2;';
		// const expected2 = 'import2;import1;';
		assert.strictEqual(document.getText(), expected);
	});


	test('[Bug] Failed to create new test file when in an untitled file #1261', async function () {
		const uri = ProX-Code.Uri.parse('untitled:Untitled-5.test');
		const contents = `Hello Test File ${uri.toString()}`;
		const we = new ProX-Code.WorkspaceEdit();
		we.createFile(uri, { ignoreIfExists: true });
		we.replace(uri, new ProX-Code.Range(0, 0, 0, 0), contents);

		const success = await ProX-Code.workspace.applyEdit(we);

		assert.ok(success);

		const doc = await ProX-Code.workspace.openTextDocument(uri);
		assert.strictEqual(doc.getText(), contents);
	});

	test('Should send a single FileWillRenameEvent instead of separate events when moving multiple files at once#111867, 1/3', async function () {

		const file1 = await createRandomFile();
		const file2 = await createRandomFile();

		const file1New = await createRandomFile();
		const file2New = await createRandomFile();

		const event = new Promise<ProX-Code.FileWillRenameEvent>(resolve => {
			const sub = ProX-Code.workspace.onWillRenameFiles(e => {
				sub.dispose();
				resolve(e);
			});
		});

		const we = new ProX-Code.WorkspaceEdit();
		we.renameFile(file1, file1New, { overwrite: true });
		we.renameFile(file2, file2New, { overwrite: true });
		await ProX-Code.workspace.applyEdit(we);

		const e = await event;

		assert.strictEqual(e.files.length, 2);
		assert.strictEqual(e.files[0].oldUri.toString(), file1.toString());
		assert.strictEqual(e.files[1].oldUri.toString(), file2.toString());
	});

	test('WorkspaceEdit fails when creating then writing to file if file is open in the editor and is not empty #146964', async function () {
		const file1 = await createRandomFile();

		{
			// prepare: open file in editor, make sure it has contents
			const editor = await ProX-Code.window.showTextDocument(file1);
			const prepEdit = new ProX-Code.WorkspaceEdit();
			prepEdit.insert(file1, new ProX-Code.Position(0, 0), 'Hello Here And There');
			const status = await ProX-Code.workspace.applyEdit(prepEdit);

			assert.ok(status);
			assert.strictEqual(editor.document.getText(), 'Hello Here And There');
			assert.ok(ProX-Code.window.activeTextEditor === editor);
		}

		const we = new ProX-Code.WorkspaceEdit();
		we.createFile(file1, { overwrite: true, ignoreIfExists: false });
		we.set(file1, [new ProX-Code.TextEdit(new ProX-Code.Range(new ProX-Code.Position(0, 0), new ProX-Code.Position(0, 0)), 'SOME TEXT')]);
		const status = await ProX-Code.workspace.applyEdit(we);
		assert.ok(status);
		assert.strictEqual(ProX-Code.window.activeTextEditor!.document.getText(), 'SOME TEXT');

	});

	test('Should send a single FileWillRenameEvent instead of separate events when moving multiple files at once#111867, 2/3', async function () {

		const event = new Promise<ProX-Code.FileWillCreateEvent>(resolve => {
			const sub = ProX-Code.workspace.onWillCreateFiles(e => {
				sub.dispose();
				resolve(e);
			});
		});

		const file1 = ProX-Code.Uri.parse(`fake-fs:/${rndName()}`);
		const file2 = ProX-Code.Uri.parse(`fake-fs:/${rndName()}`);

		const we = new ProX-Code.WorkspaceEdit();
		we.createFile(file1, { overwrite: true });
		we.createFile(file2, { overwrite: true });
		await ProX-Code.workspace.applyEdit(we);

		const e = await event;

		assert.strictEqual(e.files.length, 2);
		assert.strictEqual(e.files[0].toString(), file1.toString());
		assert.strictEqual(e.files[1].toString(), file2.toString());
	});

	test('Should send a single FileWillRenameEvent instead of separate events when moving multiple files at once#111867, 3/3', async function () {

		const file1 = await createRandomFile();
		const file2 = await createRandomFile();

		const event = new Promise<ProX-Code.FileWillDeleteEvent>(resolve => {
			const sub = ProX-Code.workspace.onWillDeleteFiles(e => {
				sub.dispose();
				resolve(e);
			});
		});

		const we = new ProX-Code.WorkspaceEdit();
		we.deleteFile(file1);
		we.deleteFile(file2);
		await ProX-Code.workspace.applyEdit(we);

		const e = await event;

		assert.strictEqual(e.files.length, 2);
		assert.strictEqual(e.files[0].toString(), file1.toString());
		assert.strictEqual(e.files[1].toString(), file2.toString());
	});

	test('issue #107739 - Redo of rename Java Class name has no effect', async () => {
		const file = await createRandomFile('hello');
		const fileName = basename(file.fsPath);

		const newFile = ProX-Code.Uri.joinPath(file, `../${fileName}2`);

		// apply edit
		{
			const we = new ProX-Code.WorkspaceEdit();
			we.insert(file, new ProX-Code.Position(0, 5), '2');
			we.renameFile(file, newFile);
			await ProX-Code.workspace.applyEdit(we);
		}

		// show the new document
		{
			const document = await ProX-Code.workspace.openTextDocument(newFile);
			await ProX-Code.window.showTextDocument(document);
			assert.strictEqual(document.getText(), 'hello2');
			assert.strictEqual(document.isDirty, true);
		}

		// undo and show the old document
		{
			await ProX-Code.commands.executeCommand('undo');
			const document = await ProX-Code.workspace.openTextDocument(file);
			await ProX-Code.window.showTextDocument(document);
			assert.strictEqual(document.getText(), 'hello');
		}

		// redo and show the new document
		{
			await ProX-Code.commands.executeCommand('redo');
			const document = await ProX-Code.workspace.openTextDocument(newFile);
			await ProX-Code.window.showTextDocument(document);
			assert.strictEqual(document.getText(), 'hello2');
			assert.strictEqual(document.isDirty, true);
		}

	});

	test('issue #110141 - TextEdit.setEndOfLine applies an edit and invalidates redo stack even when no change is made', async () => {
		const file = await createRandomFile('hello\nworld');

		const document = await ProX-Code.workspace.openTextDocument(file);
		await ProX-Code.window.showTextDocument(document);

		// apply edit
		{
			const we = new ProX-Code.WorkspaceEdit();
			we.insert(file, new ProX-Code.Position(0, 5), '2');
			await ProX-Code.workspace.applyEdit(we);
		}

		// check the document
		{
			assert.strictEqual(document.getText(), 'hello2\nworld');
			assert.strictEqual(document.isDirty, true);
		}

		// apply no-op edit
		{
			const we = new ProX-Code.WorkspaceEdit();
			we.set(file, [ProX-Code.TextEdit.setEndOfLine(ProX-Code.EndOfLine.LF)]);
			await ProX-Code.workspace.applyEdit(we);
		}

		// undo
		{
			await ProX-Code.commands.executeCommand('undo');
			assert.strictEqual(document.getText(), 'hello\nworld');
			assert.strictEqual(document.isDirty, false);
		}
	});

	test('SnippetString in WorkspaceEdit', async function (): Promise<any> {
		const file = await createRandomFile('hello\nworld');

		const document = await ProX-Code.workspace.openTextDocument(file);
		const edt = await ProX-Code.window.showTextDocument(document);

		assert.ok(edt === ProX-Code.window.activeTextEditor);

		const we = new ProX-Code.WorkspaceEdit();
		we.set(document.uri, [new ProX-Code.SnippetTextEdit(new ProX-Code.Range(0, 0, 0, 0), new ProX-Code.SnippetString('${1:foo}${2:bar}'))]);
		const success = await ProX-Code.workspace.applyEdit(we);
		if (edt !== ProX-Code.window.activeTextEditor) {
			return this.skip();
		}

		assert.ok(success);
		assert.strictEqual(document.getText(), 'foobarhello\nworld');
		assert.deepStrictEqual(edt.selections, [new ProX-Code.Selection(0, 0, 0, 3)]);
	});

	test('SnippetString in WorkspaceEdit with keepWhitespace', async function (): Promise<any> {
		const file = await createRandomFile('This is line 1\n  ');

		const document = await ProX-Code.workspace.openTextDocument(file);
		const edt = await ProX-Code.window.showTextDocument(document);

		assert.ok(edt === ProX-Code.window.activeTextEditor);

		const snippetText = new ProX-Code.SnippetTextEdit(new ProX-Code.Range(1, 3, 1, 3), new ProX-Code.SnippetString('This is line 2\n  This is line 3'));
		snippetText.keepWhitespace = true;
		const we = new ProX-Code.WorkspaceEdit();
		we.set(document.uri, [snippetText]);
		const success = await ProX-Code.workspace.applyEdit(we);
		if (edt !== ProX-Code.window.activeTextEditor) {
			return this.skip();
		}

		assert.ok(success);
		assert.strictEqual(document.getText(), 'This is line 1\n  This is line 2\n  This is line 3');
	});

	test('Support creating binary files in a WorkspaceEdit', async function (): Promise<any> {

		const fileUri = ProX-Code.Uri.parse(`${testFs.scheme}:/${rndName()}`);
		const data = Buffer.from('Hello Binary Files');

		const ws = new ProX-Code.WorkspaceEdit();
		ws.createFile(fileUri, { contents: data, ignoreIfExists: false, overwrite: false });

		const success = await ProX-Code.workspace.applyEdit(ws);
		assert.ok(success);

		const actual = await ProX-Code.workspace.fs.readFile(fileUri);

		assert.deepStrictEqual(actual, data);
	});

	test('saveAll', async () => {
		await testSave(true);
	});

	test('save', async () => {
		await testSave(false);
	});

	async function testSave(saveAll: boolean) {
		const file = await createRandomFile();
		const disposables: ProX-Code.Disposable[] = [];

		await revertAllDirty(); // needed for a clean state for `onDidSaveTextDocument` (#102365)

		const onDidSaveTextDocument = new Set<ProX-Code.TextDocument>();

		disposables.push(ProX-Code.workspace.onDidSaveTextDocument(e => {
			onDidSaveTextDocument.add(e);
		}));

		const doc = await ProX-Code.workspace.openTextDocument(file);
		await ProX-Code.window.showTextDocument(doc);

		if (saveAll) {
			const edit = new ProX-Code.WorkspaceEdit();
			edit.insert(doc.uri, new ProX-Code.Position(0, 0), 'Hello World');

			await ProX-Code.workspace.applyEdit(edit);
			assert.ok(doc.isDirty);

			await ProX-Code.workspace.saveAll(false); // requires dirty documents
		} else {
			const res = await ProX-Code.workspace.save(doc.uri); // enforces to save even when not dirty
			assert.ok(res?.toString() === doc.uri.toString());
		}

		assert.ok(onDidSaveTextDocument);
		assert.ok(Array.from(onDidSaveTextDocument).find(e => e.uri.toString() === file.toString()), 'did Save: ' + file.toString());
		disposeAll(disposables);
		return deleteFile(file);
	}

	test('encoding: text document encodings', async () => {
		const uri1 = await createRandomFile();
		const uri2 = await createRandomFile(new Uint8Array([0xEF, 0xBB, 0xBF]) /* UTF-8 with BOM */);
		const uri3 = await createRandomFile(new Uint8Array([0xFF, 0xFE]) /* UTF-16 LE BOM */);
		const uri4 = await createRandomFile(new Uint8Array([0xFE, 0xFF]) /* UTF-16 BE BOM */);

		const doc1 = await ProX-Code.workspace.openTextDocument(uri1);
		assert.strictEqual(doc1.encoding, 'utf8');

		const doc2 = await ProX-Code.workspace.openTextDocument(uri2);
		assert.strictEqual(doc2.encoding, 'utf8bom');

		const doc3 = await ProX-Code.workspace.openTextDocument(uri3);
		assert.strictEqual(doc3.encoding, 'utf16le');

		const doc4 = await ProX-Code.workspace.openTextDocument(uri4);
		assert.strictEqual(doc4.encoding, 'utf16be');

		const doc5 = await ProX-Code.workspace.openTextDocument({ content: 'Hello World' });
		assert.strictEqual(doc5.encoding, 'utf8');
	});

	test('encoding: openTextDocument', async () => {
		const uri1 = await createRandomFile();

		let doc1 = await ProX-Code.workspace.openTextDocument(uri1, { encoding: 'cp1252' });
		assert.strictEqual(doc1.encoding, 'cp1252');

		let listener: ProX-Code.Disposable | undefined;
		const documentChangePromise = new Promise<void>(resolve => {
			listener = ProX-Code.workspace.onDidChangeTextDocument(e => {
				if (e.document.uri.toString() === uri1.toString()) {
					resolve();
				}
			});
		});

		doc1 = await ProX-Code.workspace.openTextDocument(uri1, { encoding: 'utf16le' });
		assert.strictEqual(doc1.encoding, 'utf16le');
		await documentChangePromise;

		const doc2 = await ProX-Code.workspace.openTextDocument({ encoding: 'utf16be' });
		assert.strictEqual(doc2.encoding, 'utf16be');

		const doc3 = await ProX-Code.workspace.openTextDocument({ content: 'Hello World', encoding: 'utf16le' });
		assert.strictEqual(doc3.encoding, 'utf16le');

		listener?.dispose();
	});

	test('encoding: openTextDocument - throws for dirty documents', async () => {
		const uri1 = await createRandomFile();

		const doc1 = await ProX-Code.workspace.openTextDocument(uri1, { encoding: 'cp1252' });

		const edit = new ProX-Code.WorkspaceEdit();
		edit.insert(doc1.uri, new ProX-Code.Position(0, 0), 'Hello World');
		await ProX-Code.workspace.applyEdit(edit);
		assert.strictEqual(doc1.isDirty, true);

		let err;
		try {
			await ProX-Code.workspace.decode(new Uint8Array([0, 0, 0, 0]), { uri: doc1.uri });
		} catch (e) {
			err = e;
		}
		assert.ok(err);
	});

	test('encoding: openTextDocument - invalid encoding falls back to default', async () => {
		const uri1 = await createRandomFile();

		const doc1 = await ProX-Code.workspace.openTextDocument(uri1, { encoding: 'foobar123' });
		assert.strictEqual(doc1.encoding, 'utf8');
	});

	test('encoding: openTextDocument - multiple requests with different encoding work', async () => {
		const uri1 = await createRandomFile();

		const doc1P = ProX-Code.workspace.openTextDocument(uri1);
		const doc2P = ProX-Code.workspace.openTextDocument(uri1, { encoding: 'cp1252' });

		const [doc1, doc2] = await Promise.all([doc1P, doc2P]);

		assert.strictEqual(doc1.encoding, 'cp1252');
		assert.strictEqual(doc2.encoding, 'cp1252');
	});

	test('encoding: decode', async function () {
		const uri = root.with({ path: posix.join(root.path, 'file.txt') });

		// without setting
		assert.strictEqual(await ProX-Code.workspace.decode(Buffer.from('Hello World'), { uri }), 'Hello World');
		assert.strictEqual(await ProX-Code.workspace.decode(Buffer.from('Hellö Wörld'), { uri }), 'Hellö Wörld');
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([0xEF, 0xBB, 0xBF, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]), { uri }), 'Hello World'); // UTF-8 with BOM
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([0xFE, 0xFF, 0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100]), { uri }), 'Hello World'); // UTF-16 BE with BOM
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([0xFF, 0xFE, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100, 0]), { uri }), 'Hello World'); // UTF-16 LE with BOM
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100]), { uri }), 'Hello World');
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100, 0]), { uri }), 'Hello World');

		// with auto-guess encoding
		try {
			await ProX-Code.workspace.getConfiguration('files', uri).update('autoGuessEncoding', true, ProX-Code.ConfigurationTarget.Global);
			assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([72, 101, 108, 108, 0xF6, 32, 87, 0xF6, 114, 108, 100]), { uri }), 'Hellö Wörld');
		} finally {
			await ProX-Code.workspace.getConfiguration('files', uri).update('autoGuessEncoding', false, ProX-Code.ConfigurationTarget.Global);
		}

		// with encoding setting
		try {
			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'windows1252', ProX-Code.ConfigurationTarget.Global);
			assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([72, 101, 108, 108, 0xF6, 32, 87, 0xF6, 114, 108, 100]), { uri }), 'Hellö Wörld');
		} finally {
			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'utf8', ProX-Code.ConfigurationTarget.Global);
		}

		// with encoding provided
		assert.strictEqual(await ProX-Code.workspace.decode(new Uint8Array([72, 101, 108, 108, 0xF6, 32, 87, 0xF6, 114, 108, 100]), { encoding: 'windows1252' }), 'Hellö Wörld');
		assert.strictEqual(await ProX-Code.workspace.decode(Buffer.from('Hello World'), { encoding: 'foobar123' }), 'Hello World');

		// binary
		let err;
		try {
			await ProX-Code.workspace.decode(new Uint8Array([0, 0, 0, 0]), { uri });
		} catch (e) {
			err = e;
		}
		assert.ok(err);
	});

	test('encoding: encode', async function () {
		const uri = root.with({ path: posix.join(root.path, 'file.txt') });

		// without setting
		assert.strictEqual((await ProX-Code.workspace.encode('Hello World', { uri })).toString(), 'Hello World');

		// with encoding setting
		try {
			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'utf8bom', ProX-Code.ConfigurationTarget.Global);
			assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { uri }), new Uint8Array([0xEF, 0xBB, 0xBF, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100])));

			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'utf16le', ProX-Code.ConfigurationTarget.Global);
			assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { uri }), new Uint8Array([0xFF, 0xFE, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100, 0])));

			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'utf16be', ProX-Code.ConfigurationTarget.Global);
			assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { uri }), new Uint8Array([0xFE, 0xFF, 0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100])));

			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'cp1252', ProX-Code.ConfigurationTarget.Global);
			assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hellö Wörld', { uri }), new Uint8Array([72, 101, 108, 108, 0xF6, 32, 87, 0xF6, 114, 108, 100])));
		} finally {
			await ProX-Code.workspace.getConfiguration('files', uri).update('encoding', 'utf8', ProX-Code.ConfigurationTarget.Global);
		}

		// with encoding provided
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { encoding: 'utf8' }), new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100])));
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { encoding: 'utf8bom' }), new Uint8Array([0xEF, 0xBB, 0xBF, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100])));
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { encoding: 'utf16le' }), new Uint8Array([0xFF, 0xFE, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100, 0])));
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { encoding: 'utf16be' }), new Uint8Array([0xFE, 0xFF, 0, 72, 0, 101, 0, 108, 0, 108, 0, 111, 0, 32, 0, 87, 0, 111, 0, 114, 0, 108, 0, 100])));
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hellö Wörld', { encoding: 'cp1252' }), new Uint8Array([72, 101, 108, 108, 0xF6, 32, 87, 0xF6, 114, 108, 100])));
		assert.ok(equalsUint8Array(await ProX-Code.workspace.encode('Hello World', { encoding: 'foobar123' }), new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100])));
	});

	function equalsUint8Array(a: Uint8Array, b: Uint8Array): boolean {
		if (a === b) {
			return true;
		}
		if (a.byteLength !== b.byteLength) {
			return false;
		}
		for (let i = 0; i < a.byteLength; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}
		return true;
	}

	test('encoding: save text document with a different encoding', async () => {
		const originalText = 'Hellö\nWörld';
		const uri = await createRandomFile(originalText);

		let doc = await ProX-Code.workspace.openTextDocument(uri);
		assert.strictEqual(doc.encoding, 'utf8');

		const text = doc.getText();
		assert.strictEqual(text, originalText);
		const buf = await ProX-Code.workspace.encode(text, { encoding: 'windows1252' });
		await ProX-Code.workspace.fs.writeFile(uri, buf);

		doc = await ProX-Code.workspace.openTextDocument(uri, { encoding: 'windows1252' });
		assert.strictEqual(doc.encoding, 'windows1252');
		const updatedText = doc.getText();
		assert.strictEqual(updatedText, text);
	});

	test('encoding: utf8bom does not explode (https://github.com/microsoft/ProX-Code/issues/242132)', async function () {
		const buffer = [0xEF, 0xBB, 0xBF, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100];
		const uri = await createRandomFile(new Uint8Array(buffer) /* UTF-8 with BOM */);

		let doc = await ProX-Code.workspace.openTextDocument(uri);
		assert.strictEqual(doc.encoding, 'utf8bom');

		doc = await ProX-Code.workspace.openTextDocument(uri, { encoding: 'utf8bom' });
		assert.strictEqual(doc.encoding, 'utf8bom');

		const decoded = await ProX-Code.workspace.decode(new Uint8Array(buffer), { encoding: 'utf8bom' });
		assert.strictEqual(decoded, 'Hello World');

		const encoded = await ProX-Code.workspace.encode('Hello World', { encoding: 'utf8bom' });
		assert.ok(equalsUint8Array(encoded, new Uint8Array(buffer)));
	});
});
