/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { MdLanguageClient } from '../client/client';
import { Mime } from '../util/mimes';

class UpdatePastedLinksEditProvider implements ProX-Code.DocumentPasteEditProvider {

	public static readonly kind = ProX-Code.DocumentDropOrPasteEditKind.Text.append('updateLinks', 'markdown');

	public static readonly metadataMime = 'application/vnd.ProX-Code.markdown.updatelinks.metadata';

	constructor(
		private readonly _client: MdLanguageClient,
	) { }

	async prepareDocumentPaste(document: ProX-Code.TextDocument, ranges: readonly ProX-Code.Range[], dataTransfer: ProX-Code.DataTransfer, token: ProX-Code.CancellationToken): Promise<void> {
		if (!this._isEnabled(document)) {
			return;
		}

		const metadata = await this._client.prepareUpdatePastedLinks(document.uri, ranges, token);
		if (token.isCancellationRequested) {
			return;
		}

		dataTransfer.set(UpdatePastedLinksEditProvider.metadataMime, new ProX-Code.DataTransferItem(metadata));
	}

	async provideDocumentPasteEdits(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		context: ProX-Code.DocumentPasteEditContext,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentPasteEdit[] | undefined> {
		if (!this._isEnabled(document)) {
			return;
		}

		const metadata = dataTransfer.get(UpdatePastedLinksEditProvider.metadataMime)?.value;
		if (!metadata) {
			return;
		}

		const textItem = dataTransfer.get(Mime.textPlain);
		const text = await textItem?.asString();
		if (!text || token.isCancellationRequested) {
			return;
		}

		// TODO: Handle cases such as:
		// - copy empty line
		// - Copy with multiple cursors and paste into multiple locations
		// - ...
		const edits = await this._client.getUpdatePastedLinksEdit(document.uri, ranges.map(x => new ProX-Code.TextEdit(x, text)), metadata, token);
		if (!edits?.length || token.isCancellationRequested) {
			return;
		}

		const pasteEdit = new ProX-Code.DocumentPasteEdit('', ProX-Code.l10n.t("Paste and update pasted links"), UpdatePastedLinksEditProvider.kind);
		const workspaceEdit = new ProX-Code.WorkspaceEdit();
		workspaceEdit.set(document.uri, edits.map(x => new ProX-Code.TextEdit(new ProX-Code.Range(x.range.start.line, x.range.start.character, x.range.end.line, x.range.end.character,), x.newText)));
		pasteEdit.additionalEdit = workspaceEdit;

		if (!context.only || !UpdatePastedLinksEditProvider.kind.contains(context.only)) {
			pasteEdit.yieldTo = [ProX-Code.DocumentDropOrPasteEditKind.Text];
		}

		return [pasteEdit];
	}

	private _isEnabled(document: ProX-Code.TextDocument): boolean {
		return ProX-Code.workspace.getConfiguration('markdown', document.uri).get<boolean>('editor.updateLinksOnPaste.enabled', true);
	}
}

export function registerUpdatePastedLinks(selector: ProX-Code.DocumentSelector, client: MdLanguageClient) {
	return ProX-Code.languages.registerDocumentPasteEditProvider(selector, new UpdatePastedLinksEditProvider(client), {
		copyMimeTypes: [UpdatePastedLinksEditProvider.metadataMime],
		providedPasteEditKinds: [UpdatePastedLinksEditProvider.kind],
		pasteMimeTypes: [UpdatePastedLinksEditProvider.metadataMime],
	});
}
