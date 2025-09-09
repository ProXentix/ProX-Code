/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export interface TSConfig {
	readonly uri: ProX-Code.Uri;
	readonly fsPath: string;
	readonly posixPath: string;
	readonly workspaceFolder?: ProX-Code.WorkspaceFolder;
}

export class TsConfigProvider {
	public async getConfigsForWorkspace(token: ProX-Code.CancellationToken): Promise<Iterable<TSConfig>> {
		if (!ProX-Code.workspace.workspaceFolders) {
			return [];
		}

		const configs = new Map<string, TSConfig>();
		for (const config of await this.findConfigFiles(token)) {
			const root = ProX-Code.workspace.getWorkspaceFolder(config);
			if (root) {
				configs.set(config.fsPath, {
					uri: config,
					fsPath: config.fsPath,
					posixPath: config.path,
					workspaceFolder: root
				});
			}
		}
		return configs.values();
	}

	private async findConfigFiles(token: ProX-Code.CancellationToken): Promise<ProX-Code.Uri[]> {
		return await ProX-Code.workspace.findFiles('**/tsconfig*.json', '**/{node_modules,.*}/**', undefined, token);
	}
}
