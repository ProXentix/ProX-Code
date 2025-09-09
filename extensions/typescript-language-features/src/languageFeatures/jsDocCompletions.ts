/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { DocumentSelector } from '../configuration/documentSelector';
import { LanguageDescription } from '../configuration/languageDescription';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';
import FileConfigurationManager from './fileConfigurationManager';



const defaultJsDoc = new ProX-Code.SnippetString(`/**\n * $0\n */`);

class JsDocCompletionItem extends ProX-Code.CompletionItem {
	constructor(
		public readonly document: ProX-Code.TextDocument,
		public readonly position: ProX-Code.Position
	) {
		super('/** */', ProX-Code.CompletionItemKind.Text);
		this.detail = ProX-Code.l10n.t("JSDoc comment");
		this.sortText = '\0';

		const line = document.lineAt(position.line).text;
		const prefix = line.slice(0, position.character).match(/\/\**\s*$/);
		const suffix = line.slice(position.character).match(/^\s*\**\//);
		const start = position.translate(0, prefix ? -prefix[0].length : 0);
		const range = new ProX-Code.Range(start, position.translate(0, suffix ? suffix[0].length : 0));
		this.range = { inserting: range, replacing: range };
	}
}

class JsDocCompletionProvider implements ProX-Code.CompletionItemProvider {

	constructor(
		private readonly client: ITypeScriptServiceClient,
		private readonly language: LanguageDescription,
		private readonly fileConfigurationManager: FileConfigurationManager,
	) { }

	public async provideCompletionItems(
		document: ProX-Code.TextDocument,
		position: ProX-Code.Position,
		token: ProX-Code.CancellationToken
	): Promise<ProX-Code.CompletionItem[] | undefined> {
		if (!ProX-Code.workspace.getConfiguration(this.language.id, document).get('suggest.completeJSDocs')) {
			return undefined;
		}

		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return undefined;
		}

		if (!this.isPotentiallyValidDocCompletionPosition(document, position)) {
			return undefined;
		}

		const response = await this.client.interruptGetErr(async () => {
			await this.fileConfigurationManager.ensureConfigurationForDocument(document, token);

			const args = typeConverters.Position.toFileLocationRequestArgs(file, position);
			return this.client.execute('docCommentTemplate', args, token);
		});
		if (response.type !== 'response' || !response.body) {
			return undefined;
		}

		const item = new JsDocCompletionItem(document, position);

		// Workaround for #43619
		// docCommentTemplate previously returned undefined for empty jsdoc templates.
		// TS 2.7 now returns a single line doc comment, which breaks indentation.
		if (response.body.newText === '/** */') {
			item.insertText = defaultJsDoc;
		} else {
			item.insertText = templateToSnippet(response.body.newText);
		}

		return [item];
	}

	private isPotentiallyValidDocCompletionPosition(
		document: ProX-Code.TextDocument,
		position: ProX-Code.Position
	): boolean {
		// Only show the JSdoc completion when the everything before the cursor is whitespace
		// or could be the opening of a comment
		const line = document.lineAt(position.line).text;
		const prefix = line.slice(0, position.character);
		if (!/^\s*$|\/\*\*\s*$|^\s*\/\*\*+\s*$/.test(prefix)) {
			return false;
		}

		// And everything after is possibly a closing comment or more whitespace
		const suffix = line.slice(position.character);
		return /^\s*(\*+\/)?\s*$/.test(suffix);
	}
}

export function templateToSnippet(template: string): ProX-Code.SnippetString {
	// TODO: use append placeholder
	let snippetIndex = 1;
	template = template.replace(/\$/g, '\\$'); // CodeQL [SM02383] This is only used for text which is put into the editor. It is not for rendered html
	template = template.replace(/^[ \t]*(?=(\/|[ ]\*))/gm, '');
	template = template.replace(/^(\/\*\*\s*\*[ ]*)$/m, (x) => x + `\$0`);
	template = template.replace(/\* @param([ ]\{\S+\})?\s+(\S+)[ \t]*$/gm, (_param, type, post) => {
		let out = '* @param ';
		if (type === ' {any}' || type === ' {*}') {
			out += `{\$\{${snippetIndex++}:*\}} `;
		} else if (type) {
			out += type + ' ';
		}
		out += post + ` \${${snippetIndex++}}`;
		return out;
	});

	template = template.replace(/\* @returns[ \t]*$/gm, `* @returns \${${snippetIndex++}}`);

	return new ProX-Code.SnippetString(template);
}

export function register(
	selector: DocumentSelector,
	language: LanguageDescription,
	client: ITypeScriptServiceClient,
	fileConfigurationManager: FileConfigurationManager,

): ProX-Code.Disposable {
	return ProX-Code.languages.registerCompletionItemProvider(selector.syntax,
		new JsDocCompletionProvider(client, language, fileConfigurationManager),
		'*');
}
