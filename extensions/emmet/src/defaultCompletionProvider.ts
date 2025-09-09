/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Node, Stylesheet } from 'EmmetFlatNode';
import { isValidLocationForEmmetAbbreviation, getSyntaxFromArgs } from './abbreviationActions';
import { getEmmetHelper, getMappingForIncludedLanguages, parsePartialStylesheet, getEmmetConfiguration, getEmmetMode, isStyleSheet, getFlatNode, allowedMimeTypesInScriptTag, toLSTextDocument, getHtmlFlatNode, getEmbeddedCssNodeIfAny } from './util';
import { Range as LSRange } from 'ProX-Code-languageserver-textdocument';
import { getRootNode } from './parseDocument';

export class DefaultCompletionItemProvider implements ProX-Code.CompletionItemProvider {

	private lastCompletionType: string | undefined;

	public provideCompletionItems(document: ProX-Code.TextDocument, position: ProX-Code.Position, _: ProX-Code.CancellationToken, context: ProX-Code.CompletionContext): Thenable<ProX-Code.CompletionList | undefined> | undefined {
		const completionResult = this.provideCompletionItemsInternal(document, position, context);
		if (!completionResult) {
			this.lastCompletionType = undefined;
			return;
		}

		return completionResult.then(completionList => {
			if (!completionList || !completionList.items.length) {
				this.lastCompletionType = undefined;
				return completionList;
			}
			const item = completionList.items[0];
			const expandedText = item.documentation ? item.documentation.toString() : '';

			if (expandedText.startsWith('<')) {
				this.lastCompletionType = 'html';
			} else if (expandedText.indexOf(':') > 0 && expandedText.endsWith(';')) {
				this.lastCompletionType = 'css';
			} else {
				this.lastCompletionType = undefined;
			}
			return completionList;
		});
	}

