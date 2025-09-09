/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { CommandManager } from '../commandManager';


// Copied from markdown language service
export enum DiagnosticCode {
	link_noSuchReferences = 'link.no-such-reference',
	link_noSuchHeaderInOwnFile = 'link.no-such-header-in-own-file',
	link_noSuchFile = 'link.no-such-file',
	link_noSuchHeaderInFile = 'link.no-such-header-in-file',
}


class AddToIgnoreLinksQuickFixProvider implements ProX-Code.CodeActionProvider {

	private static readonly _addToIgnoreLinksCommandId = '_markdown.addToIgnoreLinks';

	private static readonly _metadata: ProX-Code.CodeActionProviderMetadata = {
		providedCodeActionKinds: [
			ProX-Code.CodeActionKind.QuickFix
		],
	};

	public static register(selector: ProX-Code.DocumentSelector, commandManager: CommandManager): ProX-Code.Disposable {
		const reg = ProX-Code.languages.registerCodeActionsProvider(selector, new AddToIgnoreLinksQuickFixProvider(), AddToIgnoreLinksQuickFixProvider._metadata);
		const commandReg = commandManager.register({
			id: AddToIgnoreLinksQuickFixProvider._addToIgnoreLinksCommandId,
			execute(resource: ProX-Code.Uri, path: string) {
				const settingId = 'validate.ignoredLinks';
				const config = ProX-Code.workspace.getConfiguration('markdown', resource);
				const paths = new Set(config.get<string[]>(settingId, []));
				paths.add(path);
				config.update(settingId, [...paths], ProX-Code.ConfigurationTarget.WorkspaceFolder);
			}
		});
		return ProX-Code.Disposable.from(reg, commandReg);
	}

	provideCodeActions(document: ProX-Code.TextDocument, _range: ProX-Code.Range | ProX-Code.Selection, context: ProX-Code.CodeActionContext, _token: ProX-Code.CancellationToken): ProX-Code.ProviderResult<(ProX-Code.CodeAction | ProX-Code.Command)[]> {
		const fixes: ProX-Code.CodeAction[] = [];

		for (const diagnostic of context.diagnostics) {
			switch (diagnostic.code) {
				case DiagnosticCode.link_noSuchReferences:
				case DiagnosticCode.link_noSuchHeaderInOwnFile:
				case DiagnosticCode.link_noSuchFile:
				case DiagnosticCode.link_noSuchHeaderInFile: {
					const hrefText = (diagnostic as any).data?.hrefText;
					if (hrefText) {
						const fix = new ProX-Code.CodeAction(
							ProX-Code.l10n.t("Exclude '{0}' from link validation.", hrefText),
							ProX-Code.CodeActionKind.QuickFix);

						fix.command = {
							command: AddToIgnoreLinksQuickFixProvider._addToIgnoreLinksCommandId,
							title: '',
							arguments: [document.uri, hrefText],
						};
						fixes.push(fix);
					}
					break;
				}
			}
		}

		return fixes;
	}
}

function registerMarkdownStatusItem(selector: ProX-Code.DocumentSelector, commandManager: CommandManager): ProX-Code.Disposable {
	const statusItem = ProX-Code.languages.createLanguageStatusItem('markdownStatus', selector);

	const enabledSettingId = 'validate.enabled';
	const commandId = '_markdown.toggleValidation';

	const commandSub = commandManager.register({
		id: commandId,
		execute: (enabled: boolean) => {
			ProX-Code.workspace.getConfiguration('markdown').update(enabledSettingId, enabled);
		}
	});

	const update = () => {
		const activeDoc = ProX-Code.window.activeTextEditor?.document;
		const markdownDoc = activeDoc?.languageId === 'markdown' ? activeDoc : undefined;

		const enabled = ProX-Code.workspace.getConfiguration('markdown', markdownDoc).get(enabledSettingId);
		if (enabled) {
			statusItem.text = ProX-Code.l10n.t('Markdown link validation enabled');
			statusItem.command = {
				command: commandId,
				arguments: [false],
				title: ProX-Code.l10n.t('Disable'),
				tooltip: ProX-Code.l10n.t('Disable validation of Markdown links'),
			};
		} else {
			statusItem.text = ProX-Code.l10n.t('Markdown link validation disabled');
			statusItem.command = {
				command: commandId,
				arguments: [true],
				title: ProX-Code.l10n.t('Enable'),
				tooltip: ProX-Code.l10n.t('Enable validation of Markdown links'),
			};
		}
	};
	update();

	return ProX-Code.Disposable.from(
		statusItem,
		commandSub,
		ProX-Code.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('markdown.' + enabledSettingId)) {
				update();
			}
		}),
	);
}

export function registerDiagnosticSupport(
	selector: ProX-Code.DocumentSelector,
	commandManager: CommandManager,
): ProX-Code.Disposable {
	return ProX-Code.Disposable.from(
		AddToIgnoreLinksQuickFixProvider.register(selector, commandManager),
		registerMarkdownStatusItem(selector, commandManager),
	);
}
