/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from '../../../base/common/severity.js';
import type * as ProX-Code from 'ProX-Code';
import { MainContext, MainThreadMessageServiceShape, MainThreadMessageOptions, IMainContext } from './extHost.protocol.js';
import { IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { ILogService } from '../../../platform/log/common/log.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';

function isMessageItem(item: any): item is ProX-Code.MessageItem {
	return item && item.title;
}

export class ExtHostMessageService {

	private _proxy: MainThreadMessageServiceShape;

	constructor(
		mainContext: IMainContext,
		@ILogService private readonly _logService: ILogService
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadMessageService);
	}


	showMessage(extension: IExtensionDescription, severity: Severity, message: string, optionsOrFirstItem: ProX-Code.MessageOptions | string | undefined, rest: string[]): Promise<string | undefined>;
	showMessage(extension: IExtensionDescription, severity: Severity, message: string, optionsOrFirstItem: ProX-Code.MessageOptions | ProX-Code.MessageItem | undefined, rest: ProX-Code.MessageItem[]): Promise<ProX-Code.MessageItem | undefined>;
	showMessage(extension: IExtensionDescription, severity: Severity, message: string, optionsOrFirstItem: ProX-Code.MessageOptions | ProX-Code.MessageItem | string | undefined, rest: Array<ProX-Code.MessageItem | string>): Promise<string | ProX-Code.MessageItem | undefined>;
	showMessage(extension: IExtensionDescription, severity: Severity, message: string, optionsOrFirstItem: ProX-Code.MessageOptions | string | ProX-Code.MessageItem | undefined, rest: Array<string | ProX-Code.MessageItem>): Promise<string | ProX-Code.MessageItem | undefined> {

		const options: MainThreadMessageOptions = {
			source: { identifier: extension.identifier, label: extension.displayName || extension.name }
		};
		let items: (string | ProX-Code.MessageItem)[];

		if (typeof optionsOrFirstItem === 'string' || isMessageItem(optionsOrFirstItem)) {
			items = [optionsOrFirstItem, ...rest];
		} else {
			options.modal = optionsOrFirstItem?.modal;
			options.useCustom = optionsOrFirstItem?.useCustom;
			options.detail = optionsOrFirstItem?.detail;
			items = rest;
		}

		if (options.useCustom) {
			checkProposedApiEnabled(extension, 'resolvers');
		}

		const commands: { title: string; isCloseAffordance: boolean; handle: number }[] = [];
		let hasCloseAffordance = false;

		for (let handle = 0; handle < items.length; handle++) {
			const command = items[handle];
			if (typeof command === 'string') {
				commands.push({ title: command, handle, isCloseAffordance: false });
			} else if (typeof command === 'object') {
				const { title, isCloseAffordance } = command;
				commands.push({ title, isCloseAffordance: !!isCloseAffordance, handle });
				if (isCloseAffordance) {
					if (hasCloseAffordance) {
						this._logService.warn(`[${extension.identifier}] Only one message item can have 'isCloseAffordance':`, command);
					} else {
						hasCloseAffordance = true;
					}
				}
			} else {
				this._logService.warn(`[${extension.identifier}] Invalid message item:`, command);
			}
		}

		return this._proxy.$showMessage(severity, message, options, commands).then(handle => {
			if (typeof handle === 'number') {
				return items[handle];
			}
			return undefined;
		});
	}
}
