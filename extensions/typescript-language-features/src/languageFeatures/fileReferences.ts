/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Command, CommandManager } from '../commands/commandManager';
import { isSupportedLanguageMode } from '../configuration/languageIds';
import { API } from '../tsServer/api';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';


class FileReferencesCommand implements Command {

	public static readonly context = 'tsSupportsFileReferences';
	public static readonly minVersion = API.v420;

	public readonly id = 'typescript.findAllFileReferences';

	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	public async execute(resource?: ProX-Code.Uri) {
		if (this.client.apiVersion.lt(FileReferencesCommand.minVersion)) {
			ProX-Code.window.showErrorMessage(ProX-Code.l10n.t("Find file references failed. Requires TypeScript 4.2+."));
			return;
		}

		resource ??= ProX-Code.window.activeTextEditor?.document.uri;
		if (!resource) {
			ProX-Code.window.showErrorMessage(ProX-Code.l10n.t("Find file references failed. No resource provided."));
			return;
		}

		const document = await ProX-Code.workspace.openTextDocument(resource);
		if (!isSupportedLanguageMode(document)) {
			ProX-Code.window.showErrorMessage(ProX-Code.l10n.t("Find file references failed. Unsupported file type."));
			return;
		}

		const openedFiledPath = this.client.toOpenTsFilePath(document);
		if (!openedFiledPath) {
			ProX-Code.window.showErrorMessage(ProX-Code.l10n.t("Find file references failed. Unknown file type."));
			return;
		}

		await ProX-Code.window.withProgress({
			location: ProX-Code.ProgressLocation.Window,
			title: ProX-Code.l10n.t("Finding file references")
		}, async (_progress, token) => {

			const response = await this.client.execute('fileReferences', {
				file: openedFiledPath
			}, token);
			if (response.type !== 'response' || !response.body) {
				return;
			}

			const locations: ProX-Code.Location[] = response.body.refs.map(reference =>
				typeConverters.Location.fromTextSpan(this.client.toResource(reference.file), reference));

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


export function register(
	client: ITypeScriptServiceClient,
	commandManager: CommandManager
) {
	function updateContext() {
		ProX-Code.commands.executeCommand('setContext', FileReferencesCommand.context, client.apiVersion.gte(FileReferencesCommand.minVersion));
	}
	updateContext();

	commandManager.register(new FileReferencesCommand(client));
	return client.onTsServerStarted(() => updateContext());
}
