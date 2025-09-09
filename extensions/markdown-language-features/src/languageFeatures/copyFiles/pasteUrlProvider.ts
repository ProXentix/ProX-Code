/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { IMdParser } from '../../markdownEngine';
import { Mime } from '../../util/mimes';
import { UriList } from '../../util/uriList';
import { createInsertUriListEdit, linkEditKind } from './shared';
import { InsertMarkdownLink, findValidUriInText, shouldInsertMarkdownLinkByDefault } from './smartDropOrPaste';

/**
 * Adds support for pasting text uris to create markdown links.
 *
 * This only applies to `text/plain`. Other mimes like `text/uri-list` are handled by ResourcePasteOrDropProvider.
 */
class PasteUrlEditProvider implements ProX-Code.DocumentPasteEditProvider {

	public static readonly kind = linkEditKind;

	public static readonly pasteMimeTypes = [Mime.textPlain];

	constructor(
		private readonly _parser: IMdParser,
	) { }

	async provideDocumentPasteEdits(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		context: ProX-Code.DocumentPasteEditContext,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentPasteEdit[] | undefined> {
		const pasteUrlSetting = ProX-Code.workspace.getConfiguration('markdown', document)
			.get<InsertMarkdownLink>('editor.pasteUrlAsFormattedLink.enabled', InsertMarkdownLink.SmartWithSelection);
		if (pasteUrlSetting === InsertMarkdownLink.Never) {
			return;
		}

		const item = dataTransfer.get(Mime.textPlain);
		const text = await item?.asString();
		if (token.isCancellationRequested || !text) {
			return;
		}

		// TODO: If the user has explicitly requested to paste as a markdown link,
		// try to paste even if we don't have a valid uri
		const uriText = findValidUriInText(text);
		if (!uriText) {
			return;
		}

		const edit = createInsertUriListEdit(document, ranges, UriList.from(uriText), {
			linkKindHint: context.only,
			preserveAbsoluteUris: true
		});
		if (!edit) {
			return;
		}

		const pasteEdit = new ProX-Code.DocumentPasteEdit('', edit.label, PasteUrlEditProvider.kind);
		const workspaceEdit = new ProX-Code.WorkspaceEdit();
		workspaceEdit.set(document.uri, edit.edits);
		pasteEdit.additionalEdit = workspaceEdit;

		if (!(await shouldInsertMarkdownLinkByDefault(this._parser, document, pasteUrlSetting, ranges, token))) {
			pasteEdit.yieldTo = [
				ProX-Code.DocumentDropOrPasteEditKind.Text,
				ProX-Code.DocumentDropOrPasteEditKind.Empty.append('uri')
			];
		}

		return [pasteEdit];
	}
}

export function registerPasteUrlSupport(selector: ProX-Code.DocumentSelector, parser: IMdParser) {
	return ProX-Code.languages.registerDocumentPasteEditProvider(selector, new PasteUrlEditProvider(parser), {
		providedPasteEditKinds: [PasteUrlEditProvider.kind],
		pasteMimeTypes: PasteUrlEditProvider.pasteMimeTypes,
	});
}
