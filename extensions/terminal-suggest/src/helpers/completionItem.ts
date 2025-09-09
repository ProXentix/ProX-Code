/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import type { ICompletionResource } from '../types';

export function createCompletionItem(cursorPosition: number, prefix: string, commandResource: ICompletionResource, detail?: string, documentation?: string | ProX-Code.MarkdownString, kind?: ProX-Code.TerminalCompletionItemKind): ProX-Code.TerminalCompletionItem {
	const endsWithSpace = prefix.endsWith(' ');
	const lastWord = endsWithSpace ? '' : prefix.split(' ').at(-1) ?? '';
	return {
		label: commandResource.label,
		detail: detail ?? commandResource.detail ?? '',
		documentation,
		replacementIndex: cursorPosition - lastWord.length,
		replacementLength: lastWord.length,
		kind: kind ?? commandResource.kind ?? ProX-Code.TerminalCompletionItemKind.Method
	};
}
