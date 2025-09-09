/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebviewStyles } from '../../../../webview/browser/webview.js';

const mapping: ReadonlyMap<string, string> = new Map([
	['theme-font-family', 'ProX-Code-font-family'],
	['theme-font-weight', 'ProX-Code-font-weight'],
	['theme-font-size', 'ProX-Code-font-size'],
	['theme-code-font-family', 'ProX-Code-editor-font-family'],
	['theme-code-font-weight', 'ProX-Code-editor-font-weight'],
	['theme-code-font-size', 'ProX-Code-editor-font-size'],
	['theme-scrollbar-background', 'ProX-Code-scrollbarSlider-background'],
	['theme-scrollbar-hover-background', 'ProX-Code-scrollbarSlider-hoverBackground'],
	['theme-scrollbar-active-background', 'ProX-Code-scrollbarSlider-activeBackground'],
	['theme-quote-background', 'ProX-Code-textBlockQuote-background'],
	['theme-quote-border', 'ProX-Code-textBlockQuote-border'],
	['theme-code-foreground', 'ProX-Code-textPreformat-foreground'],
	// Editor
	['theme-background', 'ProX-Code-editor-background'],
	['theme-foreground', 'ProX-Code-editor-foreground'],
	['theme-ui-foreground', 'ProX-Code-foreground'],
	['theme-link', 'ProX-Code-textLink-foreground'],
	['theme-link-active', 'ProX-Code-textLink-activeForeground'],
	// Buttons
	['theme-button-background', 'ProX-Code-button-background'],
	['theme-button-hover-background', 'ProX-Code-button-hoverBackground'],
	['theme-button-foreground', 'ProX-Code-button-foreground'],
	['theme-button-secondary-background', 'ProX-Code-button-secondaryBackground'],
	['theme-button-secondary-hover-background', 'ProX-Code-button-secondaryHoverBackground'],
	['theme-button-secondary-foreground', 'ProX-Code-button-secondaryForeground'],
	['theme-button-hover-foreground', 'ProX-Code-button-foreground'],
	['theme-button-focus-foreground', 'ProX-Code-button-foreground'],
	['theme-button-secondary-hover-foreground', 'ProX-Code-button-secondaryForeground'],
	['theme-button-secondary-focus-foreground', 'ProX-Code-button-secondaryForeground'],
	// Inputs
	['theme-input-background', 'ProX-Code-input-background'],
	['theme-input-foreground', 'ProX-Code-input-foreground'],
	['theme-input-placeholder-foreground', 'ProX-Code-input-placeholderForeground'],
	['theme-input-focus-border-color', 'ProX-Code-focusBorder'],
	// Menus
	['theme-menu-background', 'ProX-Code-menu-background'],
	['theme-menu-foreground', 'ProX-Code-menu-foreground'],
	['theme-menu-hover-background', 'ProX-Code-menu-selectionBackground'],
	['theme-menu-focus-background', 'ProX-Code-menu-selectionBackground'],
	['theme-menu-hover-foreground', 'ProX-Code-menu-selectionForeground'],
	['theme-menu-focus-foreground', 'ProX-Code-menu-selectionForeground'],
	// Errors
	['theme-error-background', 'ProX-Code-inputValidation-errorBackground'],
	['theme-error-foreground', 'ProX-Code-foreground'],
	['theme-warning-background', 'ProX-Code-inputValidation-warningBackground'],
	['theme-warning-foreground', 'ProX-Code-foreground'],
	['theme-info-background', 'ProX-Code-inputValidation-infoBackground'],
	['theme-info-foreground', 'ProX-Code-foreground'],
	// Notebook:
	['theme-notebook-output-background', 'ProX-Code-notebook-outputContainerBackgroundColor'],
	['theme-notebook-output-border', 'ProX-Code-notebook-outputContainerBorderColor'],
	['theme-notebook-cell-selected-background', 'ProX-Code-notebook-selectedCellBackground'],
	['theme-notebook-symbol-highlight-background', 'ProX-Code-notebook-symbolHighlightBackground'],
	['theme-notebook-diff-removed-background', 'ProX-Code-diffEditor-removedTextBackground'],
	['theme-notebook-diff-inserted-background', 'ProX-Code-diffEditor-insertedTextBackground'],
]);

const constants: Readonly<WebviewStyles> = {
	'theme-input-border-width': '1px',
	'theme-button-primary-hover-shadow': 'none',
	'theme-button-secondary-hover-shadow': 'none',
	'theme-input-border-color': 'transparent',
};

/**
 * Transforms base ProX-Code theme variables into generic variables for notebook
 * renderers.
 * @see https://github.com/microsoft/ProX-Code/issues/107985 for context
 * @deprecated
 */
export const transformWebviewThemeVars = (s: Readonly<WebviewStyles>): WebviewStyles => {
	const result = { ...s, ...constants };
	for (const [target, src] of mapping) {
		result[target] = s[src];
	}

	return result;
};
