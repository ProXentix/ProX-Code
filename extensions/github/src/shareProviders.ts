/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { API } from './typings/git.js';
import { getRepositoryFromUrl, repositoryHasGitHubRemote } from './util.js';
import { encodeURIComponentExceptSlashes, ensurePublished, getRepositoryForFile, notebookCellRangeString, rangeString } from './links.js';

export class VscodeDevShareProvider implements ProX-Code.ShareProvider, ProX-Code.Disposable {
	readonly id: string = 'copyVscodeDevLink';
	readonly label: string = ProX-Code.l10n.t('Copy ProX-Code.dev Link');
	readonly priority: number = 10;


	private _hasGitHubRepositories: boolean = false;
	private set hasGitHubRepositories(value: boolean) {
		ProX-Code.commands.executeCommand('setContext', 'github.hasGitHubRepo', value);
		this._hasGitHubRepositories = value;
		this.ensureShareProviderRegistration();
	}

	private shareProviderRegistration: ProX-Code.Disposable | undefined;
	private disposables: ProX-Code.Disposable[] = [];

	constructor(private readonly gitAPI: API) {
		this.initializeGitHubRepoContext();
	}

	dispose() {
		this.disposables.forEach(d => d.dispose());
	}

	private initializeGitHubRepoContext() {
		if (this.gitAPI.repositories.find(repo => repositoryHasGitHubRemote(repo))) {
			this.hasGitHubRepositories = true;
			ProX-Code.commands.executeCommand('setContext', 'github.hasGitHubRepo', true);
		} else {
			this.disposables.push(this.gitAPI.onDidOpenRepository(async e => {
				await e.status();
				if (repositoryHasGitHubRemote(e)) {
					ProX-Code.commands.executeCommand('setContext', 'github.hasGitHubRepo', true);
					this.hasGitHubRepositories = true;
				}
			}));
		}
		this.disposables.push(this.gitAPI.onDidCloseRepository(() => {
			if (!this.gitAPI.repositories.find(repo => repositoryHasGitHubRemote(repo))) {
				this.hasGitHubRepositories = false;
			}
		}));
	}

	private ensureShareProviderRegistration() {
		if (ProX-Code.env.appHost !== 'codespaces' && !this.shareProviderRegistration && this._hasGitHubRepositories) {
			const shareProviderRegistration = ProX-Code.window.registerShareProvider({ scheme: 'file' }, this);
			this.shareProviderRegistration = shareProviderRegistration;
			this.disposables.push(shareProviderRegistration);
		} else if (this.shareProviderRegistration && !this._hasGitHubRepositories) {
			this.shareProviderRegistration.dispose();
			this.shareProviderRegistration = undefined;
		}
	}

	async provideShare(item: ProX-Code.ShareableItem, _token: ProX-Code.CancellationToken): Promise<ProX-Code.Uri | undefined> {
		const repository = getRepositoryForFile(this.gitAPI, item.resourceUri);
		if (!repository) {
			return;
		}

		await ensurePublished(repository, item.resourceUri);

		let repo: { owner: string; repo: string } | undefined;
		repository.state.remotes.find(remote => {
			if (remote.fetchUrl) {
				const foundRepo = getRepositoryFromUrl(remote.fetchUrl);
				if (foundRepo && (remote.name === repository.state.HEAD?.upstream?.remote)) {
					repo = foundRepo;
					return;
				} else if (foundRepo && !repo) {
					repo = foundRepo;
				}
			}
			return;
		});

		if (!repo) {
			return;
		}

		const blobSegment = repository?.state.HEAD?.name ? encodeURIComponentExceptSlashes(repository.state.HEAD?.name) : repository?.state.HEAD?.commit;
		const filepathSegment = encodeURIComponentExceptSlashes(item.resourceUri.path.substring(repository?.rootUri.path.length));
		const rangeSegment = getRangeSegment(item);
		return ProX-Code.Uri.parse(`${this.getVscodeDevHost()}/${repo.owner}/${repo.repo}/blob/${blobSegment}${filepathSegment}${rangeSegment}`);

	}

	private getVscodeDevHost(): string {
		return `https://${ProX-Code.env.appName.toLowerCase().includes('insiders') ? 'insiders.' : ''}ProX-Code.dev/github`;
	}
}

function getRangeSegment(item: ProX-Code.ShareableItem) {
	if (item.resourceUri.scheme === 'ProX-Code-notebook-cell') {
		const notebookEditor = ProX-Code.window.visibleNotebookEditors.find(editor => editor.notebook.uri.fsPath === item.resourceUri.fsPath);
		const cell = notebookEditor?.notebook.getCells().find(cell => cell.document.uri.fragment === item.resourceUri?.fragment);
		const cellIndex = cell?.index ?? notebookEditor?.selection.start;
		return notebookCellRangeString(cellIndex, item.selection);
	}

	return rangeString(item.selection);
}
