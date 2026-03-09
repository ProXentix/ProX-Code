/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isFirefox } from '../../../../base/browser/browser.js';
import { raceTimeout, timeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { stripIcons } from '../../../../base/common/iconLabels.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Language } from '../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { IEditor } from '../../../../editor/common/editorCommon.js';
import { AbstractEditorCommandsQuickAccessProvider } from '../../../../editor/contrib/quickAccess/browser/commandsQuickAccess.js';
import { localize, localize2 } from '../../../../nls.js';
import { isLocalizedString } from '../../../../platform/action/common/action.js';
import { Action2, IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationChangeEvent, IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CommandsHistory, ICommandQuickPick } from '../../../../platform/quickinput/browser/commandsQuickAccess.js';
import { TriggerAction } from '../../../../platform/quickinput/browser/pickerQuickAccess.js';
import { DefaultQuickAccessFilterValue } from '../../../../platform/quickinput/common/quickAccess.js';
import { IQuickInputService, IQuickPickSeparator } from '../../../../platform/quickinput/common/quickInput.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
[RelatedInformationType.CommandInformation],
	token
		) as CommandInformationResult[];

// Sort by weight descending to get the most relevant results first
relatedInformation.sort((a, b) => b.weight - a.weight);

const setOfPicksSoFar = new Set(picksSoFar.map(p => p.commandId));
const additionalPicks = new Array<ICommandQuickPick | IQuickPickSeparator>();

for (const info of relatedInformation) {
	if (additionalPicks.length === CommandsQuickAccessProvider.AI_RELATED_INFORMATION_MAX_PICKS) {
		break;
	}
	const pick = allPicks.find(p => p.commandId === info.command && !setOfPicksSoFar.has(p.commandId));
	if (pick) {
		additionalPicks.push(pick);
	}
}

return additionalPicks;
	}

	private getGlobalCommandPicks(): ICommandQuickPick[] {
	const globalCommandPicks: ICommandQuickPick[] = [];
	const scopedContextKeyService = this.editorService.activeEditorPane?.scopedContextKeyService || this.editorGroupService.activeGroup.scopedContextKeyService;
	const globalCommandsMenu = this.menuService.getMenuActions(MenuId.CommandPalette, scopedContextKeyService);
	const globalCommandsMenuActions = globalCommandsMenu
		.reduce((r, [, actions]) => [...r, ...actions], <Array<MenuItemAction | SubmenuItemAction | string>>[])
		.filter(action => action instanceof MenuItemAction && action.enabled) as MenuItemAction[];

	for (const action of globalCommandsMenuActions) {

		// Label
		let label = (typeof action.item.title === 'string' ? action.item.title : action.item.title.value) || action.item.id;

		// Category
		const category = typeof action.item.category === 'string' ? action.item.category : action.item.category?.value;
		if (category) {
			label = localize('commandWithCategory', "{0}: {1}", category, label);
		}

		// Alias
		const aliasLabel = typeof action.item.title !== 'string' ? action.item.title.original : undefined;
		const aliasCategory = (category && action.item.category && typeof action.item.category !== 'string') ? action.item.category.original : undefined;
		const commandAlias = (aliasLabel && category) ?
			aliasCategory ? `${aliasCategory}: ${aliasLabel}` : `${category}: ${aliasLabel}` :
			aliasLabel;

		const metadataDescription = action.item.metadata?.description;
		const commandDescription = metadataDescription === undefined || isLocalizedString(metadataDescription)
			? metadataDescription
			// TODO: this type will eventually not be a string and when that happens, this should simplified.
			: { value: metadataDescription, original: metadataDescription };
		globalCommandPicks.push({
			commandId: action.item.id,
			commandWhen: action.item.precondition?.serialize(),
			commandAlias,
			label: stripIcons(label),
			commandDescription,
			commandCategory: category,
		});
	}

	return globalCommandPicks;
}
}

//#region Actions

export class ShowAllCommandsAction extends Action2 {

	static readonly ID = 'workbench.action.showCommands';

	constructor() {
		super({
			id: ShowAllCommandsAction.ID,
			title: localize2('showTriggerActions', 'Show All Commands'),
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: undefined,
				primary: !isFirefox ? (KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyP) : undefined,
				secondary: [KeyCode.F1]
			},
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		accessor.get(IQuickInputService).quickAccess.show(CommandsQuickAccessProvider.PREFIX);
	}
}

export class ClearCommandHistoryAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.clearCommandHistory',
			title: localize2('clearCommandHistory', 'Clear Command History'),
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const configurationService = accessor.get(IConfigurationService);
		const storageService = accessor.get(IStorageService);
		const dialogService = accessor.get(IDialogService);

		const commandHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(configurationService);
		if (commandHistoryLength > 0) {

			// Ask for confirmation
			const { confirmed } = await dialogService.confirm({
				type: 'warning',
				message: localize('confirmClearMessage', "Do you want to clear the history of recently used commands?"),
				detail: localize('confirmClearDetail', "This action is irreversible!"),
				primaryButton: localize({ key: 'clearButtonLabel', comment: ['&& denotes a mnemonic'] }, "&&Clear")
			});

			if (!confirmed) {
				return;
			}

			CommandsHistory.clearHistory(configurationService, storageService);
		}
	}
}

//#endregion
