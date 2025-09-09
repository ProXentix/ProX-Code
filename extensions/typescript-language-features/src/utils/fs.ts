/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export async function exists(resource: ProX-Code.Uri): Promise<boolean> {
	try {
		const stat = await ProX-Code.workspace.fs.stat(resource);
		// stat.type is an enum flag
		return !!(stat.type & ProX-Code.FileType.File);
	} catch {
		return false;
	}
}

export function looksLikeAbsoluteWindowsPath(path: string): boolean {
	return /^[a-zA-Z]:[\/\\]/.test(path);
}
