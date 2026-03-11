/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const IChatEntitlementService = createDecorator<IChatEntitlementService>('chatEntitlementService');

export interface IChatEntitlementService {
	readonly _serviceBrand: undefined;
}
