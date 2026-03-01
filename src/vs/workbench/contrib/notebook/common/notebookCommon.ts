/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Stub implementation of notebookCommon types.
 * The full notebook feature is not included in ProX-Code, but these type stubs
 * are needed for compilation of files that reference notebook types.
 */

import { UriComponents } from '../../../../base/common/uri.js';

// ---- Cell Kinds ----

export const enum CellKind {
    Markup = 1,
    Code = 2
}

// ---- Cell Edit Types ----

export const enum CellEditType {
    Replace = 1,
    Output = 2,
    Metadata = 3,
    CellLanguage = 4,
    DocumentMetadata = 5,
    Move = 6,
    OutputItems = 7,
    PartialMetadata = 8,
    PartialInternalMetadata = 9,
}

// ---- Notebook Cell Changes ----

export const enum NotebookCellsChangeType {
    ModelChange = 1,
    Move = 2,
    ChangeCellLanguage = 5,
    Initialize = 6,
    ChangeCellMetadata = 7,
    Output = 8,
    OutputItem = 9,
    ChangeCellContent = 10,
    ChangeDocumentMetadata = 11,
    ChangeCellInternalMetadata = 12,
    ChangeCellMime = 14,
    Unknown = 100,
}

// ---- Notebook Metadata ----

export type NotebookDocumentMetadata = Record<string, unknown>;
export type NotebookCellMetadata = Record<string, unknown>;
export type NotebookCellInternalMetadata = {
    executionId?: string;
    runStartTime?: number;
    runStartTimeAdjustment?: number;
    runEndTime?: number;
    renderDuration?: { [key: string]: number };
    internalId?: string;
    lastRunSuccess?: boolean;
};

// ---- Notebook Cell Data ----

export interface ICell {
    readonly uri: UriComponents;
    readonly handle: number;
    language: string;
    cellKind: CellKind;
    outputs: any[];
    metadata?: NotebookCellMetadata;
    internalMetadata?: NotebookCellInternalMetadata;
    readonly textBuffer: any;
}

export interface ICellDto2 {
    source: string;
    language: string;
    mime: string | undefined;
    cellKind: CellKind;
    outputs: any[];
    metadata?: NotebookCellMetadata;
    internalMetadata?: NotebookCellInternalMetadata;
}

// ---- Notebook Cell Edit Operations ----

export interface ICellMetadataEdit {
    editType: CellEditType.Metadata;
    index: number;
    metadata: NotebookCellMetadata;
}

export interface IDocumentMetadataEdit {
    editType: CellEditType.DocumentMetadata;
    metadata: NotebookDocumentMetadata;
}

export interface ICellReplaceEdit {
    editType: CellEditType.Replace;
    index: number;
    count: number;
    cells: ICellDto2[];
}

export type ICellEditOperation = ICellMetadataEdit | IDocumentMetadataEdit | ICellReplaceEdit | {
    editType: CellEditType;
    [key: string]: any;
};

export interface ICellTextEditOperation {
    editType: CellEditType;
    index: number;
    edits: any[];
}

export interface IWorkspaceNotebookCellEdit {
    metadata?: any;
    resource: UriComponents;
    cellEdit: ICellEditOperation;
}

// ---- Notebook Events ----

export type NotebookCellTextModelSplice<T> = [start: number, deleteCount: number, newItems: T[]];

export interface NotebookCellsChangeLanguageEvent {
    readonly kind: NotebookCellsChangeType.ChangeCellLanguage;
    readonly index: number;
    readonly language: string;
}

export interface NotebookCellsChangeMimeEvent {
    readonly kind: NotebookCellsChangeType.ChangeCellMime;
    readonly index: number;
    readonly mime: string | undefined;
}

export interface NotebookCellsChangeMetadataEvent {
    readonly kind: NotebookCellsChangeType.ChangeCellMetadata;
    readonly index: number;
    readonly metadata: NotebookCellMetadata;
}

export interface NotebookCellsChangeInternalMetadataEvent {
    readonly kind: NotebookCellsChangeType.ChangeCellInternalMetadata;
    readonly index: number;
    readonly internalMetadata: NotebookCellInternalMetadata;
}

export interface NotebookCellContentChangeEvent {
    readonly kind: NotebookCellsChangeType.ChangeCellContent;
    readonly index: number;
}

// ---- Notebook Status Bar ----

export interface INotebookCellStatusBarItem {
    readonly alignment: number;
    readonly priority?: number;
    readonly text: string;
    readonly color?: string;
    readonly backgroundColor?: string;
    readonly tooltip?: string;
    readonly command?: string | any;
    readonly accessibilityInformation?: any;
}

// ---- Notebook Extension Types ----

