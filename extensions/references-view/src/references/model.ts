/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SymbolItemDragAndDrop, SymbolItemEditorHighlights, SymbolItemNavigation, SymbolTreeInput, SymbolTreeModel } from '../references-view';
import { asResourceUrl, del, getPreviewChunks, tail } from '../utils';

export class ReferencesTreeInput implements SymbolTreeInput<FileItem | ReferenceItem> {

	readonly contextValue: string;

	constructor(
		readonly title: string,
		readonly location: ProX-Code.Location,
		private readonly _command: string,
		private readonly _result?: ProX-Code.Location[] | ProX-Code.LocationLink[]
	) {
		this.contextValue = _command;
	}

	async resolve(): Promise<SymbolTreeModel<FileItem | ReferenceItem> | undefined> {

		let model: ReferencesModel;
		if (this._result) {
			model = new ReferencesModel(this._result);
		} else {
			const resut = await Promise.resolve(ProX-Code.commands.executeCommand<ProX-Code.Location[] | ProX-Code.LocationLink[]>(this._command, this.location.uri, this.location.range.start));
			model = new ReferencesModel(resut ?? []);
		}

		if (model.items.length === 0) {
			return;
		}

		const provider = new ReferencesTreeDataProvider(model);
		return {
			provider,
			get message() { return model.message; },
			navigation: model,
			highlights: model,
			dnd: model,
			dispose(): void {
				provider.dispose();
			}
		};
	}

	with(location: ProX-Code.Location): ReferencesTreeInput {
		return new ReferencesTreeInput(this.title, location, this._command);
	}
}

export class ReferencesModel implements SymbolItemNavigation<FileItem | ReferenceItem>, SymbolItemEditorHighlights<FileItem | ReferenceItem>, SymbolItemDragAndDrop<FileItem | ReferenceItem> {

	private _onDidChange = new ProX-Code.EventEmitter<FileItem | ReferenceItem | undefined>();
	readonly onDidChangeTreeData = this._onDidChange.event;

	readonly items: FileItem[] = [];

	constructor(locations: ProX-Code.Location[] | ProX-Code.LocationLink[]) {
		let last: FileItem | undefined;
		for (const item of locations.sort(ReferencesModel._compareLocations)) {
			const loc = item instanceof ProX-Code.Location
				? item
				: new ProX-Code.Location(item.targetUri, item.targetRange);

			if (!last || ReferencesModel._compareUriIgnoreFragment(last.uri, loc.uri) !== 0) {
				last = new FileItem(loc.uri.with({ fragment: '' }), [], this);
				this.items.push(last);
			}
			last.references.push(new ReferenceItem(loc, last));
		}
	}

	private static _compareUriIgnoreFragment(a: ProX-Code.Uri, b: ProX-Code.Uri): number {
		const aStr = a.with({ fragment: '' }).toString();
		const bStr = b.with({ fragment: '' }).toString();
		if (aStr < bStr) {
			return -1;
		} else if (aStr > bStr) {
			return 1;
		}
		return 0;
	}

	private static _compareLocations(a: ProX-Code.Location | ProX-Code.LocationLink, b: ProX-Code.Location | ProX-Code.LocationLink): number {
		const aUri = a instanceof ProX-Code.Location ? a.uri : a.targetUri;
		const bUri = b instanceof ProX-Code.Location ? b.uri : b.targetUri;
		if (aUri.toString() < bUri.toString()) {
			return -1;
		} else if (aUri.toString() > bUri.toString()) {
			return 1;
		}

		const aRange = a instanceof ProX-Code.Location ? a.range : a.targetRange;
		const bRange = b instanceof ProX-Code.Location ? b.range : b.targetRange;
		if (aRange.start.isBefore(bRange.start)) {
			return -1;
		} else if (aRange.start.isAfter(bRange.start)) {
			return 1;
		} else {
			return 0;
		}
	}

	// --- adapter

