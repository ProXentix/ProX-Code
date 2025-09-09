/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import 'mocha';
import * as ProX-Code from 'ProX-Code';
import { assertNoRpc } from '../utils';

suite('ProX-Code API - types', () => {

	teardown(assertNoRpc);

	test('static properties, es5 compat class', function () {
		assert.ok(ProX-Code.ThemeIcon.File instanceof ProX-Code.ThemeIcon);
		assert.ok(ProX-Code.ThemeIcon.Folder instanceof ProX-Code.ThemeIcon);
		assert.ok(ProX-Code.CodeActionKind.Empty instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.QuickFix instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.Refactor instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.RefactorExtract instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.RefactorInline instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.RefactorMove instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.RefactorRewrite instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.Source instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.SourceOrganizeImports instanceof ProX-Code.CodeActionKind);
		assert.ok(ProX-Code.CodeActionKind.SourceFixAll instanceof ProX-Code.CodeActionKind);
		// assert.ok(ProX-Code.QuickInputButtons.Back instanceof ProX-Code.QuickInputButtons); never was an instance

	});
});
