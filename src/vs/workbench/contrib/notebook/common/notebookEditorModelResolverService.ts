/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Stub: Notebook editor model resolver service is not available in this build.
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IReference } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';

export interface IResolvedNotebookEditorModel {
	save(options?: { source?: string }): Promise<boolean>;
}

export const INotebookEditorModelResolverService = createDecorator<INotebookEditorModelResolverService>('INotebookEditorModelResolverService');
export interface INotebookEditorModelResolverService {
	readonly _serviceBrand: undefined;
	resolve(resource: URI, viewType?: string): Promise<IReference<IResolvedNotebookEditorModel>>;
}
