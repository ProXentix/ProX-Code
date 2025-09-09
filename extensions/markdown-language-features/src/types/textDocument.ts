/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

/**
 * Minimal version of {@link ProX-Code.TextDocument}.
 */
export interface ITextDocument {
	readonly uri: ProX-Code.Uri;
	readonly version: number;

	getText(range?: ProX-Code.Range): string;

	positionAt(offset: number): ProX-Code.Position;
}

