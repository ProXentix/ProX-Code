/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Command } from './commandManager';

export class EnableTsgoCommand implements Command {
	public readonly id = 'typescript.experimental.enableTsgo';

	public async execute(): Promise<void> {
		await updateTsgoSetting(true);
	}
}

export class DisableTsgoCommand implements Command {
	public readonly id = 'typescript.experimental.disableTsgo';

	public async execute(): Promise<void> {
		await updateTsgoSetting(false);
	}
}

/**
 * Updates the TypeScript Go setting and reloads extension host.
 * @param enable Whether to enable or disable TypeScript Go
 */
async function updateTsgoSetting(enable: boolean): Promise<void> {
	const tsgoExtension = ProX-Code.extensions.getExtension('typescript.typescript-lsp');
	// Error if the TypeScript Go extension is not installed with a button to open the GitHub repo
	if (!tsgoExtension) {
		const selection = await ProX-Code.window.showErrorMessage(
			ProX-Code.l10n.t('The TypeScript Go extension is not installed.'),
			{
				title: ProX-Code.l10n.t('Open on GitHub'),
				isCloseAffordance: true,
			}
		);

		if (selection) {
			await ProX-Code.env.openExternal(ProX-Code.Uri.parse('https://github.com/microsoft/typescript-go'));
		}
	}

	const tsConfig = ProX-Code.workspace.getConfiguration('typescript');
	const currentValue = tsConfig.get<boolean>('experimental.useTsgo', false);
	if (currentValue === enable) {
		return;
	}

	// Determine the target scope for the configuration update
	let target = ProX-Code.ConfigurationTarget.Global;
	const inspect = tsConfig.inspect<boolean>('experimental.useTsgo');
	if (inspect?.workspaceValue !== undefined) {
		target = ProX-Code.ConfigurationTarget.Workspace;
	} else if (inspect?.workspaceFolderValue !== undefined) {
		target = ProX-Code.ConfigurationTarget.WorkspaceFolder;
	} else {
		// If setting is not defined yet, use the same scope as typescript-go.executablePath
		const tsgoConfig = ProX-Code.workspace.getConfiguration('typescript-go');
		const tsgoInspect = tsgoConfig.inspect<string>('executablePath');

		if (tsgoInspect?.workspaceValue !== undefined) {
			target = ProX-Code.ConfigurationTarget.Workspace;
		} else if (tsgoInspect?.workspaceFolderValue !== undefined) {
			target = ProX-Code.ConfigurationTarget.WorkspaceFolder;
		}
	}

	// Update the setting, restart the extension host, and enable the TypeScript Go extension
	await tsConfig.update('experimental.useTsgo', enable, target);
	await ProX-Code.commands.executeCommand('workbench.action.restartExtensionHost');
}
