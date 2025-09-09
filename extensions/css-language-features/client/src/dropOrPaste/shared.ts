/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Utils } from 'ProX-Code-uri';

export const Schemes = Object.freeze({
	file: 'file',
	notebookCell: 'ProX-Code-notebook-cell',
	untitled: 'untitled',
});

export const Mimes = Object.freeze({
	plain: 'text/plain',
	uriList: 'text/uri-list',
});


export function getDocumentDir(uri: ProX-Code.Uri): ProX-Code.Uri | undefined {
	const docUri = getParentDocumentUri(uri);
	if (docUri.scheme === Schemes.untitled) {
		return ProX-Code.workspace.workspaceFolders?.[0]?.uri;
	}
	return Utils.dirname(docUri);
}

function getParentDocumentUri(uri: ProX-Code.Uri): ProX-Code.Uri {
	if (uri.scheme === Schemes.notebookCell) {
		// is notebook documents necessary?
		for (const notebook of ProX-Code.workspace.notebookDocuments) {
			for (const cell of notebook.getCells()) {
				if (cell.document.uri.toString() === uri.toString()) {
					return notebook.uri;
				}
			}
		}
	}

	return uri;
}
