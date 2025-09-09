/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { JUPYTER_NOTEBOOK_MARKDOWN_SELECTOR } from './constants';
import { basename, extname } from 'path';

enum MimeType {
	bmp = 'image/bmp',
	gif = 'image/gif',
	ico = 'image/ico',
	jpeg = 'image/jpeg',
	png = 'image/png',
	tiff = 'image/tiff',
	webp = 'image/webp',
	plain = 'text/plain',
	uriList = 'text/uri-list',
}

const imageMimeTypes: ReadonlySet<string> = new Set<string>([
	MimeType.bmp,
	MimeType.gif,
	MimeType.ico,
	MimeType.jpeg,
	MimeType.png,
	MimeType.tiff,
	MimeType.webp,
]);

const imageExtToMime: ReadonlyMap<string, string> = new Map<string, string>([
	['.bmp', MimeType.bmp],
	['.gif', MimeType.gif],
	['.ico', MimeType.ico],
	['.jpe', MimeType.jpeg],
	['.jpeg', MimeType.jpeg],
	['.jpg', MimeType.jpeg],
	['.png', MimeType.png],
	['.tif', MimeType.tiff],
	['.tiff', MimeType.tiff],
	['.webp', MimeType.webp],
]);

function getImageMimeType(uri: ProX-Code.Uri): string | undefined {
	return imageExtToMime.get(extname(uri.fsPath).toLowerCase());
}

class DropOrPasteEditProvider implements ProX-Code.DocumentPasteEditProvider, ProX-Code.DocumentDropEditProvider {

	public static readonly kind = ProX-Code.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link', 'image', 'attachment');

