/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { getLocation, Location } from 'jsonc-parser';
import { implicitActivationEvent, redundantImplicitActivationEvent } from './constants';


export class PackageDocument {

	constructor(private document: ProX-Code.TextDocument) { }

	public provideCompletionItems(position: ProX-Code.Position, _token: ProX-Code.CancellationToken): ProX-Code.ProviderResult<ProX-Code.CompletionItem[]> {
		const location = getLocation(this.document.getText(), this.document.offsetAt(position));

		if (location.path.length >= 2 && location.path[1] === 'configurationDefaults') {
			return this.provideLanguageOverridesCompletionItems(location, position);
		}

		return undefined;
	}

	public provideCodeActions(_range: ProX-Code.Range, context: ProX-Code.CodeActionContext, _token: ProX-Code.CancellationToken): ProX-Code.ProviderResult<ProX-Code.CodeAction[]> {
		const codeActions: ProX-Code.CodeAction[] = [];
		for (const diagnostic of context.diagnostics) {
			if (diagnostic.message === implicitActivationEvent || diagnostic.message === redundantImplicitActivationEvent) {
				const codeAction = new ProX-Code.CodeAction(ProX-Code.l10n.t("Remove activation event"), ProX-Code.CodeActionKind.QuickFix);
				codeAction.edit = new ProX-Code.WorkspaceEdit();
				const rangeForCharAfter = diagnostic.range.with(diagnostic.range.end, diagnostic.range.end.translate(0, 1));
				if (this.document.getText(rangeForCharAfter) === ',') {
					codeAction.edit.delete(this.document.uri, diagnostic.range.with(undefined, diagnostic.range.end.translate(0, 1)));
				} else {
					codeAction.edit.delete(this.document.uri, diagnostic.range);
				}
				codeActions.push(codeAction);
			}
		}
		return codeActions;
	}

	private provideLanguageOverridesCompletionItems(location: Location, position: ProX-Code.Position): ProX-Code.ProviderResult<ProX-Code.CompletionItem[]> {
		let range = this.getReplaceRange(location, position);
		const text = this.document.getText(range);

		if (location.path.length === 2) {

			let snippet = '"[${1:language}]": {\n\t"$0"\n}';

			// Suggestion model word matching includes quotes,
			// hence exclude the starting quote from the snippet and the range
			// ending quote gets replaced
			if (text && text.startsWith('"')) {
				range = new ProX-Code.Range(new ProX-Code.Position(range.start.line, range.start.character + 1), range.end);
				snippet = snippet.substring(1);
			}

			return Promise.resolve([this.newSnippetCompletionItem({
				label: ProX-Code.l10n.t("Language specific editor settings"),
				documentation: ProX-Code.l10n.t("Override editor settings for language"),
				snippet,
				range
			})]);
		}

		if (location.path.length === 3 && location.previousNode && typeof location.previousNode.value === 'string' && location.previousNode.value.startsWith('[')) {

			// Suggestion model word matching includes starting quote and open sqaure bracket
			// Hence exclude them from the proposal range
			range = new ProX-Code.Range(new ProX-Code.Position(range.start.line, range.start.character + 2), range.end);

			return ProX-Code.languages.getLanguages().then(languages => {
				return languages.map(l => {

					// Suggestion model word matching includes closed sqaure bracket and ending quote
					// Hence include them in the proposal to replace
					return this.newSimpleCompletionItem(l, range, '', l + ']"');
				});
			});
		}
		return Promise.resolve([]);
	}

	private getReplaceRange(location: Location, position: ProX-Code.Position) {
		const node = location.previousNode;
		if (node) {
			const nodeStart = this.document.positionAt(node.offset), nodeEnd = this.document.positionAt(node.offset + node.length);
			if (nodeStart.isBeforeOrEqual(position) && nodeEnd.isAfterOrEqual(position)) {
				return new ProX-Code.Range(nodeStart, nodeEnd);
			}
		}
		return new ProX-Code.Range(position, position);
	}

	private newSimpleCompletionItem(text: string, range: ProX-Code.Range, description?: string, insertText?: string): ProX-Code.CompletionItem {
		const item = new ProX-Code.CompletionItem(text);
		item.kind = ProX-Code.CompletionItemKind.Value;
		item.detail = description;
		item.insertText = insertText ? insertText : text;
		item.range = range;
		return item;
	}

	private newSnippetCompletionItem(o: { label: string; documentation?: string; snippet: string; range: ProX-Code.Range }): ProX-Code.CompletionItem {
		const item = new ProX-Code.CompletionItem(o.label);
		item.kind = ProX-Code.CompletionItemKind.Value;
		item.documentation = o.documentation;
		item.insertText = new ProX-Code.SnippetString(o.snippet);
		item.range = o.range;
		return item;
	}
}
