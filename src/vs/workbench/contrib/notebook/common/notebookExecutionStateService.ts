/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Stub implementation of notebook execution state service types.
 */

import { CellExecutionUpdateType } from './notebookExecutionService.js';

export interface ICellExecutionStateUpdate {
    editType: CellExecutionUpdateType;
    [key: string]: any;
}

export interface ICellExecutionComplete {
    runEndTime?: number;
    lastRunSuccess?: boolean;
}
