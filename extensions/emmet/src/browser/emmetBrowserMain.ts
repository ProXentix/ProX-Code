/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { activateEmmetExtension } from '../emmetCommon';

export function activate(context: ProX-Code.ExtensionContext) {
	activateEmmetExtension(context);
}
