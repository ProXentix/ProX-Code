/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { IMdParser } from '../../markdownEngine';
import { coalesce } from '../../util/arrays';
import { getParentDocumentUri } from '../../util/document';
import { getMediaKindForMime, MediaKind, Mime, rootMediaMimesTypes } from '../../util/mimes';
import { Schemes } from '../../util/schemes';
import { UriList } from '../../util/uriList';
import { NewFilePathGenerator } from './newFilePathGenerator';
import { audioEditKind, baseLinkEditKind, createInsertUriListEdit, createUriListSnippet, DropOrPasteEdit, getSnippetLabelAndKind, imageEditKind, linkEditKind, videoEditKind } from './shared';
import { InsertMarkdownLink, shouldInsertMarkdownLinkByDefault } from './smartDropOrPaste';

enum CopyFilesSettings {
	Never = 'never',
	MediaFiles = 'mediaFiles',
}

/**
 * Provides support for pasting or dropping resources into markdown documents.
 *
 * This includes:
 *
 * - `text/uri-list` data in the data transfer.
 * - File object in the data transfer.
 * - Media data in the data transfer, such as `image/png`.
 */
class ResourcePasteOrDropProvider implements ProX-Code.DocumentPasteEditProvider, ProX-Code.DocumentDropEditProvider {

	public static readonly mimeTypes = [
		Mime.textUriList,
		'files',
		...Object.values(rootMediaMimesTypes).map(type => `${type}/*`),
	];

	private readonly _yieldTo = [
		ProX-Code.DocumentDropOrPasteEditKind.Text,
		ProX-Code.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link', 'image', 'attachment'), // Prefer notebook attachments
	];

	constructor(
		private readonly _parser: IMdParser,
	) { }

