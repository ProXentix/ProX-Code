/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as ProX-Code from 'ProX-Code';
import { asPromise, assertNoRpc, closeAllEditors } from '../utils';

suite('ProX-Code - automatic language detection', () => {

	teardown(async function () {
		assertNoRpc();
		await closeAllEditors();
	});

	// TODO@TylerLeonhardt https://github.com/microsoft/ProX-Code/issues/135157
	test.skip('test automatic language detection works', async () => {
		const receivedEvent = asPromise(ProX-Code.workspace.onDidOpenTextDocument, 5000);
		const doc = await ProX-Code.workspace.openTextDocument();
		const editor = await ProX-Code.window.showTextDocument(doc);
		await receivedEvent;

		assert.strictEqual(editor.document.languageId, 'plaintext');

		const settingResult = ProX-Code.workspace.getConfiguration().get<boolean>('workbench.editor.languageDetection');
		assert.ok(settingResult);

		const result = await editor.edit(editBuilder => {
			editBuilder.insert(new ProX-Code.Position(0, 0), `{
	"extends": "./tsconfig.base.json",
	"compilerOptions": {
		"removeComments": false,
		"preserveConstEnums": true,
		"sourceMap": false,
		"outDir": "../out/vs",
		"target": "es2020",
		"types": [
			"mocha",
			"semver",
			"sinon",
			"winreg",
			"trusted-types",
			"wicg-file-system-access"
		],
		"plugins": [
			{
				"name": "tsec",
				"exemptionConfig": "./tsec.exemptions.json"
			}
		]
	},
	"include": [
		"./typings",
		"./vs"
	]
}`);
		});

		assert.ok(result);

		// Changing the language triggers a file to be closed and opened again so wait for that event to happen.
		let newDoc;
		do {
			newDoc = await asPromise(ProX-Code.workspace.onDidOpenTextDocument, 5000);
		} while (doc.uri.toString() !== newDoc.uri.toString());

		assert.strictEqual(newDoc.languageId, 'json');
	});
});
