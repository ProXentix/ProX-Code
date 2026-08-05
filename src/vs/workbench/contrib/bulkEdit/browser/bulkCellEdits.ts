/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';

// Stub: bulkCellEdits is not available in this build.
export class ResourceNotebookCellEdit {
	static is(candidate: any): candidate is ResourceNotebookCellEdit {
		return candidate instanceof ResourceNotebookCellEdit;
	}
	resource!: URI;
}

export class BulkCellEdits {
	constructor(...args: any[]) {}
	async apply(): Promise<readonly URI[]> {
		return [];
	}
}
