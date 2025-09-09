/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join, relative } from 'path';
import * as ts from 'typescript';
import { TextDecoder } from 'util';
import * as ProX-Code from 'ProX-Code';
import { Action, extractTestFromNode } from './sourceUtils';

const textDecoder = new TextDecoder('utf-8');
const diagnosticCollection = ProX-Code.languages.createDiagnosticCollection('selfhostTestProvider');

type ContentGetter = (uri: ProX-Code.Uri) => Promise<string>;

export const itemData = new WeakMap<ProX-Code.TestItem, VSCodeTest>();

export const clearFileDiagnostics = (uri: ProX-Code.Uri) => diagnosticCollection.delete(uri);

/**
 * Tries to guess which workspace folder VS Code is in.
 */
export const guessWorkspaceFolder = async () => {
	if (!ProX-Code.workspace.workspaceFolders) {
		return undefined;
	}

	if (ProX-Code.workspace.workspaceFolders.length < 2) {
		return ProX-Code.workspace.workspaceFolders[0];
	}

	for (const folder of ProX-Code.workspace.workspaceFolders) {
		try {
			await ProX-Code.workspace.fs.stat(ProX-Code.Uri.joinPath(folder.uri, 'src/vs/loader.js'));
			return folder;
		} catch {
			// ignored
		}
	}

	return undefined;
};

export const getContentFromFilesystem: ContentGetter = async uri => {
	try {
		const rawContent = await ProX-Code.workspace.fs.readFile(uri);
		return textDecoder.decode(rawContent);
	} catch (e) {
		console.warn(`Error providing tests for ${uri.fsPath}`, e);
		return '';
	}
};

export class TestFile {
	public hasBeenRead = false;

	constructor(
		public readonly uri: ProX-Code.Uri,
		public readonly workspaceFolder: ProX-Code.WorkspaceFolder
	) {}

	public getId() {
		return this.uri.toString().toLowerCase();
	}

	public getLabel() {
		return relative(join(this.workspaceFolder.uri.fsPath, 'src'), this.uri.fsPath);
	}

	public async updateFromDisk(controller: ProX-Code.TestController, item: ProX-Code.TestItem) {
		try {
			const content = await getContentFromFilesystem(item.uri!);
			item.error = undefined;
			this.updateFromContents(controller, content, item);
		} catch (e) {
			item.error = (e as Error).stack;
		}
	}

	/**
	 * Refreshes all tests in this file, `sourceReader` provided by the root.
	 */
	public updateFromContents(
		controller: ProX-Code.TestController,
		content: string,
		file: ProX-Code.TestItem
	) {
		try {
			const diagnostics: ProX-Code.Diagnostic[] = [];
			const ast = ts.createSourceFile(
				this.uri.path.split('/').pop()!,
				content,
				ts.ScriptTarget.ESNext,
				false,
				ts.ScriptKind.TS
			);

			const parents: { item: ProX-Code.TestItem; children: ProX-Code.TestItem[] }[] = [
				{ item: file, children: [] },
			];
			const traverse = (node: ts.Node) => {
				const parent = parents[parents.length - 1];
				const childData = extractTestFromNode(ast, node, itemData.get(parent.item)!);
				if (childData === Action.Skip) {
					return;
				}

				if (childData === Action.Recurse) {
					ts.forEachChild(node, traverse);
					return;
				}

				const id = `${file.uri}/${childData.fullName}`.toLowerCase();

				// Skip duplicated tests. They won't run correctly with the way
				// mocha reports them, and will error if we try to insert them.
				const existing = parent.children.find(c => c.id === id);
				if (existing) {
					const diagnostic = new ProX-Code.Diagnostic(
						childData.range,
						'Duplicate tests cannot be run individually and will not be reported correctly by the test framework. Please rename them.',
						ProX-Code.DiagnosticSeverity.Warning
					);

					diagnostic.relatedInformation = [
						new ProX-Code.DiagnosticRelatedInformation(
							new ProX-Code.Location(existing.uri!, existing.range!),
							'First declared here'
						),
					];

					diagnostics.push(diagnostic);
					return;
				}

				const item = controller.createTestItem(id, childData.name, file.uri);
				itemData.set(item, childData);
				item.range = childData.range;
				parent.children.push(item);

				if (childData instanceof TestSuite) {
					parents.push({ item: item, children: [] });
					ts.forEachChild(node, traverse);
					item.children.replace(parents.pop()!.children);
				}
			};

			ts.forEachChild(ast, traverse);
			file.error = undefined;
			file.children.replace(parents[0].children);
			diagnosticCollection.set(this.uri, diagnostics.length ? diagnostics : undefined);
			this.hasBeenRead = true;
		} catch (e) {
			file.error = String((e as Error).stack || (e as Error).message);
		}
	}
}

export abstract class TestConstruct {
	public fullName: string;

	constructor(
		public readonly name: string,
		public readonly range: ProX-Code.Range,
		parent?: TestConstruct
	) {
		this.fullName = parent ? `${parent.fullName} ${name}` : name;
	}
}

export class TestSuite extends TestConstruct {}

export class TestCase extends TestConstruct {}

export type VSCodeTest = TestFile | TestSuite | TestCase;
