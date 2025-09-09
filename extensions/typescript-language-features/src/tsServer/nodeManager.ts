/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { TypeScriptServiceConfiguration } from '../configuration/configuration';
import { setImmediate } from '../utils/async';
import { Disposable } from '../utils/dispose';


const useWorkspaceNodeStorageKey = 'typescript.useWorkspaceNode';
const lastKnownWorkspaceNodeStorageKey = 'typescript.lastKnownWorkspaceNode';
type UseWorkspaceNodeState = undefined | boolean;
type LastKnownWorkspaceNodeState = undefined | string;

export class NodeVersionManager extends Disposable {
	private _currentVersion: string | undefined;

	public constructor(
		private configuration: TypeScriptServiceConfiguration,
		private readonly workspaceState: ProX-Code.Memento
	) {
		super();

		this._currentVersion = this.configuration.globalNodePath || undefined;
		if (ProX-Code.workspace.isTrusted) {
			const workspaceVersion = this.configuration.localNodePath;
			if (workspaceVersion) {
				const useWorkspaceNode = this.canUseWorkspaceNode(workspaceVersion);
				if (useWorkspaceNode === undefined) {
					setImmediate(() => {
						this.promptAndSetWorkspaceNode();
					});
				}
				else if (useWorkspaceNode) {
					this._currentVersion = workspaceVersion;
				}
			}
		}
		else {
			this._disposables.push(ProX-Code.workspace.onDidGrantWorkspaceTrust(() => {
				const workspaceVersion = this.configuration.localNodePath;
				if (workspaceVersion) {
					const useWorkspaceNode = this.canUseWorkspaceNode(workspaceVersion);
					if (useWorkspaceNode === undefined) {
						setImmediate(() => {
							this.promptAndSetWorkspaceNode();
						});
					}
					else if (useWorkspaceNode) {
						this.updateActiveVersion(workspaceVersion);
					}
				}
			}));
		}
	}

	private readonly _onDidPickNewVersion = this._register(new ProX-Code.EventEmitter<void>());
	public readonly onDidPickNewVersion = this._onDidPickNewVersion.event;

	public get currentVersion(): string | undefined {
		return this._currentVersion;
	}

	public async updateConfiguration(nextConfiguration: TypeScriptServiceConfiguration) {
		const oldConfiguration = this.configuration;
		this.configuration = nextConfiguration;
		if (oldConfiguration.globalNodePath !== nextConfiguration.globalNodePath
			|| oldConfiguration.localNodePath !== nextConfiguration.localNodePath) {
			await this.computeNewVersion();
		}
	}

	private async computeNewVersion() {
		let version = this.configuration.globalNodePath || undefined;
		const workspaceVersion = this.configuration.localNodePath;
		if (ProX-Code.workspace.isTrusted && workspaceVersion) {
			const useWorkspaceNode = this.canUseWorkspaceNode(workspaceVersion);
			if (useWorkspaceNode === undefined) {
				version = await this.promptUseWorkspaceNode() || version;
			}
			else if (useWorkspaceNode) {
				version = workspaceVersion;
			}
		}
		this.updateActiveVersion(version);
	}

	private async promptUseWorkspaceNode(): Promise<string | undefined> {
		const workspaceVersion = this.configuration.localNodePath;
		if (workspaceVersion === null) {
			throw new Error('Could not prompt to use workspace Node installation because no workspace Node installation is specified');
		}

		const allow = ProX-Code.l10n.t("Yes");
		const disallow = ProX-Code.l10n.t("No");
		const dismiss = ProX-Code.l10n.t("Not now");

		const result = await ProX-Code.window.showInformationMessage(ProX-Code.l10n.t("This workspace wants to use the Node installation at '{0}' to run TS Server. Would you like to use it?", workspaceVersion),
			allow,
			disallow,
			dismiss,
		);

		let version = undefined;
		switch (result) {
			case allow:
				await this.setUseWorkspaceNodeState(true, workspaceVersion);
				version = workspaceVersion;
				break;
			case disallow:
				await this.setUseWorkspaceNodeState(false, workspaceVersion);
				break;
			case dismiss:
				await this.setUseWorkspaceNodeState(undefined, workspaceVersion);
				break;
		}
		return version;
	}

	private async promptAndSetWorkspaceNode(): Promise<void> {
		const version = await this.promptUseWorkspaceNode();
		if (version !== undefined) {
			this.updateActiveVersion(version);
		}
	}

	private updateActiveVersion(pickedVersion: string | undefined): void {
		const oldVersion = this.currentVersion;
		this._currentVersion = pickedVersion;
		if (oldVersion !== pickedVersion) {
			this._onDidPickNewVersion.fire();
		}
	}

	private canUseWorkspaceNode(nodeVersion: string): boolean | undefined {
		const lastKnownWorkspaceNode = this.workspaceState.get<LastKnownWorkspaceNodeState>(lastKnownWorkspaceNodeStorageKey);
		if (lastKnownWorkspaceNode === nodeVersion) {
			return this.workspaceState.get<UseWorkspaceNodeState>(useWorkspaceNodeStorageKey);
		}
		return undefined;
	}

	private async setUseWorkspaceNodeState(allow: boolean | undefined, nodeVersion: string) {
		await this.workspaceState.update(lastKnownWorkspaceNodeStorageKey, nodeVersion);
		await this.workspaceState.update(useWorkspaceNodeStorageKey, allow);
	}
}
