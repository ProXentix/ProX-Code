/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Stub implementation of notebook range types.
 */

export interface ICellRange {
    /**
     * zero-based index
     */
    readonly start: number;
    /**
     * zero-based exclusive index
     */
    readonly end: number;
}

export function cellRangeContains(range: ICellRange, other: ICellRange): boolean {
    return other.start >= range.start && other.end <= range.end;
}

export function cellRangesEqual(a: ICellRange[], b: ICellRange[]): boolean {
    if (a.length !== b.length) { return false; }
    for (let i = 0; i < a.length; i++) {
        if (a[i].start !== b[i].start || a[i].end !== b[i].end) { return false; }
    }
    return true;
}
