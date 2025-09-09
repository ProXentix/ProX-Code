/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'ProX-Code' {
	// https://github.com/microsoft/ProX-Code/issues/133935

	export interface SourceControlActionButton {
		command: Command & { shortTitle?: string };
		secondaryCommands?: Command[][];
		enabled: boolean;
	}

	export interface SourceControl {
		actionButton?: SourceControlActionButton;
	}
}
