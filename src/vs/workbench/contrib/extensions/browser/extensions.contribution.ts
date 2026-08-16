/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IExtensionsWorkbenchService } from '../common/extensions.js';
import { ExtensionsWorkbenchService } from './extensionsWorkbenchService.js';

// Minimal Extension Workbench Service for Built-in Extensions in ProX-Code
registerSingleton(IExtensionsWorkbenchService, ExtensionsWorkbenchService, InstantiationType.Delayed);
