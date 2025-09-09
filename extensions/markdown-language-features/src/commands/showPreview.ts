/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { Command } from '../commandManager';
import { DynamicPreviewSettings, MarkdownPreviewManager } from '../preview/previewManager';
import { TelemetryReporter } from '../telemetryReporter';


interface ShowPreviewSettings {
	readonly sideBySide?: boolean;
	readonly locked?: boolean;
}

async function showPreview(
	webviewManager: MarkdownPreviewManager,
	telemetryReporter: TelemetryReporter,
	uri: ProX-Code.Uri | undefined,
	previewSettings: ShowPreviewSettings,
): Promise<any> {
	let resource = uri;
	if (!(resource instanceof ProX-Code.Uri)) {
		if (ProX-Code.window.activeTextEditor) {
			// we are relaxed and don't check for markdown files
			resource = ProX-Code.window.activeTextEditor.document.uri;
		}
	}

	if (!(resource instanceof ProX-Code.Uri)) {
		if (!ProX-Code.window.activeTextEditor) {
			// this is most likely toggling the preview
			return ProX-Code.commands.executeCommand('markdown.showSource');
		}
		// nothing found that could be shown or toggled
		return;
	}

	const resourceColumn = (ProX-Code.window.activeTextEditor && ProX-Code.window.activeTextEditor.viewColumn) || ProX-Code.ViewColumn.One;
	webviewManager.openDynamicPreview(resource, {
		resourceColumn: resourceColumn,
		previewColumn: previewSettings.sideBySide ? ProX-Code.ViewColumn.Beside : resourceColumn,
		locked: !!previewSettings.locked
	});

	telemetryReporter.sendTelemetryEvent('openPreview', {
		where: previewSettings.sideBySide ? 'sideBySide' : 'inPlace',
		how: (uri instanceof ProX-Code.Uri) ? 'action' : 'pallete'
	});
}

export class ShowPreviewCommand implements Command {
	public readonly id = 'markdown.showPreview';

	public constructor(
		private readonly _webviewManager: MarkdownPreviewManager,
		private readonly _telemetryReporter: TelemetryReporter
	) { }

	public execute(mainUri?: ProX-Code.Uri, allUris?: ProX-Code.Uri[], previewSettings?: DynamicPreviewSettings) {
		for (const uri of Array.isArray(allUris) ? allUris : [mainUri]) {
			showPreview(this._webviewManager, this._telemetryReporter, uri, {
				sideBySide: false,
				locked: previewSettings && previewSettings.locked
			});
		}
	}
}

export class ShowPreviewToSideCommand implements Command {
	public readonly id = 'markdown.showPreviewToSide';

	public constructor(
		private readonly _webviewManager: MarkdownPreviewManager,
		private readonly _telemetryReporter: TelemetryReporter
	) { }

	public execute(uri?: ProX-Code.Uri, previewSettings?: DynamicPreviewSettings) {
		showPreview(this._webviewManager, this._telemetryReporter, uri, {
			sideBySide: true,
			locked: previewSettings && previewSettings.locked
		});
	}
}


export class ShowLockedPreviewToSideCommand implements Command {
	public readonly id = 'markdown.showLockedPreviewToSide';

	public constructor(
		private readonly _webviewManager: MarkdownPreviewManager,
		private readonly _telemetryReporter: TelemetryReporter
	) { }

	public execute(uri?: ProX-Code.Uri) {
		showPreview(this._webviewManager, this._telemetryReporter, uri, {
			sideBySide: true,
			locked: true
		});
	}
}
