/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as ProX-Code from 'ProX-Code';
import { getDocumentDir, Mimes, Schemes } from './shared';
import { UriList } from './uriList';

class DropOrPasteResourceProvider implements ProX-Code.DocumentDropEditProvider, ProX-Code.DocumentPasteEditProvider {

	readonly kind = ProX-Code.DocumentDropOrPasteEditKind.Empty.append('css', 'link', 'url');

	async provideDocumentDropEdits(
		document: ProX-Code.TextDocument,
		position: ProX-Code.Position,
		dataTransfer: ProX-Code.DataTransfer,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentDropEdit | undefined> {
		const uriList = await this.getUriList(dataTransfer);
		if (!uriList.entries.length || token.isCancellationRequested) {
			return;
		}

		const snippet = await this.createUriListSnippet(document.uri, uriList);
		if (!snippet || token.isCancellationRequested) {
			return;
		}

		return {
			kind: this.kind,
			title: snippet.label,
			insertText: snippet.snippet.value,
			yieldTo: this.pasteAsCssUrlByDefault(document, position) ? [] : [ProX-Code.DocumentDropOrPasteEditKind.Empty.append('uri')]
		};
	}

	async provideDocumentPasteEdits(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		_context: ProX-Code.DocumentPasteEditContext,
		token: ProX-Code.CancellationToken
	): Promise<ProX-Code.DocumentPasteEdit[] | undefined> {
		const uriList = await this.getUriList(dataTransfer);
		if (!uriList.entries.length || token.isCancellationRequested) {
			return;
		}

		const snippet = await this.createUriListSnippet(document.uri, uriList);
		if (!snippet || token.isCancellationRequested) {
			return;
		}

		return [{
			kind: this.kind,
			title: snippet.label,
			insertText: snippet.snippet.value,
			yieldTo: this.pasteAsCssUrlByDefault(document, ranges[0].start) ? [] : [ProX-Code.DocumentDropOrPasteEditKind.Empty.append('uri')]
		}];
	}

	private async getUriList(dataTransfer: ProX-Code.DataTransfer): Promise<UriList> {
		const urlList = await dataTransfer.get(Mimes.uriList)?.asString();
		if (urlList) {
			return UriList.from(urlList);
		}

		// Find file entries
		const uris: ProX-Code.Uri[] = [];
		for (const [_, entry] of dataTransfer) {
			const file = entry.asFile();
			if (file?.uri) {
				uris.push(file.uri);
			}
		}

		return new UriList(uris.map(uri => ({ uri, str: uri.toString(true) })));
	}

	private async createUriListSnippet(docUri: ProX-Code.Uri, uriList: UriList): Promise<{ readonly snippet: ProX-Code.SnippetString; readonly label: string } | undefined> {
		if (!uriList.entries.length) {
			return;
		}

		const snippet = new ProX-Code.SnippetString();
		for (let i = 0; i < uriList.entries.length; i++) {
			const uri = uriList.entries[i];
			const relativePath = getRelativePath(getDocumentDir(docUri), uri.uri);
			const urlText = relativePath ?? uri.str;

			snippet.appendText(`url(${urlText})`);
			if (i !== uriList.entries.length - 1) {
				snippet.appendText(' ');
			}
		}

		return {
			snippet,
			label: uriList.entries.length > 1
				? ProX-Code.l10n.t('Insert url() Functions')
				: ProX-Code.l10n.t('Insert url() Function')
		};
	}

	private pasteAsCssUrlByDefault(document: ProX-Code.TextDocument, position: ProX-Code.Position): boolean {
		const regex = /url\(.+?\)/gi;
		for (const match of Array.from(document.lineAt(position.line).text.matchAll(regex))) {
			if (position.character > match.index && position.character < match.index + match[0].length) {
				return false;
			}
		}
		return true;
	}
}

function getRelativePath(fromFile: ProX-Code.Uri | undefined, toFile: ProX-Code.Uri): string | undefined {
	if (fromFile && fromFile.scheme === toFile.scheme && fromFile.authority === toFile.authority) {
		if (toFile.scheme === Schemes.file) {
			// On windows, we must use the native `path.relative` to generate the relative path
			// so that drive-letters are resolved cast insensitively. However we then want to
			// convert back to a posix path to insert in to the document
			const relativePath = path.relative(fromFile.fsPath, toFile.fsPath);
			return path.posix.normalize(relativePath.split(path.sep).join(path.posix.sep));
		}

		return path.posix.relative(fromFile.path, toFile.path);
	}

	return undefined;
}

export function registerDropOrPasteResourceSupport(selector: ProX-Code.DocumentSelector): ProX-Code.Disposable {
	const provider = new DropOrPasteResourceProvider();

	return ProX-Code.Disposable.from(
		ProX-Code.languages.registerDocumentDropEditProvider(selector, provider, {
			providedDropEditKinds: [provider.kind],
			dropMimeTypes: [
				Mimes.uriList,
				'files'
			]
		}),
		ProX-Code.languages.registerDocumentPasteEditProvider(selector, provider, {
			providedPasteEditKinds: [provider.kind],
			pasteMimeTypes: [
				Mimes.uriList,
				'files'
			]
		})
	);
}
