/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as ProX-Code from 'ProX-Code';
import { onChangedDocument, retryUntilDocumentChanges, wait } from './testUtils';

export async function acceptFirstSuggestion(uri: ProX-Code.Uri, _disposables: ProX-Code.Disposable[]) {
	return retryUntilDocumentChanges(uri, { retries: 10, timeout: 0 }, _disposables, async () => {
		await ProX-Code.commands.executeCommand('editor.action.triggerSuggest');
		await wait(1000);
		await ProX-Code.commands.executeCommand('acceptSelectedSuggestion');
	});
}

export async function typeCommitCharacter(uri: ProX-Code.Uri, character: string, _disposables: ProX-Code.Disposable[]) {
	const didChangeDocument = onChangedDocument(uri, _disposables);
	await ProX-Code.commands.executeCommand('editor.action.triggerSuggest');
	await wait(3000); // Give time for suggestions to show
	await ProX-Code.commands.executeCommand('type', { text: character });
	return await didChangeDocument;
}
