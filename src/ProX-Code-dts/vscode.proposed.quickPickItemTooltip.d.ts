/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'ProX-Code' {

	// https://github.com/microsoft/ProX-Code/issues/175662

	export interface QuickPickItem {
		/**
		 * A tooltip that is rendered when hovering over the item.
		 */
		tooltip?: string | MarkdownString;
	}
}