	async provideDocumentPasteEdits(
		document: ProX-Code.TextDocument,
		_ranges: readonly ProX-Code.Range[],
		dataTransfer: ProX-Code.DataTransfer,
		_context: ProX-Code.DocumentPasteEditContext,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentPasteEdit[] | undefined> {
		const enabled = ProX-Code.workspace.getConfiguration('ipynb', document).get('pasteImagesAsAttachments.enabled', true);
		if (!enabled) {
			return;
		}

		const insert = await this.createInsertImageAttachmentEdit(document, dataTransfer, token);
		if (!insert) {
			return;
		}

		const pasteEdit = new ProX-Code.DocumentPasteEdit(insert.insertText, ProX-Code.l10n.t('Insert Image as Attachment'), DropOrPasteEditProvider.kind);
		pasteEdit.yieldTo = [ProX-Code.DocumentDropOrPasteEditKind.Text];
		pasteEdit.additionalEdit = insert.additionalEdit;
		return [pasteEdit];
	}

	async provideDocumentDropEdits(
		document: ProX-Code.TextDocument,
		_position: ProX-Code.Position,
		dataTransfer: ProX-Code.DataTransfer,
		token: ProX-Code.CancellationToken,
	): Promise<ProX-Code.DocumentDropEdit | undefined> {
		const insert = await this.createInsertImageAttachmentEdit(document, dataTransfer, token);
		if (!insert) {
			return;
		}

		const dropEdit = new ProX-Code.DocumentDropEdit(insert.insertText);
		dropEdit.yieldTo = [ProX-Code.DocumentDropOrPasteEditKind.Text];
		dropEdit.additionalEdit = insert.additionalEdit;
		dropEdit.title = ProX-Code.l10n.t('Insert Image as Attachment');
		return dropEdit;
	}

	private async createInsertImageAttachmentEdit(
		document: ProX-Code.TextDocument,
		dataTransfer: ProX-Code.DataTransfer,
		token: ProX-Code.CancellationToken,
	): Promise<{ insertText: ProX-Code.SnippetString; additionalEdit: ProX-Code.WorkspaceEdit } | undefined> {
		const imageData = await getDroppedImageData(dataTransfer, token);
		if (!imageData.length || token.isCancellationRequested) {
			return;
		}

		const currentCell = getCellFromCellDocument(document);
		if (!currentCell) {
			return undefined;
		}

		// create updated metadata for cell (prep for WorkspaceEdit)
		const newAttachment = buildAttachment(currentCell, imageData);
		if (!newAttachment) {
			return;
		}

		// build edits
		const additionalEdit = new ProX-Code.WorkspaceEdit();
		const nbEdit = ProX-Code.NotebookEdit.updateCellMetadata(currentCell.index, newAttachment.metadata);
		const notebookUri = currentCell.notebook.uri;
		additionalEdit.set(notebookUri, [nbEdit]);

		// create a snippet for paste
		const insertText = new ProX-Code.SnippetString();
		newAttachment.filenames.forEach((filename, i) => {
			insertText.appendText('![');
			insertText.appendPlaceholder(`${filename}`);
			insertText.appendText(`](${/\s/.test(filename) ? `<attachment:${filename}>` : `attachment:${filename}`})`);
			if (i !== newAttachment.filenames.length - 1) {
				insertText.appendText(' ');
			}
		});

		return { insertText, additionalEdit };
	}
}

async function getDroppedImageData(
	dataTransfer: ProX-Code.DataTransfer,
	token: ProX-Code.CancellationToken,
): Promise<readonly ImageAttachmentData[]> {

	// Prefer using image data in the clipboard
	const files = coalesce(await Promise.all(Array.from(dataTransfer, async ([mimeType, item]): Promise<ImageAttachmentData | undefined> => {
		if (!imageMimeTypes.has(mimeType)) {
			return;
		}

		const file = item.asFile();
		if (!file) {
			return;
		}

		const data = await file.data();
		return { fileName: file.name, mimeType, data };
	})));
	if (files.length) {
		return files;
	}

	// Then fallback to image files in the uri-list
	const urlList = await dataTransfer.get('text/uri-list')?.asString();
	if (token.isCancellationRequested) {
		return [];
	}

	if (urlList) {
		const uris: ProX-Code.Uri[] = [];
		for (const resource of urlList.split(/\r?\n/g)) {
			try {
				uris.push(ProX-Code.Uri.parse(resource));
			} catch {
				// noop
			}
		}

		const entries = await Promise.all(uris.map(async (uri) => {
			const mimeType = getImageMimeType(uri);
			if (!mimeType) {
				return;
			}

			const data = await ProX-Code.workspace.fs.readFile(uri);
			return { fileName: basename(uri.fsPath), mimeType, data };
		}));

		return coalesce(entries);
	}

	return [];
}

function coalesce<T>(array: ReadonlyArray<T | undefined | null>): T[] {
	return <T[]>array.filter(e => !!e);
}

function getCellFromCellDocument(cellDocument: ProX-Code.TextDocument): ProX-Code.NotebookCell | undefined {
	for (const notebook of ProX-Code.workspace.notebookDocuments) {
		if (notebook.uri.path === cellDocument.uri.path) {
			for (const cell of notebook.getCells()) {
				if (cell.document === cellDocument) {
					return cell;
				}
			}
		}
	}
	return undefined;
}

/**
 *  Taken from https://github.com/microsoft/ProX-Code/blob/743b016722db90df977feecde0a4b3b4f58c2a4c/src/vs/base/common/buffer.ts#L350-L387
 */
function encodeBase64(buffer: Uint8Array, padded = true, urlSafe = false) {
	const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const base64UrlSafeAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

	const dictionary = urlSafe ? base64UrlSafeAlphabet : base64Alphabet;
	let output = '';

	const remainder = buffer.byteLength % 3;

	let i = 0;
	for (; i < buffer.byteLength - remainder; i += 3) {
		const a = buffer[i + 0];
		const b = buffer[i + 1];
		const c = buffer[i + 2];

		output += dictionary[a >>> 2];
		output += dictionary[(a << 4 | b >>> 4) & 0b111111];
		output += dictionary[(b << 2 | c >>> 6) & 0b111111];
		output += dictionary[c & 0b111111];
	}

	if (remainder === 1) {
		const a = buffer[i + 0];
		output += dictionary[a >>> 2];
		output += dictionary[(a << 4) & 0b111111];
		if (padded) { output += '=='; }
	} else if (remainder === 2) {
		const a = buffer[i + 0];
		const b = buffer[i + 1];
		output += dictionary[a >>> 2];
		output += dictionary[(a << 4 | b >>> 4) & 0b111111];
		output += dictionary[(b << 2) & 0b111111];
		if (padded) { output += '='; }
	}

	return output;
}


interface ImageAttachmentData {
	readonly fileName: string;
	readonly data: Uint8Array;
	readonly mimeType: string;
}

function buildAttachment(
	cell: ProX-Code.NotebookCell,
	attachments: readonly ImageAttachmentData[],
): { metadata: { [key: string]: any }; filenames: string[] } | undefined {
	const cellMetadata = { ...cell.metadata };
	const tempFilenames: string[] = [];
	if (!attachments.length) {
		return undefined;
	}

	if (!cellMetadata.attachments) {
		cellMetadata.attachments = {};
	}

	for (const attachment of attachments) {
		const b64 = encodeBase64(attachment.data);

		const fileExt = extname(attachment.fileName);
		const filenameWithoutExt = basename(attachment.fileName, fileExt);

		let tempFilename = filenameWithoutExt + fileExt;
		for (let appendValue = 2; tempFilename in cellMetadata.attachments; appendValue++) {
			const objEntries = Object.entries(cellMetadata.attachments[tempFilename]);
			if (objEntries.length) { // check that mime:b64 are present
				const [mime, attachmentb64] = objEntries[0];
				if (mime === attachment.mimeType && attachmentb64 === b64) { // checking if filename can be reused, based on comparison of image data
					break;
				} else {
					tempFilename = filenameWithoutExt.concat(`-${appendValue}`) + fileExt;
				}
			}
		}

		tempFilenames.push(tempFilename);
		cellMetadata.attachments[tempFilename] = { [attachment.mimeType]: b64 };
	}

	return {
		metadata: cellMetadata,
		filenames: tempFilenames,
	};
}

export function notebookImagePasteSetup(): ProX-Code.Disposable {
	const provider = new DropOrPasteEditProvider();
	return ProX-Code.Disposable.from(
		ProX-Code.languages.registerDocumentPasteEditProvider(JUPYTER_NOTEBOOK_MARKDOWN_SELECTOR, provider, {
			providedPasteEditKinds: [DropOrPasteEditProvider.kind],
			pasteMimeTypes: [
				MimeType.png,
				MimeType.uriList,
			],
		}),
		ProX-Code.languages.registerDocumentDropEditProvider(JUPYTER_NOTEBOOK_MARKDOWN_SELECTOR, provider, {
			providedDropEditKinds: [DropOrPasteEditProvider.kind],
			dropMimeTypes: [
				...Object.values(imageExtToMime),
				MimeType.uriList,
			],
		})
	);
}
