/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import type * as lsp from 'ProX-Code-languageserver-types';
import { MdLanguageClient } from '../client/client';
import { Command, CommandManager } from '../commandManager';


export class FindFileReferencesCommand implements Command {

	public readonly id = 'markdown.findAllFileReferences';

	constructor(
		private readonly _client: MdLanguageClient,
	) { }

	public async execute(resource?: ProX-Code.Uri) {
		resource ??= ProX-Code.window.activeTextEditor?.document.uri;
		if (!resource) {
			ProX-Code.window.showErrorMessage(ProX-Code.l10n.t("Find file references failed. No resource provided."));
			return;
		}

		await ProX-Code.window.withProgress({
			location: ProX-Code.ProgressLocation.Window,
			title: ProX-Code.l10n.t("Finding file references")
		}, async (_progress, token) => {
			const locations = (await this._client.getReferencesToFileInWorkspace(resource, token)).map(loc => {
				return new ProX-Code.Location(ProX-Code.Uri.parse(loc.uri), convertRange(loc.range));
			});

			const config = ProX-Code.workspace.getConfiguration('references');
			const existingSetting = config.inspect<string>('preferredLocation');

			await config.update('preferredLocation', 'view');
			try {
				await ProX-Code.commands.executeCommand('editor.action.showReferences', resource, new ProX-Code.Position(0, 0), locations);
			} finally {
				await config.update('preferredLocation', existingSetting?.workspaceFolderValue ?? existingSetting?.workspaceValue);
			}
		});
	}
}

export function convertRange(range: lsp.Range): ProX-Code.Range {
	return new ProX-Code.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

export function registerFindFileReferenceSupport(
	commandManager: CommandManager,
	client: MdLanguageClient,
): ProX-Code.Disposable {
	return commandManager.register(new FindFileReferencesCommand(client));
}