	get message() {
		if (this.items.length === 0) {
			return ProX-Code.l10n.t('No results.');
		}
		const total = this.items.reduce((prev, cur) => prev + cur.references.length, 0);
		const files = this.items.length;
		if (total === 1 && files === 1) {
			return ProX-Code.l10n.t('{0} result in {1} file', total, files);
		} else if (total === 1) {
			return ProX-Code.l10n.t('{0} result in {1} files', total, files);
		} else if (files === 1) {
			return ProX-Code.l10n.t('{0} results in {1} file', total, files);
		} else {
			return ProX-Code.l10n.t('{0} results in {1} files', total, files);
		}
	}

	location(item: FileItem | ReferenceItem) {
		return item instanceof ReferenceItem
			? item.location
			: new ProX-Code.Location(item.uri, item.references[0]?.location.range ?? new ProX-Code.Position(0, 0));
	}

	nearest(uri: ProX-Code.Uri, position: ProX-Code.Position): FileItem | ReferenceItem | undefined {

		if (this.items.length === 0) {
			return;
		}
		// NOTE: this.items is sorted by location (uri/range)
		for (const item of this.items) {
			if (item.uri.toString() === uri.toString()) {
				// (1) pick the item at the request position
				for (const ref of item.references) {
					if (ref.location.range.contains(position)) {
						return ref;
					}
				}
				// (2) pick the first item after or last before the request position
				let lastBefore: ReferenceItem | undefined;
				for (const ref of item.references) {
					if (ref.location.range.end.isAfter(position)) {
						return ref;
					}
					lastBefore = ref;
				}
				if (lastBefore) {
					return lastBefore;
				}

				break;
			}
		}

		// (3) pick the file with the longest common prefix
		let best = 0;
		const bestValue = ReferencesModel._prefixLen(this.items[best].toString(), uri.toString());

		for (let i = 1; i < this.items.length; i++) {
			const value = ReferencesModel._prefixLen(this.items[i].uri.toString(), uri.toString());
			if (value > bestValue) {
				best = i;
			}
		}

		return this.items[best].references[0];
	}

	private static _prefixLen(a: string, b: string): number {
		let pos = 0;
		while (pos < a.length && pos < b.length && a.charCodeAt(pos) === b.charCodeAt(pos)) {
			pos += 1;
		}
		return pos;
	}

	next(item: FileItem | ReferenceItem): FileItem | ReferenceItem {
		return this._move(item, true) ?? item;
	}

	previous(item: FileItem | ReferenceItem): FileItem | ReferenceItem {
		return this._move(item, false) ?? item;
	}

	private _move(item: FileItem | ReferenceItem, fwd: boolean): ReferenceItem | void {

		const delta = fwd ? +1 : -1;

		const _move = (item: FileItem): FileItem => {
			const idx = (this.items.indexOf(item) + delta + this.items.length) % this.items.length;
			return this.items[idx];
		};

		if (item instanceof FileItem) {
			if (fwd) {
				return _move(item).references[0];
			} else {
				return tail(_move(item).references);
			}
		}

		if (item instanceof ReferenceItem) {
			const idx = item.file.references.indexOf(item) + delta;
			if (idx < 0) {
				return tail(_move(item.file).references);
			} else if (idx >= item.file.references.length) {
				return _move(item.file).references[0];
			} else {
				return item.file.references[idx];
			}
		}
	}

	getEditorHighlights(_item: FileItem | ReferenceItem, uri: ProX-Code.Uri): ProX-Code.Range[] | undefined {
		const file = this.items.find(file => file.uri.toString() === uri.toString());
		return file?.references.map(ref => ref.location.range);
	}

	remove(item: FileItem | ReferenceItem) {
		if (item instanceof FileItem) {
			del(this.items, item);
			this._onDidChange.fire(undefined);
		} else {
			del(item.file.references, item);
			if (item.file.references.length === 0) {
				del(this.items, item.file);
				this._onDidChange.fire(undefined);
			} else {
				this._onDidChange.fire(item.file);
			}
		}
	}

	async asCopyText() {
		let result = '';
		for (const item of this.items) {
			result += `${await item.asCopyText()}\n`;
		}
		return result;
	}

