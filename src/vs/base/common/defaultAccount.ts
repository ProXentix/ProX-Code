/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDefaultAccount {
	readonly sessionId: string;
	readonly enterprise: boolean;
	readonly entitlementsData?: IEntitlementsData | null;
}

export interface IEntitlementsData {
	readonly access_type_sku: string;
	readonly copilot_plan: string;
}

