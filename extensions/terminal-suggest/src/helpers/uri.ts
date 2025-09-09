/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export function getFriendlyResourcePath(uri: ProX-Code.Uri, pathSeparator: string, kind?: ProX-Code.TerminalCompletionItemKind): string {
	let path = uri.fsPath;
	// Ensure drive is capitalized on Windows
	if (pathSeparator === '\\' && path.match(/^[a-zA-Z]:\\/)) {
		path = `${path[0].toUpperCase()}:${path.slice(2)}`;
	}
	if (kind === ProX-Code.TerminalCompletionItemKind.Folder) {
		if (!path.endsWith(pathSeparator)) {
			path += pathSeparator;
		}
	}
	return path;
}
