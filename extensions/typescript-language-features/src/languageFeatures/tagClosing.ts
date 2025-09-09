/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { DocumentSelector } from '../configuration/documentSelector';
import { LanguageDescription } from '../configuration/languageDescription';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';
import { Disposable } from '../utils/dispose';
import { Condition, conditionalRegistration } from './util/dependentRegistration';

class TagClosing extends Disposable {

	private _disposed = false;
	private _timeout: NodeJS.Timeout | undefined = undefined;
	private _cancel: ProX-Code.CancellationTokenSource | undefined = undefined;

	constructor(
		private readonly client: ITypeScriptServiceClient
	) {
		super();
		ProX-Code.workspace.onDidChangeTextDocument(
			event => this.onDidChangeTextDocument(event),
			null,
			this._disposables);
	}

	public override dispose() {
		super.dispose();
		this._disposed = true;

		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = undefined;
		}

		if (this._cancel) {
			this._cancel.cancel();
			this._cancel.dispose();
			this._cancel = undefined;
		}
	}

	private onDidChangeTextDocument(
		{ document, contentChanges, reason }: ProX-Code.TextDocumentChangeEvent
	) {
		if (contentChanges.length === 0 || reason === ProX-Code.TextDocumentChangeReason.Undo || reason === ProX-Code.TextDocumentChangeReason.Redo) {
			return;
		}

		const activeDocument = ProX-Code.window.activeTextEditor?.document;
		if (document !== activeDocument) {
			return;
		}

		const filepath = this.client.toOpenTsFilePath(document);
		if (!filepath) {
			return;
		}

		if (typeof this._timeout !== 'undefined') {
			clearTimeout(this._timeout);
		}

		if (this._cancel) {
			this._cancel.cancel();
			this._cancel.dispose();
			this._cancel = undefined;
		}

		const lastChange = contentChanges[contentChanges.length - 1];
		const lastCharacter = lastChange.text[lastChange.text.length - 1];
		if (lastChange.rangeLength > 0 || lastCharacter !== '>' && lastCharacter !== '/') {
			return;
		}

		const priorCharacter = lastChange.range.start.character > 0
			? document.getText(new ProX-Code.Range(lastChange.range.start.translate({ characterDelta: -1 }), lastChange.range.start))
			: '';
		if (priorCharacter === '>') {
			return;
		}

		const version = document.version;
		this._timeout = setTimeout(async () => {
			this._timeout = undefined;

			if (this._disposed) {
				return;
			}

			const addedLines = lastChange.text.split(/\r\n|\n/g);
			const position = addedLines.length <= 1
				? lastChange.range.start.translate({ characterDelta: lastChange.text.length })
				: new ProX-Code.Position(lastChange.range.start.line + addedLines.length - 1, addedLines[addedLines.length - 1].length);

			const args: Proto.JsxClosingTagRequestArgs = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
			this._cancel = new ProX-Code.CancellationTokenSource();
			const response = await this.client.execute('jsxClosingTag', args, this._cancel.token);
			if (response.type !== 'response' || !response.body) {
				return;
			}

			if (this._disposed) {
				return;
			}

			const activeEditor = ProX-Code.window.activeTextEditor;
			if (!activeEditor) {
				return;
			}

			const insertion = response.body;
			const activeDocument = activeEditor.document;
			if (document === activeDocument && activeDocument.version === version) {
				activeEditor.insertSnippet(
					this.getTagSnippet(insertion),
					this.getInsertionPositions(activeEditor, position));
			}
		}, 100);
	}

	private getTagSnippet(closingTag: Proto.TextInsertion): ProX-Code.SnippetString {
		const snippet = new ProX-Code.SnippetString();
		snippet.appendPlaceholder('', 0);
		snippet.appendText(closingTag.newText);
		return snippet;
	}

	private getInsertionPositions(editor: ProX-Code.TextEditor, position: ProX-Code.Position) {
		const activeSelectionPositions = editor.selections.map(s => s.active);
		return activeSelectionPositions.some(p => p.isEqual(position))
			? activeSelectionPositions
			: position;
	}
}

function requireActiveDocumentSetting(
	selector: ProX-Code.DocumentSelector,
	language: LanguageDescription,
) {
	return new Condition(
		() => {
			const editor = ProX-Code.window.activeTextEditor;
			if (!editor || !ProX-Code.languages.match(selector, editor.document)) {
				return false;
			}

			return !!ProX-Code.workspace.getConfiguration(language.id, editor.document).get('autoClosingTags');
		},
		handler => {
			return ProX-Code.Disposable.from(
				ProX-Code.window.onDidChangeActiveTextEditor(handler),
				ProX-Code.workspace.onDidOpenTextDocument(handler),
				ProX-Code.workspace.onDidChangeConfiguration(handler));
		});
}

export function register(
	selector: DocumentSelector,
	language: LanguageDescription,
	client: ITypeScriptServiceClient,
) {
	return conditionalRegistration([
		requireActiveDocumentSetting(selector.syntax, language)
	], () => new TagClosing(client));
}
