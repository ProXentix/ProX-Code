/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SymbolsTree } from '../tree';
import { FileItem, ReferenceItem, ReferencesModel, ReferencesTreeInput } from './model';

export function register(tree: SymbolsTree, context: ProX-Code.ExtensionContext): void {

	function findLocations(title: string, command: string) {
		if (ProX-Code.window.activeTextEditor) {
			const input = new ReferencesTreeInput(title, new ProX-Code.Location(ProX-Code.window.activeTextEditor.document.uri, ProX-Code.window.activeTextEditor.selection.active), command);
			tree.setInput(input);
		}
	}

	context.subscriptions.push(
		ProX-Code.commands.registerCommand('references-view.findReferences', () => findLocations('References', 'ProX-Code.executeReferenceProvider')),
		ProX-Code.commands.registerCommand('references-view.findImplementations', () => findLocations('Implementations', 'ProX-Code.executeImplementationProvider')),
		// --- legacy name
		ProX-Code.commands.registerCommand('references-view.find', (...args: any[]) => ProX-Code.commands.executeCommand('references-view.findReferences', ...args)),
		ProX-Code.commands.registerCommand('references-view.removeReferenceItem', removeReferenceItem),
		ProX-Code.commands.registerCommand('references-view.copy', copyCommand),
		ProX-Code.commands.registerCommand('references-view.copyAll', copyAllCommand),
		ProX-Code.commands.registerCommand('references-view.copyPath', copyPathCommand),
	);


	// --- references.preferredLocation setting

	let showReferencesDisposable: ProX-Code.Disposable | undefined;
	const config = 'references.preferredLocation';
	function updateShowReferences(event?: ProX-Code.ConfigurationChangeEvent) {
		if (event && !event.affectsConfiguration(config)) {
			return;
		}
		const value = ProX-Code.workspace.getConfiguration().get<string>(config);

		showReferencesDisposable?.dispose();
		showReferencesDisposable = undefined;

		if (value === 'view') {
			showReferencesDisposable = ProX-Code.commands.registerCommand('editor.action.showReferences', async (uri: ProX-Code.Uri, position: ProX-Code.Position, locations: ProX-Code.Location[]) => {
				const input = new ReferencesTreeInput(ProX-Code.l10n.t('References'), new ProX-Code.Location(uri, position), 'ProX-Code.executeReferenceProvider', locations);
				tree.setInput(input);
			});
		}
	}
	context.subscriptions.push(ProX-Code.workspace.onDidChangeConfiguration(updateShowReferences));
	context.subscriptions.push({ dispose: () => showReferencesDisposable?.dispose() });
	updateShowReferences();
}

const copyAllCommand = async (item: ReferenceItem | FileItem | unknown) => {
	if (item instanceof ReferenceItem) {
		copyCommand(item.file.model);
	} else if (item instanceof FileItem) {
		copyCommand(item.model);
	}
};

function removeReferenceItem(item: FileItem | ReferenceItem | unknown) {
	if (item instanceof FileItem) {
		item.remove();
	} else if (item instanceof ReferenceItem) {
		item.remove();
	}
}


async function copyCommand(item: ReferencesModel | ReferenceItem | FileItem | unknown) {
	let val: string | undefined;
	if (item instanceof ReferencesModel) {
		val = await item.asCopyText();
	} else if (item instanceof ReferenceItem) {
		val = await item.asCopyText();
	} else if (item instanceof FileItem) {
		val = await item.asCopyText();
	}
	if (val) {
		await ProX-Code.env.clipboard.writeText(val);
	}
}

async function copyPathCommand(item: FileItem | unknown) {
	if (item instanceof FileItem) {
		if (item.uri.scheme === 'file') {
			ProX-Code.env.clipboard.writeText(item.uri.fsPath);
		} else {
			ProX-Code.env.clipboard.writeText(item.uri.toString(true));
		}
	}
}
