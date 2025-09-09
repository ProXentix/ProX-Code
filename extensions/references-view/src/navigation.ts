/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SymbolItemNavigation } from './references-view';
import { ContextKey } from './utils';

export class Navigation {

	private readonly _disposables: ProX-Code.Disposable[] = [];
	private readonly _ctxCanNavigate = new ContextKey<boolean>('references-view.canNavigate');

	private _delegate?: SymbolItemNavigation<unknown>;

	constructor(private readonly _view: ProX-Code.TreeView<unknown>) {
		this._disposables.push(
			ProX-Code.commands.registerCommand('references-view.next', () => this.next(false)),
			ProX-Code.commands.registerCommand('references-view.prev', () => this.previous(false)),
		);
	}

	dispose(): void {
		ProX-Code.Disposable.from(...this._disposables).dispose();
	}

	update(delegate: SymbolItemNavigation<unknown> | undefined) {
		this._delegate = delegate;
		this._ctxCanNavigate.set(Boolean(this._delegate));
	}

	private _anchor(): undefined | unknown {
		if (!this._delegate) {
			return undefined;
		}
		const [sel] = this._view.selection;
		if (sel) {
			return sel;
		}
		if (!ProX-Code.window.activeTextEditor) {
			return undefined;
		}
		return this._delegate.nearest(ProX-Code.window.activeTextEditor.document.uri, ProX-Code.window.activeTextEditor.selection.active);
	}

	private _open(loc: ProX-Code.Location, preserveFocus: boolean) {
		ProX-Code.commands.executeCommand('ProX-Code.open', loc.uri, {
			selection: new ProX-Code.Selection(loc.range.start, loc.range.start),
			preserveFocus
		});
	}

	previous(preserveFocus: boolean): void {
		if (!this._delegate) {
			return;
		}
		const item = this._anchor();
		if (!item) {
			return;
		}
		const newItem = this._delegate.previous(item);
		const newLocation = this._delegate.location(newItem);
		if (newLocation) {
			this._view.reveal(newItem, { select: true, focus: true });
			this._open(newLocation, preserveFocus);
		}
	}

	next(preserveFocus: boolean): void {
		if (!this._delegate) {
			return;
		}
		const item = this._anchor();
		if (!item) {
			return;
		}
		const newItem = this._delegate.next(item);
		const newLocation = this._delegate.location(newItem);
		if (newLocation) {
			this._view.reveal(newItem, { select: true, focus: true });
			this._open(newLocation, preserveFocus);
		}
	}
}
