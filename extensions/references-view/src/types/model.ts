/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SymbolItemDragAndDrop, SymbolItemEditorHighlights, SymbolItemNavigation, SymbolTreeInput } from '../references-view';
import { asResourceUrl, del, getThemeIcon, tail } from '../utils';

export class TypesTreeInput implements SymbolTreeInput<TypeItem> {

	readonly title: string;
	readonly contextValue: string = 'typeHierarchy';

	constructor(
		readonly location: ProX-Code.Location,
		readonly direction: TypeHierarchyDirection,
	) {
		this.title = direction === TypeHierarchyDirection.Supertypes
			? ProX-Code.l10n.t('Supertypes Of')
			: ProX-Code.l10n.t('Subtypes Of');
	}

	async resolve() {

		const items = await Promise.resolve(ProX-Code.commands.executeCommand<ProX-Code.TypeHierarchyItem[]>('ProX-Code.prepareTypeHierarchy', this.location.uri, this.location.range.start));
		const model = new TypesModel(this.direction, items ?? []);
		const provider = new TypeItemDataProvider(model);

		if (model.roots.length === 0) {
			return;
		}

		return {
			provider,
			get message() { return model.roots.length === 0 ? ProX-Code.l10n.t('No results.') : undefined; },
			navigation: model,
			highlights: model,
			dnd: model,
			dispose() {
				provider.dispose();
			}
		};
	}

	with(location: ProX-Code.Location): TypesTreeInput {
		return new TypesTreeInput(location, this.direction);
	}
}


export const enum TypeHierarchyDirection {
	Subtypes = 'subtypes',
	Supertypes = 'supertypes'
}


export class TypeItem {

	children?: TypeItem[];

	constructor(
		readonly model: TypesModel,
		readonly item: ProX-Code.TypeHierarchyItem,
		readonly parent: TypeItem | undefined,
	) { }

	remove(): void {
		this.model.remove(this);
	}
}

class TypesModel implements SymbolItemNavigation<TypeItem>, SymbolItemEditorHighlights<TypeItem>, SymbolItemDragAndDrop<TypeItem> {

	readonly roots: TypeItem[] = [];

	private readonly _onDidChange = new ProX-Code.EventEmitter<TypesModel>();
	readonly onDidChange = this._onDidChange.event;

	constructor(readonly direction: TypeHierarchyDirection, items: ProX-Code.TypeHierarchyItem[]) {
		this.roots = items.map(item => new TypeItem(this, item, undefined));
	}

	private async _resolveTypes(currentType: TypeItem): Promise<TypeItem[]> {
		if (this.direction === TypeHierarchyDirection.Supertypes) {
			const types = await ProX-Code.commands.executeCommand<ProX-Code.TypeHierarchyItem[]>('ProX-Code.provideSupertypes', currentType.item);
			return types ? types.map(item => new TypeItem(this, item, currentType)) : [];
		} else {
			const types = await ProX-Code.commands.executeCommand<ProX-Code.TypeHierarchyItem[]>('ProX-Code.provideSubtypes', currentType.item);
			return types ? types.map(item => new TypeItem(this, item, currentType)) : [];
		}
	}

	async getTypeChildren(item: TypeItem): Promise<TypeItem[]> {
		if (!item.children) {
			item.children = await this._resolveTypes(item);
		}
		return item.children;
	}

	// -- dnd

	getDragUri(item: TypeItem): ProX-Code.Uri | undefined {
		return asResourceUrl(item.item.uri, item.item.range);
	}

	// -- navigation

	location(currentType: TypeItem) {
		return new ProX-Code.Location(currentType.item.uri, currentType.item.range);
	}

	nearest(uri: ProX-Code.Uri, _position: ProX-Code.Position): TypeItem | undefined {
		return this.roots.find(item => item.item.uri.toString() === uri.toString()) ?? this.roots[0];
	}

	next(from: TypeItem): TypeItem {
		return this._move(from, true) ?? from;
	}

	previous(from: TypeItem): TypeItem {
		return this._move(from, false) ?? from;
	}

	private _move(item: TypeItem, fwd: boolean): TypeItem | void {
		if (item.children?.length) {
			return fwd ? item.children[0] : tail(item.children);
		}
		const array = this.roots.includes(item) ? this.roots : item.parent?.children;
		if (array?.length) {
			const idx = array.indexOf(item);
			const delta = fwd ? 1 : -1;
			return array[idx + delta + array.length % array.length];
		}
	}

	// --- highlights

	getEditorHighlights(currentType: TypeItem, uri: ProX-Code.Uri): ProX-Code.Range[] | undefined {
		return currentType.item.uri.toString() === uri.toString() ? [currentType.item.selectionRange] : undefined;
	}

	remove(item: TypeItem) {
		const isInRoot = this.roots.includes(item);
		const siblings = isInRoot ? this.roots : item.parent?.children;
		if (siblings) {
			del(siblings, item);
			this._onDidChange.fire(this);
		}
	}
}

class TypeItemDataProvider implements ProX-Code.TreeDataProvider<TypeItem> {

	private readonly _emitter = new ProX-Code.EventEmitter<TypeItem | undefined>();
	readonly onDidChangeTreeData = this._emitter.event;

	private readonly _modelListener: ProX-Code.Disposable;

	constructor(private _model: TypesModel) {
		this._modelListener = _model.onDidChange(e => this._emitter.fire(e instanceof TypeItem ? e : undefined));
	}

	dispose(): void {
		this._emitter.dispose();
		this._modelListener.dispose();
	}

	getTreeItem(element: TypeItem): ProX-Code.TreeItem {

		const item = new ProX-Code.TreeItem(element.item.name);
		item.description = element.item.detail;
		item.contextValue = 'type-item';
		item.iconPath = getThemeIcon(element.item.kind);
		item.command = {
			command: 'ProX-Code.open',
			title: ProX-Code.l10n.t('Open Type'),
			arguments: [
				element.item.uri,
				{ selection: element.item.selectionRange.with({ end: element.item.selectionRange.start }) } satisfies ProX-Code.TextDocumentShowOptions
			]
		};
		item.collapsibleState = ProX-Code.TreeItemCollapsibleState.Collapsed;
		return item;
	}

	getChildren(element?: TypeItem | undefined) {
		return element
			? this._model.getTypeChildren(element)
			: this._model.roots;
	}

	getParent(element: TypeItem) {
		return element.parent;
	}
}
