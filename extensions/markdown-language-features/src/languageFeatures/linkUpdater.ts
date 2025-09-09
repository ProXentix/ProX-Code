/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as picomatch from 'picomatch';
import * as ProX-Code from 'ProX-Code';
import { TextDocumentEdit } from 'ProX-Code-languageclient';
import { MdLanguageClient } from '../client/client';
import { Delayer } from '../util/async';
import { noopToken } from '../util/cancellation';
import { Disposable } from '../util/dispose';
import { convertRange } from './fileReferences';


const settingNames = Object.freeze({
	enabled: 'updateLinksOnFileMove.enabled',
	include: 'updateLinksOnFileMove.include',
	enableForDirectories: 'updateLinksOnFileMove.enableForDirectories',
});

const enum UpdateLinksOnFileMoveSetting {
	Prompt = 'prompt',
	Always = 'always',
	Never = 'never',
}

interface RenameAction {
	readonly oldUri: ProX-Code.Uri;
	readonly newUri: ProX-Code.Uri;
}

class UpdateLinksOnFileRenameHandler extends Disposable {

	private readonly _delayer = new Delayer(50);
	private readonly _pendingRenames = new Set<RenameAction>();

	public constructor(
		private readonly _client: MdLanguageClient,
	) {
		super();

		this._register(ProX-Code.workspace.onDidRenameFiles(async (e) => {
			await Promise.all(e.files.map(async (rename) => {
				if (await this._shouldParticipateInLinkUpdate(rename.newUri)) {
					this._pendingRenames.add(rename);
				}
			}));

			if (this._pendingRenames.size) {
				this._delayer.trigger(() => {
					ProX-Code.window.withProgress({
						location: ProX-Code.ProgressLocation.Window,
						title: ProX-Code.l10n.t("Checking for Markdown links to update")
					}, () => this._flushRenames());
				});
			}
		}));
	}

	private async _flushRenames(): Promise<void> {
		const renames = Array.from(this._pendingRenames);
		this._pendingRenames.clear();

		const result = await this._getEditsForFileRename(renames, noopToken);

		if (result && result.edit.size) {
			if (await this._confirmActionWithUser(result.resourcesBeingRenamed)) {
				await ProX-Code.workspace.applyEdit(result.edit);
			}
		}
	}

	private async _confirmActionWithUser(newResources: readonly ProX-Code.Uri[]): Promise<boolean> {
		if (!newResources.length) {
			return false;
		}

		const config = ProX-Code.workspace.getConfiguration('markdown', newResources[0]);
		const setting = config.get<UpdateLinksOnFileMoveSetting>(settingNames.enabled);
		switch (setting) {
			case UpdateLinksOnFileMoveSetting.Prompt:
				return this._promptUser(newResources);
			case UpdateLinksOnFileMoveSetting.Always:
				return true;
			case UpdateLinksOnFileMoveSetting.Never:
			default:
				return false;
		}
	}
	private async _shouldParticipateInLinkUpdate(newUri: ProX-Code.Uri): Promise<boolean> {
		const config = ProX-Code.workspace.getConfiguration('markdown', newUri);
		const setting = config.get<UpdateLinksOnFileMoveSetting>(settingNames.enabled);
		if (setting === UpdateLinksOnFileMoveSetting.Never) {
			return false;
		}

		const externalGlob = config.get<string[]>(settingNames.include);
		if (externalGlob) {
			for (const glob of externalGlob) {
				if (picomatch.isMatch(newUri.fsPath, glob)) {
					return true;
				}
			}
		}

		const stat = await ProX-Code.workspace.fs.stat(newUri);
		if (stat.type === ProX-Code.FileType.Directory) {
			return config.get<boolean>(settingNames.enableForDirectories, true);
		}

		return false;
	}

