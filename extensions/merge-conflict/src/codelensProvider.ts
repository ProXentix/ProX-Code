/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import * as interfaces from './interfaces';

export default class MergeConflictCodeLensProvider implements ProX-Code.CodeLensProvider, ProX-Code.Disposable {
	private codeLensRegistrationHandle?: ProX-Code.Disposable | null;
	private config?: interfaces.IExtensionConfiguration;
	private tracker: interfaces.IDocumentMergeConflictTracker;

	constructor(trackerService: interfaces.IDocumentMergeConflictTrackerService) {
		this.tracker = trackerService.createTracker('codelens');
	}

	begin(config: interfaces.IExtensionConfiguration) {
		this.config = config;

		if (this.config.enableCodeLens) {
			this.registerCodeLensProvider();
		}
	}

	configurationUpdated(updatedConfig: interfaces.IExtensionConfiguration) {

		if (updatedConfig.enableCodeLens === false && this.codeLensRegistrationHandle) {
			this.codeLensRegistrationHandle.dispose();
			this.codeLensRegistrationHandle = null;
		}
		else if (updatedConfig.enableCodeLens === true && !this.codeLensRegistrationHandle) {
			this.registerCodeLensProvider();
		}

		this.config = updatedConfig;
	}


	dispose() {
		if (this.codeLensRegistrationHandle) {
			this.codeLensRegistrationHandle.dispose();
			this.codeLensRegistrationHandle = null;
		}
	}

	async provideCodeLenses(document: ProX-Code.TextDocument, _token: ProX-Code.CancellationToken): Promise<ProX-Code.CodeLens[] | null> {

		if (!this.config || !this.config.enableCodeLens) {
			return null;
		}

		const conflicts = await this.tracker.getConflicts(document);
		const conflictsCount = conflicts?.length ?? 0;
		ProX-Code.commands.executeCommand('setContext', 'mergeConflictsCount', conflictsCount);

		if (!conflictsCount) {
			return null;
		}

		const items: ProX-Code.CodeLens[] = [];

		conflicts.forEach(conflict => {
			const acceptCurrentCommand: ProX-Code.Command = {
				command: 'merge-conflict.accept.current',
				title: ProX-Code.l10n.t("Accept Current Change"),
				arguments: ['known-conflict', conflict]
			};

			const acceptIncomingCommand: ProX-Code.Command = {
				command: 'merge-conflict.accept.incoming',
				title: ProX-Code.l10n.t("Accept Incoming Change"),
				arguments: ['known-conflict', conflict]
			};

			const acceptBothCommand: ProX-Code.Command = {
				command: 'merge-conflict.accept.both',
				title: ProX-Code.l10n.t("Accept Both Changes"),
				arguments: ['known-conflict', conflict]
			};

			const diffCommand: ProX-Code.Command = {
				command: 'merge-conflict.compare',
				title: ProX-Code.l10n.t("Compare Changes"),
				arguments: [conflict]
			};

			const range = document.lineAt(conflict.range.start.line).range;
			items.push(
				new ProX-Code.CodeLens(range, acceptCurrentCommand),
				new ProX-Code.CodeLens(range, acceptIncomingCommand),
				new ProX-Code.CodeLens(range, acceptBothCommand),
				new ProX-Code.CodeLens(range, diffCommand)
			);
		});

		return items;
	}

	private registerCodeLensProvider() {
		this.codeLensRegistrationHandle = ProX-Code.languages.registerCodeLensProvider([
			{ scheme: 'file' },
			{ scheme: 'ProX-Code-vfs' },
			{ scheme: 'untitled' },
			{ scheme: 'ProX-Code-userdata' },
		], this);
	}
}