export interface NotebookExtensionDescription {
    readonly id: any;
    readonly location: UriComponents | undefined;
}

export interface TransientOptions {
    readonly transientOutputs: boolean;
    readonly transientCellMetadata: NotebookTransientCellMetadata;
    readonly transientDocumentMetadata: NotebookTransientDocumentMetadata;
}

export type NotebookTransientCellMetadata = { readonly [K in keyof NotebookCellMetadata]?: boolean };
export type NotebookTransientDocumentMetadata = { readonly [K in keyof NotebookDocumentMetadata]?: boolean };

export interface INotebookContributionData {
    extension?: any;
    providerDisplayName: string;
    displayName: string;
    filenamePattern: (string | any)[];
    exclusive?: boolean;
}

// ---- Notebook Kernel ----

export interface INotebookKernelSourceAction {
    readonly label: string;
    readonly description?: string;
    readonly detail?: string;
    readonly command?: string | any;
}

// ---- Notebook Settings ----

export const enum NotebookSetting {
    displayOrder = 'notebook.displayOrder',
    cellToolbarLocation = 'notebook.cellToolbarLocation',
    cellToolbarVisibility = 'notebook.toolbarShowOnHover',
    showCellStatusBar = 'notebook.showCellStatusBar',
    textDiffEditorPreview = 'notebook.diff.enablePreview',
    scrollToRevealCell = 'notebook.scrolling.revealNextCellOnExecute',
    anchorToFocusedCell = 'notebook.scrolling.anchorToFocusedCell',
    cellFocusIndicator = 'notebook.cellFocusIndicator',
    undoRedoPerCell = 'notebook.undoRedoPerCell',
    compactView = 'notebook.compactView',
    editorOptionsCustomizations = 'notebook.editorOptionsCustomizations',
    consolidatedOutputButton = 'notebook.consolidatedOutputButton',
    showFoldingControls = 'notebook.showFoldingControls',
    dragAndDropEnabled = 'notebook.dragAndDropEnabled',
    consolidatedRunButton = 'notebook.consolidatedRunButton',
    globalToolbar = 'notebook.globalToolbar',
    stickyScrollEnabled = 'notebook.stickyScroll.enabled',
    stickyScrollMode = 'notebook.stickyScroll.mode',
    InteractiveWindowCollapseCodeCells = 'interactiveWindow.collapseCellInputCode',
    outputScrollingWithButton = 'notebook.output.scrolling',
    outputWordWrap = 'notebook.output.wordWrap',
    outputLineHeightEnabled = 'notebook.output.enableOutputLineHeightSetting',
    outputFontSize = 'notebook.output.fontSize',
    outputFontFamily = 'notebook.output.fontFamily',
    outputLineHeight = 'notebook.output.lineHeight',
    formatOnSave = 'notebook.formatOnSave.enabled',
    insertFinalNewline = 'notebook.insertFinalNewline',
    formatOnCellExecution = 'notebook.formatOnCellExecution',
    defaultFormatter = 'notebook.defaultFormatter',
    codeActionsOnSave = 'notebook.codeActionsOnSave',
    outputBackupSizeLimit = 'notebook.backup.sizeLimit',
    remoteSaving = 'notebook.experimental.remoteSave',
    gotoSymbolsAllSymbols = 'notebook.gotoSymbols.showAllSymbols',
    outlineShowMarkdownHeadersOnly = 'notebook.outline.showMarkdownHeadersOnly',
    outlineShowCodeCells = 'notebook.outline.showCodeCells',
    outlineShowCodeCellSymbols = 'notebook.outline.showCodeCellSymbols',
    breadcrumbsShowCodeCells = 'notebook.breadcrumbs.showCodeCells',
    kernelPickerType = 'notebook.kernelPicker.type',
    generateCellNamesWithAI = 'notebook.experimental.generateCellNamesWithAI',
    notebookVariablesView = 'notebook.variablesView',
    cellExecutionCreatedItem = 'notebook.experimental.cellExecutionCreatedItem',
}

export const REPL_EDITOR_ID = 'workbench.editor.repl';

export const NotebookWorkingCopyTypeIdentifier = {
    create: (viewType: string) => `notebook/${viewType}`,
    parse: (name: string) => {
        if (name.startsWith('notebook/')) {
            return name.slice('notebook/'.length);
        }
        return undefined;
    }
};

// ---- Cell Range ----

export interface ICellRange {
    /**
     * zero-based index
     */
    start: number;
    /**
     * zero-based exclusive index
     */
    end: number;
}

// ---- Misc notebook types used in protocol ----

export interface NotebookOutputItem {
    readonly mime: string;
    readonly data: any;
}
