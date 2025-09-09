/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export interface WebviewResourceProvider {
	asWebviewUri(resource: ProX-Code.Uri): ProX-Code.Uri;

	readonly cspSource: string;
}

