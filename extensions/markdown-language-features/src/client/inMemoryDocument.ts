/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TextDocument } from 'ProX-Code-languageserver-textdocument';
import * as ProX-Code from 'ProX-Code';
import { ITextDocument } from '../types/textDocument';

export class InMemoryDocument implements ITextDocument {

	private readonly _doc: TextDocument;

	public readonly uri: ProX-Code.Uri;
	public readonly version: number;

	constructor(
		uri: ProX-Code.Uri,
		contents: string,
		version: number = 0,
	) {
		this.uri = uri;
		this.version = version;
		this._doc = TextDocument.create(this.uri.toString(), 'markdown', 0, contents);
	}

	getText(range?: ProX-Code.Range): string {
		return this._doc.getText(range);
	}

	positionAt(offset: number): ProX-Code.Position {
		const pos = this._doc.positionAt(offset);
		return new ProX-Code.Position(pos.line, pos.character);
	}
}