	getDragUri(item: FileItem | ReferenceItem): ProX-Code.Uri | undefined {
		if (item instanceof FileItem) {
			return item.uri;
		} else {
			return asResourceUrl(item.file.uri, item.location.range);
		}
	}
}

class ReferencesTreeDataProvider implements ProX-Code.TreeDataProvider<FileItem | ReferenceItem> {

	private readonly _listener: ProX-Code.Disposable;
	private readonly _onDidChange = new ProX-Code.EventEmitter<FileItem | ReferenceItem | undefined>();

	readonly onDidChangeTreeData = this._onDidChange.event;

	constructor(private readonly _model: ReferencesModel) {
		this._listener = _model.onDidChangeTreeData(() => this._onDidChange.fire(undefined));
	}

	dispose(): void {
		this._onDidChange.dispose();
		this._listener.dispose();
	}

	async getTreeItem(element: FileItem | ReferenceItem) {
		if (element instanceof FileItem) {
			// files
			const result = new ProX-Code.TreeItem(element.uri);
			result.contextValue = 'file-item';
			result.description = true;
			result.iconPath = ProX-Code.ThemeIcon.File;
			result.collapsibleState = ProX-Code.TreeItemCollapsibleState.Collapsed;
			return result;

		} else {
			// references
			const { range } = element.location;
			const doc = await element.getDocument(true);
			const { before, inside, after } = getPreviewChunks(doc, range);

			const label: ProX-Code.TreeItemLabel = {
				label: before + inside + after,
				highlights: [[before.length, before.length + inside.length]]
			};

			const result = new ProX-Code.TreeItem(label);
			result.collapsibleState = ProX-Code.TreeItemCollapsibleState.None;
			result.contextValue = 'reference-item';
			result.command = {
				command: 'ProX-Code.open',
				title: ProX-Code.l10n.t('Open Reference'),
				arguments: [
					element.location.uri,
					{ selection: range.with({ end: range.start }) } satisfies ProX-Code.TextDocumentShowOptions
				]
			};
			return result;
		}
	}

	async getChildren(element?: FileItem | ReferenceItem) {
		if (!element) {
			return this._model.items;
		}
		if (element instanceof FileItem) {
			return element.references;
		}
		return undefined;
	}

	getParent(element: FileItem | ReferenceItem) {
		return element instanceof ReferenceItem ? element.file : undefined;
	}
}

export class FileItem {

	constructor(
		readonly uri: ProX-Code.Uri,
		readonly references: Array<ReferenceItem>,
		readonly model: ReferencesModel
	) { }

	// --- adapter

	remove(): void {
		this.model.remove(this);
	}

	async asCopyText() {
		let result = `${ProX-Code.workspace.asRelativePath(this.uri)}\n`;
		for (const ref of this.references) {
			result += `  ${await ref.asCopyText()}\n`;
		}
		return result;
	}
}

export class ReferenceItem {

	private _document: Thenable<ProX-Code.TextDocument> | undefined;

	constructor(
		readonly location: ProX-Code.Location,
		readonly file: FileItem,
	) { }

	async getDocument(warmUpNext?: boolean) {
		if (!this._document) {
			this._document = ProX-Code.workspace.openTextDocument(this.location.uri);
		}
		if (warmUpNext) {
			// load next document once this document has been loaded
			const next = this.file.model.next(this.file);
			if (next instanceof FileItem && next !== this.file) {
				ProX-Code.workspace.openTextDocument(next.uri);
			} else if (next instanceof ReferenceItem) {
				ProX-Code.workspace.openTextDocument(next.location.uri);
			}
		}
		return this._document;
	}

	// --- adapter

	remove(): void {
		this.file.model.remove(this);
	}

	async asCopyText() {
		const doc = await this.getDocument();
		const chunks = getPreviewChunks(doc, this.location.range, 21, false);
		return `${this.location.range.start.line + 1}, ${this.location.range.start.character + 1}: ${chunks.before + chunks.inside + chunks.after}`;
	}
}
