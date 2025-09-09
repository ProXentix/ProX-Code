/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { activate as keepNotebookModelStoreInSync } from './notebookModelStoreSync';
import { notebookImagePasteSetup } from './notebookImagePaste';
import { AttachmentCleaner } from './notebookAttachmentCleaner';
import { serializeNotebookToString } from './serializers';
import { defaultNotebookFormat } from './constants';

// From {nbformat.INotebookMetadata} in @jupyterlab/coreutils
type NotebookMetadata = {
	kernelspec?: {
		name: string;
		display_name: string;
		[propName: string]: unknown;
	};
	language_info?: {
		name: string;
		codemirror_mode?: string | {};
		file_extension?: string;
		mimetype?: string;
		pygments_lexer?: string;
		[propName: string]: unknown;
	};
	orig_nbformat?: number;
	[propName: string]: unknown;
};

type OptionsWithCellContentMetadata = ProX-Code.NotebookDocumentContentOptions & { cellContentMetadata: { attachments: boolean } };


export function activate(context: ProX-Code.ExtensionContext, serializer: ProX-Code.NotebookSerializer) {
	keepNotebookModelStoreInSync(context);
	const notebookSerializerOptions: OptionsWithCellContentMetadata = {
		transientOutputs: false,
		transientDocumentMetadata: {
			cells: true,
			indentAmount: true
		},
		transientCellMetadata: {
			breakpointMargin: true,
			id: false,
			metadata: false,
			attachments: false
		},
		cellContentMetadata: {
			attachments: true
		}
	};
	context.subscriptions.push(ProX-Code.workspace.registerNotebookSerializer('jupyter-notebook', serializer, notebookSerializerOptions));

	const interactiveSerializeOptions: OptionsWithCellContentMetadata = {
		transientOutputs: false,
		transientCellMetadata: {
			breakpointMargin: true,
			id: false,
			metadata: false,
			attachments: false
		},
		cellContentMetadata: {
			attachments: true
		}
	};
	context.subscriptions.push(ProX-Code.workspace.registerNotebookSerializer('interactive', serializer, interactiveSerializeOptions));

	ProX-Code.languages.registerCodeLensProvider({ pattern: '**/*.ipynb' }, {
		provideCodeLenses: (document) => {
			if (
				document.uri.scheme === 'ProX-Code-notebook-cell' ||
				document.uri.scheme === 'ProX-Code-notebook-cell-metadata' ||
				document.uri.scheme === 'ProX-Code-notebook-cell-output'
			) {
				return [];
			}
			const codelens = new ProX-Code.CodeLens(new ProX-Code.Range(0, 0, 0, 0), { title: 'Open in Notebook Editor', command: 'ipynb.openIpynbInNotebookEditor', arguments: [document.uri] });
			return [codelens];
		}
	});

	context.subscriptions.push(ProX-Code.commands.registerCommand('ipynb.newUntitledIpynb', async () => {
		const language = 'python';
		const cell = new ProX-Code.NotebookCellData(ProX-Code.NotebookCellKind.Code, '', language);
		const data = new ProX-Code.NotebookData([cell]);
		data.metadata = {
			cells: [],
			metadata: {},
			nbformat: defaultNotebookFormat.major,
			nbformat_minor: defaultNotebookFormat.minor,
		};
		const doc = await ProX-Code.workspace.openNotebookDocument('jupyter-notebook', data);
		await ProX-Code.window.showNotebookDocument(doc);
	}));

	context.subscriptions.push(ProX-Code.commands.registerCommand('ipynb.openIpynbInNotebookEditor', async (uri: ProX-Code.Uri) => {
		if (ProX-Code.window.activeTextEditor?.document.uri.toString() === uri.toString()) {
			await ProX-Code.commands.executeCommand('workbench.action.closeActiveEditor');
		}
		const document = await ProX-Code.workspace.openNotebookDocument(uri);
		await ProX-Code.window.showNotebookDocument(document);
	}));

	context.subscriptions.push(notebookImagePasteSetup());

	const enabled = ProX-Code.workspace.getConfiguration('ipynb').get('pasteImagesAsAttachments.enabled', false);
	if (enabled) {
		const cleaner = new AttachmentCleaner();
		context.subscriptions.push(cleaner);
	}

	return {
		get dropCustomMetadata() {
			return true;
		},
		exportNotebook: (notebook: ProX-Code.NotebookData): Promise<string> => {
			return Promise.resolve(serializeNotebookToString(notebook));
		},
		setNotebookMetadata: async (resource: ProX-Code.Uri, metadata: Partial<NotebookMetadata>): Promise<boolean> => {
			const document = ProX-Code.workspace.notebookDocuments.find(doc => doc.uri.toString() === resource.toString());
			if (!document) {
				return false;
			}

			const edit = new ProX-Code.WorkspaceEdit();
			edit.set(resource, [ProX-Code.NotebookEdit.updateNotebookMetadata({
				...document.metadata,
				metadata: {
					...(document.metadata.metadata ?? {}),
					...metadata
				} satisfies NotebookMetadata,
			})]);
			return ProX-Code.workspace.applyEdit(edit);
		},
	};
}

export function deactivate() { }
