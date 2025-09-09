/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { SimpleBrowserManager } from './simpleBrowserManager';
import { SimpleBrowserView } from './simpleBrowserView';

declare class URL {
	constructor(input: string, base?: string | URL);
	hostname: string;
}

const openApiCommand = 'simpleBrowser.api.open';
const showCommand = 'simpleBrowser.show';

const enabledHosts = new Set<string>([
	'localhost',
	// localhost IPv4
	'127.0.0.1',
	// localhost IPv6
	'[0:0:0:0:0:0:0:1]',
	'[::1]',
	// all interfaces IPv4
	'0.0.0.0',
	// all interfaces IPv6
	'[0:0:0:0:0:0:0:0]',
	'[::]'
]);

const openerId = 'simpleBrowser.open';

export function activate(context: ProX-Code.ExtensionContext) {

	const manager = new SimpleBrowserManager(context.extensionUri);
	context.subscriptions.push(manager);

	context.subscriptions.push(ProX-Code.window.registerWebviewPanelSerializer(SimpleBrowserView.viewType, {
		deserializeWebviewPanel: async (panel, state) => {
			manager.restore(panel, state);
		}
	}));

	context.subscriptions.push(ProX-Code.commands.registerCommand(showCommand, async (url?: string) => {
		if (!url) {
			url = await ProX-Code.window.showInputBox({
				placeHolder: ProX-Code.l10n.t("https://example.com"),
				prompt: ProX-Code.l10n.t("Enter url to visit")
			});
		}

		if (url) {
			manager.show(url);
		}
	}));

	context.subscriptions.push(ProX-Code.commands.registerCommand(openApiCommand, (url: ProX-Code.Uri, showOptions?: {
		preserveFocus?: boolean;
		viewColumn: ProX-Code.ViewColumn;
	}) => {
		manager.show(url, showOptions);
	}));

	context.subscriptions.push(ProX-Code.window.registerExternalUriOpener(openerId, {
		canOpenExternalUri(uri: ProX-Code.Uri) {
			// We have to replace the IPv6 hosts with IPv4 because URL can't handle IPv6.
			const originalUri = new URL(uri.toString(true));
			if (enabledHosts.has(originalUri.hostname)) {
				return isWeb()
					? ProX-Code.ExternalUriOpenerPriority.Default
					: ProX-Code.ExternalUriOpenerPriority.Option;
			}

			return ProX-Code.ExternalUriOpenerPriority.None;
		},
		openExternalUri(resolveUri: ProX-Code.Uri) {
			return manager.show(resolveUri, {
				viewColumn: ProX-Code.window.activeTextEditor ? ProX-Code.ViewColumn.Beside : ProX-Code.ViewColumn.Active
			});
		}
	}, {
		schemes: ['http', 'https'],
		label: ProX-Code.l10n.t("Open in simple browser"),
	}));
}

function isWeb(): boolean {
	// @ts-expect-error
	return typeof navigator !== 'undefined' && ProX-Code.env.uiKind === ProX-Code.UIKind.Web;
}
