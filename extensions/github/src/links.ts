/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { API as GitAPI, RefType, Repository } from './typings/git.js';
import { getRepositoryFromUrl, repositoryHasGitHubRemote } from './util.js';

export function isFileInRepo(repository: Repository, file: ProX-Code.Uri): boolean {
	return file.path.toLowerCase() === repository.rootUri.path.toLowerCase() ||
		(file.path.toLowerCase().startsWith(repository.rootUri.path.toLowerCase()) &&
			file.path.substring(repository.rootUri.path.length).startsWith('/'));
}

export function getRepositoryForFile(gitAPI: GitAPI, file: ProX-Code.Uri): Repository | undefined {
	for (const repository of gitAPI.repositories) {
		if (isFileInRepo(repository, file)) {
			return repository;
		}
	}
	return undefined;
}

enum LinkType {
	File = 1,
	Notebook = 2
}

interface IFilePosition {
	type: LinkType.File;
	uri: ProX-Code.Uri;
	range: ProX-Code.Range | undefined;
}

interface INotebookPosition {
	type: LinkType.Notebook;
	uri: ProX-Code.Uri;
	cellIndex: number;
	range: ProX-Code.Range | undefined;
}

interface EditorLineNumberContext {
	uri: ProX-Code.Uri;
	lineNumber: number;
}
export type LinkContext = ProX-Code.Uri | EditorLineNumberContext | undefined;

function extractContext(context: LinkContext): { fileUri: ProX-Code.Uri | undefined; lineNumber: number | undefined } {
	if (context instanceof ProX-Code.Uri) {
		return { fileUri: context, lineNumber: undefined };
	} else if (context !== undefined && 'lineNumber' in context && 'uri' in context) {
		return { fileUri: context.uri, lineNumber: context.lineNumber };
	} else {
		return { fileUri: undefined, lineNumber: undefined };
	}
}

function getFileAndPosition(context: LinkContext): IFilePosition | INotebookPosition | undefined {
	let range: ProX-Code.Range | undefined;

	const { fileUri, lineNumber } = extractContext(context);
	const uri = fileUri ?? ProX-Code.window.activeTextEditor?.document.uri;

	if (uri) {
		if (uri.scheme === 'ProX-Code-notebook-cell' && ProX-Code.window.activeNotebookEditor?.notebook.uri.fsPath === uri.fsPath) {
			// if the active editor is a notebook editor and the focus is inside any a cell text editor
			// generate deep link for text selection for the notebook cell.
			const cell = ProX-Code.window.activeNotebookEditor.notebook.getCells().find(cell => cell.document.uri.fragment === uri?.fragment);
			const cellIndex = cell?.index ?? ProX-Code.window.activeNotebookEditor.selection.start;

			const range = getRangeOrSelection(lineNumber);
			return { type: LinkType.Notebook, uri, cellIndex, range };
		} else {
			// the active editor is a text editor
			range = getRangeOrSelection(lineNumber);
			return { type: LinkType.File, uri, range };
		}
	}

	if (ProX-Code.window.activeNotebookEditor) {
		// if the active editor is a notebook editor but the focus is not inside any cell text editor, generate deep link for the cell selection in the notebook document.
		return { type: LinkType.Notebook, uri: ProX-Code.window.activeNotebookEditor.notebook.uri, cellIndex: ProX-Code.window.activeNotebookEditor.selection.start, range: undefined };
	}

	return undefined;
}

function getRangeOrSelection(lineNumber: number | undefined) {
	return lineNumber !== undefined && (!ProX-Code.window.activeTextEditor || ProX-Code.window.activeTextEditor.selection.isEmpty || !ProX-Code.window.activeTextEditor.selection.contains(new ProX-Code.Position(lineNumber - 1, 0)))
		? new ProX-Code.Range(lineNumber - 1, 0, lineNumber - 1, 1)
		: ProX-Code.window.activeTextEditor?.selection;
}

export function rangeString(range: ProX-Code.Range | undefined) {
	if (!range) {
		return '';
	}
	let hash = `#L${range.start.line + 1}`;
	if (range.start.line !== range.end.line) {
		hash += `-L${range.end.line + 1}`;
	}
	return hash;
}

export function notebookCellRangeString(index: number | undefined, range: ProX-Code.Range | undefined) {
	if (index === undefined) {
		return '';
	}

	if (!range) {
		return `#C${index + 1}`;
	}

	let hash = `#C${index + 1}:L${range.start.line + 1}`;
	if (range.start.line !== range.end.line) {
		hash += `-L${range.end.line + 1}`;
	}
	return hash;
}

