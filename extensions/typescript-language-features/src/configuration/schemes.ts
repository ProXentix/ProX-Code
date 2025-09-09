/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const Schemes = Object.freeze({
	file: 'file',
	untitled: 'untitled',
	mailto: 'mailto',
	ProX-Code: 'ProX-Code',
	'ProX-Code-insiders': 'ProX-Code-insiders',
	notebookCell: 'ProX-Code-notebook-cell',
});

export function isOfScheme(scheme: string, link: string): boolean {
	return link.toLowerCase().startsWith(scheme + ':');
}
