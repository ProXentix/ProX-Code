/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { BaseLanguageClient, LanguageClientOptions, NotebookDocumentSyncRegistrationType, Range, TextEdit } from 'ProX-Code-languageclient';
import { IMdParser } from '../markdownEngine';
import { IDisposable } from '../util/dispose';
import { looksLikeMarkdownPath, markdownFileExtensions } from '../util/file';
import { FileWatcherManager } from './fileWatchingManager';
import { InMemoryDocument } from './inMemoryDocument';
import * as proto from './protocol';
import { VsCodeMdWorkspace } from './workspace';

export type LanguageClientConstructor = (name: string, description: string, clientOptions: LanguageClientOptions) => BaseLanguageClient;

export class MdLanguageClient implements IDisposable {

	constructor(
		private readonly _client: BaseLanguageClient,
		private readonly _workspace: VsCodeMdWorkspace,
	) { }

	dispose(): void {
		this._client.stop();
		this._workspace.dispose();
	}

	resolveLinkTarget(linkText: string, uri: ProX-Code.Uri): Promise<proto.ResolvedDocumentLinkTarget> {
		return this._client.sendRequest(proto.resolveLinkTarget, { linkText, uri: uri.toString() });
	}

	getEditForFileRenames(files: ReadonlyArray<{ oldUri: string; newUri: string }>, token: ProX-Code.CancellationToken) {
		return this._client.sendRequest(proto.getEditForFileRenames, files, token);
	}

	getReferencesToFileInWorkspace(resource: ProX-Code.Uri, token: ProX-Code.CancellationToken) {
		return this._client.sendRequest(proto.getReferencesToFileInWorkspace, { uri: resource.toString() }, token);
	}

	prepareUpdatePastedLinks(doc: ProX-Code.Uri, ranges: readonly ProX-Code.Range[], token: ProX-Code.CancellationToken) {
		return this._client.sendRequest(proto.prepareUpdatePastedLinks, {
			uri: doc.toString(),
			ranges: ranges.map(range => Range.create(range.start.line, range.start.character, range.end.line, range.end.character)),
		}, token);
	}

	getUpdatePastedLinksEdit(pastingIntoDoc: ProX-Code.Uri, edits: readonly ProX-Code.TextEdit[], metadata: string, token: ProX-Code.CancellationToken) {
		return this._client.sendRequest(proto.getUpdatePastedLinksEdit, {
			metadata,
			pasteIntoDoc: pastingIntoDoc.toString(),
			edits: edits.map(edit => TextEdit.replace(edit.range, edit.newText)),
		}, token);
	}
}

export async function startClient(factory: LanguageClientConstructor, parser: IMdParser): Promise<MdLanguageClient> {

	const mdFileGlob = `**/*.{${markdownFileExtensions.join(',')}}`;

	const clientOptions: LanguageClientOptions = {
		documentSelector: [{ language: 'markdown' }],
		synchronize: {
			configurationSection: ['markdown'],
			fileEvents: ProX-Code.workspace.createFileSystemWatcher(mdFileGlob),
		},
		initializationOptions: {
			markdownFileExtensions,
			i10lLocation: ProX-Code.l10n.uri?.toJSON(),
		},
		diagnosticPullOptions: {
			onChange: true,
			onTabs: true,
			match(_documentSelector, resource) {
				return looksLikeMarkdownPath(resource);
			},
		},
		markdown: {
			supportHtml: true,
		}
	};

	const client = factory('markdown', ProX-Code.l10n.t("Markdown Language Server"), clientOptions);

	client.registerProposedFeatures();

	const notebookFeature = client.getFeature(NotebookDocumentSyncRegistrationType.method);
	if (notebookFeature !== undefined) {
		notebookFeature.register({
			id: String(Date.now()),
			registerOptions: {
				notebookSelector: [{
					notebook: '*',
					cells: [{ language: 'markdown' }]
				}]
			}
		});
	}

	const workspace = new VsCodeMdWorkspace();

	client.onRequest(proto.parse, async (e) => {
		const uri = ProX-Code.Uri.parse(e.uri);
		if (typeof e.text === 'string') {
			return parser.tokenize(new InMemoryDocument(uri, e.text, -1));
		} else {
			const doc = await workspace.getOrLoadMarkdownDocument(uri);
			if (doc) {
				return parser.tokenize(doc);
			} else {
				return [];
			}
		}
	});

	client.onRequest(proto.fs_readFile, async (e): Promise<number[]> => {
		const uri = ProX-Code.Uri.parse(e.uri);
		return Array.from(await ProX-Code.workspace.fs.readFile(uri));
	});

	client.onRequest(proto.fs_stat, async (e): Promise<{ isDirectory: boolean } | undefined> => {
		const uri = ProX-Code.Uri.parse(e.uri);
		try {
			const stat = await ProX-Code.workspace.fs.stat(uri);
			return { isDirectory: stat.type === ProX-Code.FileType.Directory };
		} catch {
			return undefined;
		}
	});

	client.onRequest(proto.fs_readDirectory, async (e): Promise<[string, { isDirectory: boolean }][]> => {
		const uri = ProX-Code.Uri.parse(e.uri);
		const result = await ProX-Code.workspace.fs.readDirectory(uri);
		return result.map(([name, type]) => [name, { isDirectory: type === ProX-Code.FileType.Directory }]);
	});

	client.onRequest(proto.findMarkdownFilesInWorkspace, async (): Promise<string[]> => {
		return (await ProX-Code.workspace.findFiles(mdFileGlob, '**/node_modules/**')).map(x => x.toString());
	});

	const watchers = new FileWatcherManager();

	client.onRequest(proto.fs_watcher_create, async (params): Promise<void> => {
		const id = params.id;
		const uri = ProX-Code.Uri.parse(params.uri);

		const sendWatcherChange = (kind: 'create' | 'change' | 'delete') => {
			client.sendRequest(proto.fs_watcher_onChange, { id, uri: params.uri, kind });
		};

		watchers.create(id, uri, params.watchParentDirs, {
			create: params.options.ignoreCreate ? undefined : () => sendWatcherChange('create'),
			change: params.options.ignoreChange ? undefined : () => sendWatcherChange('change'),
			delete: params.options.ignoreDelete ? undefined : () => sendWatcherChange('delete'),
		});
	});

	client.onRequest(proto.fs_watcher_delete, async (params): Promise<void> => {
		watchers.delete(params.id);
	});

	ProX-Code.commands.registerCommand('ProX-CodeMarkdownLanguageservice.open', (uri, args) => {
		return ProX-Code.commands.executeCommand('ProX-Code.open', uri, args);
	});

	ProX-Code.commands.registerCommand('ProX-CodeMarkdownLanguageservice.rename', (uri, pos) => {
		return ProX-Code.commands.executeCommand('editor.action.rename', [ProX-Code.Uri.from(uri), new ProX-Code.Position(pos.line, pos.character)]);
	});

	await client.start();

	return new MdLanguageClient(client, workspace);
}
