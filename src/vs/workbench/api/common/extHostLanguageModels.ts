/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import type * as vscode from 'vscode';

export const IExtHostLanguageModels = createDecorator<IExtHostLanguageModels>('IExtHostLanguageModels');

export interface IExtHostLanguageModels {
    readonly _serviceBrand: undefined;
    createLanguageModelAccessInformation(extension: IExtensionDescription): vscode.LanguageModelAccessInformation;
}

export class ExtHostLanguageModels implements IExtHostLanguageModels {
    readonly _serviceBrand: undefined;

    createLanguageModelAccessInformation(_extension: IExtensionDescription): vscode.LanguageModelAccessInformation {
        return {
            onDidChange: { event: () => ({ dispose: () => { } }) } as any,
            canSendRequest: (_chat: vscode.LanguageModelChat) => undefined,
        };
    }
}
