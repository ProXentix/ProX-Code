/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { MdLanguageClient } from '../client/client';
import * as proto from '../client/protocol';

enum OpenMarkdownLinks {
	beside = 'beside',
	currentGroup = 'currentGroup',
}

export class MdLinkOpener {

	constructor(
		private readonly _client: MdLanguageClient,
	) { }

	public async resolveDocumentLink(linkText: string, fromResource: ProX-Code.Uri): Promise<proto.ResolvedDocumentLinkTarget> {
		return this._client.resolveLinkTarget(linkText, fromResource);
	}

	public async openDocumentLink(linkText: string, fromResource: ProX-Code.Uri, viewColumn?: ProX-Code.ViewColumn): Promise<void> {
		const resolved = await this._client.resolveLinkTarget(linkText, fromResource);
		if (!resolved) {
			return;
		}

		const uri = ProX-Code.Uri.from(resolved.uri);
		switch (resolved.kind) {
			case 'external':
				return ProX-Code.commands.executeCommand('ProX-Code.open', uri);

			case 'folder':
				return ProX-Code.commands.executeCommand('revealInExplorer', uri);

			case 'file': {
				// If no explicit viewColumn is given, check if the editor is already open in a tab
				if (typeof viewColumn === 'undefined') {
					for (const tab of ProX-Code.window.tabGroups.all.flatMap(x => x.tabs)) {
						if (tab.input instanceof ProX-Code.TabInputText) {
							if (tab.input.uri.fsPath === uri.fsPath) {
								viewColumn = tab.group.viewColumn;
								break;
							}
						}
					}
				}

				return ProX-Code.commands.executeCommand('ProX-Code.open', uri, {
					selection: resolved.position ? new ProX-Code.Range(resolved.position.line, resolved.position.character, resolved.position.line, resolved.position.character) : undefined,
					viewColumn: viewColumn ?? getViewColumn(fromResource),
				} satisfies ProX-Code.TextDocumentShowOptions);
			}
		}
	}
}

function getViewColumn(resource: ProX-Code.Uri): ProX-Code.ViewColumn {
	const config = ProX-Code.workspace.getConfiguration('markdown', resource);
	const openLinks = config.get<OpenMarkdownLinks>('links.openLocation', OpenMarkdownLinks.currentGroup);
	switch (openLinks) {
		case OpenMarkdownLinks.beside:
			return ProX-Code.ViewColumn.Beside;
		case OpenMarkdownLinks.currentGroup:
		default:
			return ProX-Code.ViewColumn.Active;
	}
}

