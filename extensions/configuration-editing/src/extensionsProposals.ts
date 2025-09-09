/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';


export async function provideInstalledExtensionProposals(existing: string[], additionalText: string, range: ProX-Code.Range, includeBuiltinExtensions: boolean): Promise<ProX-Code.CompletionItem[] | ProX-Code.CompletionList> {
	if (Array.isArray(existing)) {
		const extensions = includeBuiltinExtensions ? ProX-Code.extensions.all : ProX-Code.extensions.all.filter(e => !(e.id.startsWith('ProX-Code.') || e.id === 'Microsoft.ProX-Code-markdown'));
		const knownExtensionProposals = extensions.filter(e => existing.indexOf(e.id) === -1);
		if (knownExtensionProposals.length) {
			return knownExtensionProposals.map(e => {
				const item = new ProX-Code.CompletionItem(e.id);
				const insertText = `"${e.id}"${additionalText}`;
				item.kind = ProX-Code.CompletionItemKind.Value;
				item.insertText = insertText;
				item.range = range;
				item.filterText = insertText;
				return item;
			});
		} else {
			const example = new ProX-Code.CompletionItem(ProX-Code.l10n.t("Example"));
			example.insertText = '"ProX-Code.csharp"';
			example.kind = ProX-Code.CompletionItemKind.Value;
			example.range = range;
			return [example];
		}
	}
	return [];
}