	private async _promptUser(newResources: readonly ProX-Code.Uri[]): Promise<boolean> {
		if (!newResources.length) {
			return false;
		}

		const rejectItem: ProX-Code.MessageItem = {
			title: ProX-Code.l10n.t("No"),
			isCloseAffordance: true,
		};

		const acceptItem: ProX-Code.MessageItem = {
			title: ProX-Code.l10n.t("Yes"),
		};

		const alwaysItem: ProX-Code.MessageItem = {
			title: ProX-Code.l10n.t("Always"),
		};

		const neverItem: ProX-Code.MessageItem = {
			title: ProX-Code.l10n.t("Never"),
		};

		const choice = await ProX-Code.window.showInformationMessage(
			newResources.length === 1
				? ProX-Code.l10n.t("Update Markdown links for '{0}'?", path.basename(newResources[0].fsPath))
				: this._getConfirmMessage(ProX-Code.l10n.t("Update Markdown links for the following {0} files?", newResources.length), newResources), {
			modal: true,
		}, rejectItem, acceptItem, alwaysItem, neverItem);

		switch (choice) {
			case acceptItem: {
				return true;
			}
			case rejectItem: {
				return false;
			}
			case alwaysItem: {
				const config = ProX-Code.workspace.getConfiguration('markdown', newResources[0]);
				config.update(
					settingNames.enabled,
					UpdateLinksOnFileMoveSetting.Always,
					this._getConfigTargetScope(config, settingNames.enabled));
				return true;
			}
			case neverItem: {
				const config = ProX-Code.workspace.getConfiguration('markdown', newResources[0]);
				config.update(
					settingNames.enabled,
					UpdateLinksOnFileMoveSetting.Never,
					this._getConfigTargetScope(config, settingNames.enabled));
				return false;
			}
			default: {
				return false;
			}
		}
	}

	private async _getEditsForFileRename(renames: readonly RenameAction[], token: ProX-Code.CancellationToken): Promise<{ edit: ProX-Code.WorkspaceEdit; resourcesBeingRenamed: ProX-Code.Uri[] } | undefined> {
		const result = await this._client.getEditForFileRenames(renames.map(rename => ({ oldUri: rename.oldUri.toString(), newUri: rename.newUri.toString() })), token);
		if (!result?.edit.documentChanges?.length) {
			return undefined;
		}

		const workspaceEdit = new ProX-Code.WorkspaceEdit();

		for (const change of result.edit.documentChanges as TextDocumentEdit[]) {
			const uri = ProX-Code.Uri.parse(change.textDocument.uri);
			for (const edit of change.edits) {
				workspaceEdit.replace(uri, convertRange(edit.range), edit.newText);
			}
		}

		return {
			edit: workspaceEdit,
			resourcesBeingRenamed: result.participatingRenames.map(x => ProX-Code.Uri.parse(x.newUri)),
		};
	}

	private _getConfirmMessage(start: string, resourcesToConfirm: readonly ProX-Code.Uri[]): string {
		const MAX_CONFIRM_FILES = 10;

		const paths = [start];
		paths.push('');
		paths.push(...resourcesToConfirm.slice(0, MAX_CONFIRM_FILES).map(r => path.basename(r.fsPath)));

		if (resourcesToConfirm.length > MAX_CONFIRM_FILES) {
			if (resourcesToConfirm.length - MAX_CONFIRM_FILES === 1) {
				paths.push(ProX-Code.l10n.t("...1 additional file not shown"));
			} else {
				paths.push(ProX-Code.l10n.t("...{0} additional files not shown", resourcesToConfirm.length - MAX_CONFIRM_FILES));
			}
		}

		paths.push('');
		return paths.join('\n');
	}

	private _getConfigTargetScope(config: ProX-Code.WorkspaceConfiguration, settingsName: string): ProX-Code.ConfigurationTarget {
		const inspected = config.inspect(settingsName);
		if (inspected?.workspaceFolderValue) {
			return ProX-Code.ConfigurationTarget.WorkspaceFolder;
		}

		if (inspected?.workspaceValue) {
			return ProX-Code.ConfigurationTarget.Workspace;
		}

		return ProX-Code.ConfigurationTarget.Global;
	}
}

export function registerUpdateLinksOnRename(client: MdLanguageClient): ProX-Code.Disposable {
	return new UpdateLinksOnFileRenameHandler(client);
}
