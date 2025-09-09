/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SymbolsTree } from '../tree';
import { ContextKey } from '../utils';
import { TypeHierarchyDirection, TypeItem, TypesTreeInput } from './model';

export function register(tree: SymbolsTree, context: ProX-Code.ExtensionContext): void {

	const direction = new RichTypesDirection(context.workspaceState, TypeHierarchyDirection.Subtypes);

	function showTypeHierarchy() {
		if (ProX-Code.window.activeTextEditor) {
			const input = new TypesTreeInput(new ProX-Code.Location(ProX-Code.window.activeTextEditor.document.uri, ProX-Code.window.activeTextEditor.selection.active), direction.value);
			tree.setInput(input);
		}
	}

	function setTypeHierarchyDirection(value: TypeHierarchyDirection, anchor: TypeItem | ProX-Code.Location | unknown) {
		direction.value = value;

		let newInput: TypesTreeInput | undefined;
		const oldInput = tree.getInput();
		if (anchor instanceof TypeItem) {
			newInput = new TypesTreeInput(new ProX-Code.Location(anchor.item.uri, anchor.item.selectionRange.start), direction.value);
		} else if (anchor instanceof ProX-Code.Location) {
			newInput = new TypesTreeInput(anchor, direction.value);
		} else if (oldInput instanceof TypesTreeInput) {
			newInput = new TypesTreeInput(oldInput.location, direction.value);
		}
		if (newInput) {
			tree.setInput(newInput);
		}
	}

	context.subscriptions.push(
		ProX-Code.commands.registerCommand('references-view.showTypeHierarchy', showTypeHierarchy),
		ProX-Code.commands.registerCommand('references-view.showSupertypes', (item: TypeItem | ProX-Code.Location | unknown) => setTypeHierarchyDirection(TypeHierarchyDirection.Supertypes, item)),
		ProX-Code.commands.registerCommand('references-view.showSubtypes', (item: TypeItem | ProX-Code.Location | unknown) => setTypeHierarchyDirection(TypeHierarchyDirection.Subtypes, item)),
		ProX-Code.commands.registerCommand('references-view.removeTypeItem', removeTypeItem)
	);
}

function removeTypeItem(item: TypeItem | unknown): void {
	if (item instanceof TypeItem) {
		item.remove();
	}
}

class RichTypesDirection {

	private static _key = 'references-view.typeHierarchyMode';

	private _ctxMode = new ContextKey<TypeHierarchyDirection>('references-view.typeHierarchyMode');

	constructor(
		private _mem: ProX-Code.Memento,
		private _value: TypeHierarchyDirection = TypeHierarchyDirection.Subtypes,
	) {
		const raw = _mem.get<TypeHierarchyDirection>(RichTypesDirection._key);
		if (typeof raw === 'string') {
			this.value = raw;
		} else {
			this.value = _value;
		}
	}

	get value() {
		return this._value;
	}

	set value(value: TypeHierarchyDirection) {
		this._value = value;
		this._ctxMode.set(value);
		this._mem.update(RichTypesDirection._key, value);
	}
}
