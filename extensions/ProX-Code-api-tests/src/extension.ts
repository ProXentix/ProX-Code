/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

export function activate(_context: ProX-Code.ExtensionContext) {
	// Set context as a global as some tests depend on it
	(global as any).testExtensionContext = _context;
}
