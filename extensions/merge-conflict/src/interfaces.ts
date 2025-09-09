/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as ProX-Code from 'ProX-Code';

export interface IMergeRegion {
	name: string;
	header: ProX-Code.Range;
	content: ProX-Code.Range;
	decoratorContent: ProX-Code.Range;
}

export const enum CommitType {
	Current,
	Incoming,
	Both
}

export interface IExtensionConfiguration {
	enableCodeLens: boolean;
	enableDecorations: boolean;
	enableEditorOverview: boolean;
}

export interface IDocumentMergeConflict extends IDocumentMergeConflictDescriptor {
	commitEdit(type: CommitType, editor: ProX-Code.TextEditor, edit?: ProX-Code.TextEditorEdit): Thenable<boolean>;
	applyEdit(type: CommitType, document: ProX-Code.TextDocument, edit: { replace(range: ProX-Code.Range, newText: string): void }): void;
}

export interface IDocumentMergeConflictDescriptor {
	range: ProX-Code.Range;
	current: IMergeRegion;
	incoming: IMergeRegion;
	commonAncestors: IMergeRegion[];
	splitter: ProX-Code.Range;
}

export interface IDocumentMergeConflictTracker {
	getConflicts(document: ProX-Code.TextDocument): PromiseLike<IDocumentMergeConflict[]>;
	isPending(document: ProX-Code.TextDocument): boolean;
	forget(document: ProX-Code.TextDocument): void;
}

export interface IDocumentMergeConflictTrackerService {
	createTracker(origin: string): IDocumentMergeConflictTracker;
	forget(document: ProX-Code.TextDocument): void;
}