export function encodeURIComponentExceptSlashes(path: string) {
	// There may be special characters like # and whitespace in the path.
	// These characters are not escaped by encodeURI(), so it is not sufficient to
	// feed the full URI to encodeURI().
	// Additonally, if we feed the full path into encodeURIComponent(),
	// this will also encode the path separators, leading to an invalid path.
	// Therefore, split on the path separator and encode each segment individually.
	return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export async function getLink(gitAPI: GitAPI, useSelection: boolean, shouldEnsurePublished: boolean, hostPrefix?: string, linkType: 'permalink' | 'headlink' = 'permalink', context?: LinkContext, useRange?: boolean): Promise<string | undefined> {
	hostPrefix = hostPrefix ?? 'https://github.com';
	const fileAndPosition = getFileAndPosition(context);
	const fileUri = fileAndPosition?.uri;

	// Use the first repo if we cannot determine a repo from the uri.
	const githubRepository = gitAPI.repositories.find(repo => repositoryHasGitHubRemote(repo));
	const gitRepo = (fileUri ? getRepositoryForFile(gitAPI, fileUri) : githubRepository) ?? githubRepository;
	if (!gitRepo) {
		return;
	}

	if (shouldEnsurePublished && fileUri) {
		await ensurePublished(gitRepo, fileUri);
	}

	let repo: { owner: string; repo: string } | undefined;
	gitRepo.state.remotes.find(remote => {
		if (remote.fetchUrl) {
			const foundRepo = getRepositoryFromUrl(remote.fetchUrl);
			if (foundRepo && (remote.name === gitRepo.state.HEAD?.upstream?.remote)) {
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

	const blobSegment = gitRepo.state.HEAD ? (`/blob/${linkType === 'headlink' && gitRepo.state.HEAD.name ? encodeURIComponentExceptSlashes(gitRepo.state.HEAD.name) : gitRepo.state.HEAD?.commit}`) : '';
	const uriWithoutFileSegments = `${hostPrefix}/${repo.owner}/${repo.repo}${blobSegment}`;
	if (!fileUri) {
		return uriWithoutFileSegments;
	}

	const encodedFilePath = encodeURIComponentExceptSlashes(fileUri.path.substring(gitRepo.rootUri.path.length));
	const fileSegments = fileAndPosition.type === LinkType.File
		? (useSelection ? `${encodedFilePath}${useRange ? rangeString(fileAndPosition.range) : ''}` : '')
		: (useSelection ? `${encodedFilePath}${useRange ? notebookCellRangeString(fileAndPosition.cellIndex, fileAndPosition.range) : ''}` : '');

	return `${uriWithoutFileSegments}${fileSegments}`;
}

export function getAvatarLink(userId: string, size: number): string {
	return `https://avatars.githubusercontent.com/u/${userId}?s=${size}`;
}

export function getBranchLink(url: string, branch: string, hostPrefix: string = 'https://github.com') {
	const repo = getRepositoryFromUrl(url);
	if (!repo) {
		throw new Error('Invalid repository URL provided');
	}

	branch = encodeURIComponentExceptSlashes(branch);
	return `${hostPrefix}/${repo.owner}/${repo.repo}/tree/${branch}`;
}

export function getCommitLink(url: string, hash: string, hostPrefix: string = 'https://github.com') {
	const repo = getRepositoryFromUrl(url);
	if (!repo) {
		throw new Error('Invalid repository URL provided');
	}

	return `${hostPrefix}/${repo.owner}/${repo.repo}/commit/${hash}`;
}

export function getVscodeDevHost(): string {
	return `https://${ProX-Code.env.appName.toLowerCase().includes('insiders') ? 'insiders.' : ''}ProX-Code.dev/github`;
}

export async function ensurePublished(repository: Repository, file: ProX-Code.Uri) {
	await repository.status();

	if ((repository.state.HEAD?.type === RefType.Head || repository.state.HEAD?.type === RefType.Tag)
		// If HEAD is not published, make sure it is
		&& !repository?.state.HEAD?.upstream
	) {
		const publishBranch = ProX-Code.l10n.t('Publish Branch & Copy Link');
		const selection = await ProX-Code.window.showInformationMessage(
			ProX-Code.l10n.t('The current branch is not published to the remote. Would you like to publish your branch before copying a link?'),
			{ modal: true },
			publishBranch
		);
		if (selection !== publishBranch) {
			throw new ProX-Code.CancellationError();
		}

		await ProX-Code.commands.executeCommand('git.publish');
	}

	const uncommittedChanges = [...repository.state.workingTreeChanges, ...repository.state.indexChanges];
	if (uncommittedChanges.find((c) => c.uri.toString() === file.toString()) && !repository.state.HEAD?.ahead && !repository.state.HEAD?.behind) {
		const commitChanges = ProX-Code.l10n.t('Commit Changes');
		const copyAnyway = ProX-Code.l10n.t('Copy Anyway');
		const selection = await ProX-Code.window.showWarningMessage(
			ProX-Code.l10n.t('The current file has uncommitted changes. Please commit your changes before copying a link.'),
			{ modal: true },
			commitChanges,
			copyAnyway
		);

		if (selection !== copyAnyway) {
			// Focus the SCM view
			ProX-Code.commands.executeCommand('workbench.view.scm');
			throw new ProX-Code.CancellationError();
		}
	} else if (repository.state.HEAD?.ahead) {
		const pushCommits = ProX-Code.l10n.t('Push Commits & Copy Link');
		const selection = await ProX-Code.window.showInformationMessage(
			ProX-Code.l10n.t('The current branch has unpublished commits. Would you like to push your commits before copying a link?'),
			{ modal: true },
			pushCommits
		);
		if (selection !== pushCommits) {
			throw new ProX-Code.CancellationError();
		}

		await repository.push();
	} else if (repository.state.HEAD?.behind) {
		const pull = ProX-Code.l10n.t('Pull Changes & Copy Link');
		const selection = await ProX-Code.window.showInformationMessage(
			ProX-Code.l10n.t('The current branch is not up to date. Would you like to pull before copying a link?'),
			{ modal: true },
			pull
		);
		if (selection !== pull) {
			throw new ProX-Code.CancellationError();
		}

		await repository.pull();
	}

	await repository.status();
}