	private provideCompletionItemsInternal(document: ProX-Code.TextDocument, position: ProX-Code.Position, context: ProX-Code.CompletionContext): Thenable<ProX-Code.CompletionList | undefined> | undefined {
		const emmetConfig = ProX-Code.workspace.getConfiguration('emmet');
		const excludedLanguages = emmetConfig['excludeLanguages'] ? emmetConfig['excludeLanguages'] : [];
		if (excludedLanguages.includes(document.languageId)) {
			return;
		}

		const mappedLanguages = getMappingForIncludedLanguages();
		const isSyntaxMapped = mappedLanguages[document.languageId] ? true : false;
		const emmetMode = getEmmetMode((isSyntaxMapped ? mappedLanguages[document.languageId] : document.languageId), mappedLanguages, excludedLanguages);

		if (!emmetMode
			|| emmetConfig['showExpandedAbbreviation'] === 'never'
			|| ((isSyntaxMapped || emmetMode === 'jsx') && emmetConfig['showExpandedAbbreviation'] !== 'always')) {
			return;
		}

		let syntax = emmetMode;

		let validateLocation = syntax === 'html' || syntax === 'jsx' || syntax === 'xml';
		let rootNode: Node | undefined;
		let currentNode: Node | undefined;

		const lsDoc = toLSTextDocument(document);
		position = document.validatePosition(position);

		// Don't show completions if there's a comment at the beginning of the line
		const lineRange = new ProX-Code.Range(position.line, 0, position.line, position.character);
		if (document.getText(lineRange).trimStart().startsWith('//')) {
			return;
		}

		const helper = getEmmetHelper();
		if (syntax === 'html') {
			if (context.triggerKind === ProX-Code.CompletionTriggerKind.TriggerForIncompleteCompletions) {
				switch (this.lastCompletionType) {
					case 'html':
						validateLocation = false;
						break;
					case 'css':
						validateLocation = false;
						syntax = 'css';
						break;
					default:
						break;
				}
			}
			if (validateLocation) {
				const positionOffset = document.offsetAt(position);
				const emmetRootNode = getRootNode(document, true);
				const foundNode = getHtmlFlatNode(document.getText(), emmetRootNode, positionOffset, false);
				if (foundNode) {
					if (foundNode.name === 'script') {
						const typeNode = foundNode.attributes.find(attr => attr.name.toString() === 'type');
						if (typeNode) {
							const typeAttrValue = typeNode.value.toString();
							if (typeAttrValue === 'application/javascript' || typeAttrValue === 'text/javascript') {
								if (!getSyntaxFromArgs({ language: 'javascript' })) {
									return;
								} else {
									validateLocation = false;
								}
							}
							else if (allowedMimeTypesInScriptTag.includes(typeAttrValue)) {
								validateLocation = false;
							}
						} else {
							return;
						}
					}
					else if (foundNode.name === 'style') {
						syntax = 'css';
						validateLocation = false;
					} else {
						const styleNode = foundNode.attributes.find(attr => attr.name.toString() === 'style');
						if (styleNode && styleNode.value.start <= positionOffset && positionOffset <= styleNode.value.end) {
							syntax = 'css';
							validateLocation = false;
						}
					}
				}
			}
		}

		const expandOptions = isStyleSheet(syntax) ?
			{ lookAhead: false, syntax: 'stylesheet' } :
			{ lookAhead: true, syntax: 'markup' };
		const extractAbbreviationResults = helper.extractAbbreviation(lsDoc, position, expandOptions);
		if (!extractAbbreviationResults || !helper.isAbbreviationValid(syntax, extractAbbreviationResults.abbreviation)) {
			return;
		}

		const offset = document.offsetAt(position);
		if (isStyleSheet(document.languageId) && context.triggerKind !== ProX-Code.CompletionTriggerKind.TriggerForIncompleteCompletions) {
			validateLocation = true;
			const usePartialParsing = ProX-Code.workspace.getConfiguration('emmet')['optimizeStylesheetParsing'] === true;
			rootNode = usePartialParsing && document.lineCount > 1000 ? parsePartialStylesheet(document, position) : <Stylesheet>getRootNode(document, true);
			if (!rootNode) {
				return;
			}
			currentNode = getFlatNode(rootNode, offset, true);
		}

		// Fix for https://github.com/microsoft/ProX-Code/issues/107578
		// Validate location if syntax is of styleSheet type to ensure that location is valid for emmet abbreviation.
		// For an html document containing a <style> node, compute the embeddedCssNode and fetch the flattened node as currentNode.
		if (!isStyleSheet(document.languageId) && isStyleSheet(syntax) && context.triggerKind !== ProX-Code.CompletionTriggerKind.TriggerForIncompleteCompletions) {
			validateLocation = true;
			rootNode = getRootNode(document, true);
			if (!rootNode) {
				return;
			}
			const flatNode = getFlatNode(rootNode, offset, true);
			const embeddedCssNode = getEmbeddedCssNodeIfAny(document, flatNode, position);
			currentNode = getFlatNode(embeddedCssNode, offset, true);
		}

		if (validateLocation && !isValidLocationForEmmetAbbreviation(document, rootNode, currentNode, syntax, offset, toRange(extractAbbreviationResults.abbreviationRange))) {
			return;
		}

		let isNoisePromise: Thenable<boolean> = Promise.resolve(false);

		// Fix for https://github.com/microsoft/ProX-Code/issues/32647
		// Check for document symbols in js/ts/jsx/tsx and avoid triggering emmet for abbreviations of the form symbolName.sometext
		// Presence of > or * or + in the abbreviation denotes valid abbreviation that should trigger emmet
		if (!isStyleSheet(syntax) && (document.languageId === 'javascript' || document.languageId === 'javascriptreact' || document.languageId === 'typescript' || document.languageId === 'typescriptreact')) {
			const abbreviation: string = extractAbbreviationResults.abbreviation;
			// For the second condition, we don't want abbreviations that have [] characters but not ='s in them to expand
			// In turn, users must explicitly expand abbreviations of the form Component[attr1 attr2], but it means we don't try to expand a[i].
			if (abbreviation.startsWith('this.') || /\[[^\]=]*\]/.test(abbreviation)) {
				isNoisePromise = Promise.resolve(true);
			} else {
				isNoisePromise = ProX-Code.commands.executeCommand<ProX-Code.SymbolInformation[] | undefined>('ProX-Code.executeDocumentSymbolProvider', document.uri).then(symbols => {
					return !!symbols && symbols.some(x => abbreviation === x.name || (abbreviation.startsWith(x.name + '.') && !/>|\*|\+/.test(abbreviation)));
				});
			}
		}

		return isNoisePromise.then((isNoise): ProX-Code.CompletionList | undefined => {
			if (isNoise) {
				return undefined;
			}

			const config = getEmmetConfiguration(syntax!);
			const result = helper.doComplete(toLSTextDocument(document), position, syntax, config);

			const newItems: ProX-Code.CompletionItem[] = [];
			if (result && result.items) {
				result.items.forEach((item: any) => {
					const newItem = new ProX-Code.CompletionItem(item.label);
					newItem.documentation = item.documentation;
					newItem.detail = item.detail;
					newItem.insertText = new ProX-Code.SnippetString(item.textEdit.newText);
					const oldrange = item.textEdit.range;
					newItem.range = new ProX-Code.Range(oldrange.start.line, oldrange.start.character, oldrange.end.line, oldrange.end.character);

					newItem.filterText = item.filterText;
					newItem.sortText = item.sortText;

					if (emmetConfig['showSuggestionsAsSnippets'] === true) {
						newItem.kind = ProX-Code.CompletionItemKind.Snippet;
					}
					newItems.push(newItem);
				});
			}

			return new ProX-Code.CompletionList(newItems, true);
		});
	}
}

function toRange(lsRange: LSRange) {
	return new ProX-Code.Range(lsRange.start.line, lsRange.start.character, lsRange.end.line, lsRange.end.character);
}