	public async provideDocumentDropEdits(
		document: ProX-Code.TextDocument,
		position: ProX-Code.Position,
		dataTransfer: ProX-Code.DataTransfer,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentDropEdit | undefined> {
		const edit = await this._createEdit(document, [new ProX-Code.Range(position, position)], dataTransfer, {
			insert: this._getEnabled(document, 'editor.drop.enabled'),
			copyIntoWorkspace: ProX-Code.workspace.getConfiguration('markdown', document).get<CopyFilesSettings>('editor.drop.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
		}, undefined, token);

		if (!edit || token.isCancellationRequested) {
			return;
		}

		const dropEdit = new ProX-Code.DocumentDropEdit(edit.snippet);
		dropEdit.title = edit.label;
		dropEdit.kind = edit.kind;
		dropEdit.additionalEdit = edit.additionalEdits;
		dropEdit.yieldTo = [...this._yieldTo, ...edit.yieldTo];
		return dropEdit;
	}

	public async provideDocumentPasteEdits(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		context: ProX-Code.DocumentPasteEditContext,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentPasteEdit[] | undefined> {
		const edit = await this._createEdit(document, ranges, dataTransfer, {
			insert: this._getEnabled(document, 'editor.paste.enabled'),
			copyIntoWorkspace: ProX-Code.workspace.getConfiguration('markdown', document).get<CopyFilesSettings>('editor.paste.copyIntoWorkspace', CopyFilesSettings.MediaFiles)
		}, context, token);

		if (!edit || token.isCancellationRequested) {
			return;
		}

		const pasteEdit = new ProX-Code.DocumentPasteEdit(edit.snippet, edit.label, edit.kind);
		pasteEdit.additionalEdit = edit.additionalEdits;
		pasteEdit.yieldTo = [...this._yieldTo, ...edit.yieldTo];
		return [pasteEdit];
	}

	private _getEnabled(document: ProX-Code.TextDocument, settingName: string): InsertMarkdownLink {
		const setting = ProX-Code.workspace.getConfiguration('markdown', document).get<boolean | InsertMarkdownLink>(settingName, true);
		// Convert old boolean values to new enum setting
		if (setting === false) {
			return InsertMarkdownLink.Never;
		} else if (setting === true) {
			return InsertMarkdownLink.Smart;
		} else {
			return setting;
		}
	}

	private async _createEdit(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		settings: Readonly<{
			insert: InsertMarkdownLink;
			copyIntoWorkspace: CopyFilesSettings;
		}>,
		context: ProX-Code.DocumentPasteEditContext | undefined,
		token: ProX-Code.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		if (settings.insert === InsertMarkdownLink.Never) {
			return;
		}

		let edit = await this._createEditForMediaFiles(document, dataTransfer, settings.copyIntoWorkspace, token);
		if (token.isCancellationRequested) {
			return;
		}

		if (!edit) {
			edit = await this._createEditFromUriListData(document, ranges, dataTransfer, context, token);
		}

		if (!edit || token.isCancellationRequested) {
			return;
		}

		if (!(await shouldInsertMarkdownLinkByDefault(this._parser, document, settings.insert, ranges, token))) {
			edit.yieldTo.push(ProX-Code.DocumentDropOrPasteEditKind.Empty.append('uri'));
		}

		return edit;
	}

	private async _createEditFromUriListData(
		document: ProX-Code.TextDocument,
		ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		context: ProX-Code.DocumentPasteEditContext | undefined,
		token: ProX-Code.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		const uriListData = await dataTransfer.get(Mime.textUriList)?.asString();
		if (!uriListData || token.isCancellationRequested) {
			return;
		}

		const uriList = UriList.from(uriListData);
		if (!uriList.entries.length) {
			return;
		}

		// In some browsers, copying from the address bar sets both text/uri-list and text/plain.
		// Disable ourselves if there's also a text entry with the same http(s) uri as our list,
		// unless we are explicitly requested.
		if (
			uriList.entries.length === 1
			&& (uriList.entries[0].uri.scheme === Schemes.http || uriList.entries[0].uri.scheme === Schemes.https)
			&& !context?.only?.contains(baseLinkEditKind)
		) {
			const text = await dataTransfer.get(Mime.textPlain)?.asString();
			if (token.isCancellationRequested) {
				return;
			}

			if (text && textMatchesUriList(text, uriList)) {
				return;
			}
		}

		const edit = createInsertUriListEdit(document, ranges, uriList, { linkKindHint: context?.only });
		if (!edit) {
			return;
		}

		const additionalEdits = new ProX-Code.WorkspaceEdit();
		additionalEdits.set(document.uri, edit.edits);

		return {
			label: edit.label,
			kind: edit.kind,
			snippet: new ProX-Code.SnippetString(''),
			additionalEdits,
			yieldTo: []
		};
	}

	/**
	 * Create a new edit for media files in a data transfer.
	 *
	 * This tries copying files outside of the workspace into the workspace.
	 */
	private async _createEditForMediaFiles(
		document: ProX-Code.TextDocument,
		dataTransfer: ProX-Code.DataTransfer,
		copyIntoWorkspace: CopyFilesSettings,
		token: ProX-Code.CancellationToken,
	): Promise<DropOrPasteEdit | undefined> {
		if (copyIntoWorkspace !== CopyFilesSettings.MediaFiles || getParentDocumentUri(document.uri).scheme === Schemes.untitled) {
			return;
		}

		interface FileEntry {
			readonly uri: ProX-Code.Uri;
			readonly kind: MediaKind;
			readonly newFile?: { readonly contents: ProX-Code.DataTransferFile; readonly overwrite: boolean };
		}

		const pathGenerator = new NewFilePathGenerator();
		const fileEntries = coalesce(await Promise.all(Array.from(dataTransfer, async ([mime, item]): Promise<FileEntry | undefined> => {
			const mediaKind = getMediaKindForMime(mime);
			if (!mediaKind) {
				return;
			}

			const file = item?.asFile();
			if (!file) {
				return;
			}

			if (file.uri) {
				// If the file is already in a workspace, we don't want to create a copy of it
				const workspaceFolder = ProX-Code.workspace.getWorkspaceFolder(file.uri);
				if (workspaceFolder) {
					return { uri: file.uri, kind: mediaKind };
				}
			}

			const newFile = await pathGenerator.getNewFilePath(document, file, token);
			if (!newFile) {
				return;
			}
			return { uri: newFile.uri, kind: mediaKind, newFile: { contents: file, overwrite: newFile.overwrite } };
		})));
		if (!fileEntries.length) {
			return;
		}

		const snippet = createUriListSnippet(document.uri, fileEntries);
		if (!snippet) {
			return;
		}

		const additionalEdits = new ProX-Code.WorkspaceEdit();
		for (const entry of fileEntries) {
			if (entry.newFile) {
				additionalEdits.createFile(entry.uri, {
					contents: entry.newFile.contents,
					overwrite: entry.newFile.overwrite,
				});
			}
		}

		const { label, kind } = getSnippetLabelAndKind(snippet);
		return {
			snippet: snippet.snippet,
			label,
			kind,
			additionalEdits,
			yieldTo: [],
		};
	}
}

function textMatchesUriList(text: string, uriList: UriList): boolean {
	if (text === uriList.entries[0].str) {
		return true;
	}

	try {
		const uri = ProX-Code.Uri.parse(text);
		return uriList.entries.some(entry => entry.uri.toString() === uri.toString());
	} catch {
		return false;
	}
}

export function registerResourceDropOrPasteSupport(selector: ProX-Code.DocumentSelector, parser: IMdParser): ProX-Code.Disposable {
	const providedEditKinds = [
		baseLinkEditKind,
		linkEditKind,
		imageEditKind,
		audioEditKind,
		videoEditKind,
	];

	return ProX-Code.Disposable.from(
		ProX-Code.languages.registerDocumentPasteEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
			providedPasteEditKinds: providedEditKinds,
			pasteMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
		}),
		ProX-Code.languages.registerDocumentDropEditProvider(selector, new ResourcePasteOrDropProvider(parser), {
			providedDropEditKinds: providedEditKinds,
			dropMimeTypes: ResourcePasteOrDropProvider.mimeTypes,
		}),
	);
}
