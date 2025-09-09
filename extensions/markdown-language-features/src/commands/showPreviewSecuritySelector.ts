/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Command } from '../commandManager';
import { MarkdownPreviewManager } from '../preview/previewManager';
import { PreviewSecuritySelector } from '../preview/security';
import { isMarkdownFile } from '../util/file';

export class ShowPreviewSecuritySelectorCommand implements Command {
	public readonly id = 'markdown.showPreviewSecuritySelector';

	public constructor(
		private readonly _previewSecuritySelector: PreviewSecuritySelector,
		private readonly _previewManager: MarkdownPreviewManager
	) { }

	public execute(resource: string | undefined) {
		if (this._previewManager.activePreviewResource) {
			this._previewSecuritySelector.showSecuritySelectorForResource(this._previewManager.activePreviewResource);
		} else if (resource) {
			const source = ProX-Code.Uri.parse(resource);
			this._previewSecuritySelector.showSecuritySelectorForResource(source.query ? ProX-Code.Uri.parse(source.query) : source);
		} else if (ProX-Code.window.activeTextEditor && isMarkdownFile(ProX-Code.window.activeTextEditor.document)) {
			this._previewSecuritySelector.showSecuritySelectorForResource(ProX-Code.window.activeTextEditor.document.uri);
		}
	}
}
