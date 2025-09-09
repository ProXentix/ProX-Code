/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export class UriEventHandler extends ProX-Code.EventEmitter<ProX-Code.Uri> implements ProX-Code.UriHandler {
	private _disposable = ProX-Code.window.registerUriHandler(this);

	handleUri(uri: ProX-Code.Uri) {
		this.fire(uri);
	}

	override dispose(): void {
		super.dispose();
		this._disposable.dispose();
	}
}
