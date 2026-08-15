/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewContainersRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../common/views.js';

// ---------------------------------------------------------------------------
// 1. Icon — Codicon.run renders as a filled play triangle (▶)
// ---------------------------------------------------------------------------

export const proxplRunViewIcon = registerIcon(
	'proxpl-run-view-icon',
	Codicon.run,
	localize('proxplRunViewIcon', 'View icon of the ProXPL Run view.')
);

// ---------------------------------------------------------------------------
// 2. View Container ID
// ---------------------------------------------------------------------------

export const PROXPL_RUN_VIEWLET_ID = 'workbench.view.proxpl.run';

// ---------------------------------------------------------------------------
// 3. Register the Activity Bar entry (Sidebar, order 3)
//    order 3 places it directly after Source Control (order 2).
//    openCommandActionDescriptor id = 'proxpl.runView' opens the sidebar pane;
//    the actual run logic is in the proxpl.run extension command (section 4).
// ---------------------------------------------------------------------------

Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: PROXPL_RUN_VIEWLET_ID,
		title: localize2('proxplRun', 'ProXPL Run'),
		icon: proxplRunViewIcon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [PROXPL_RUN_VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
		order: 3,
		alwaysUseContainerInfo: true,
		openCommandActionDescriptor: {
			id: 'proxpl.runView',
			mnemonicTitle: localize({ key: 'miProXPLRun', comment: ['&& denotes a mnemonic'] }, '&&ProXPL Run'),
			order: 3,
		},
	},
	ViewContainerLocation.Sidebar
);

// ---------------------------------------------------------------------------
// 4. ProXPL: Run — Command Palette + run-on-click delegate
//    Delegates to the extension-contributed 'proxpl.run' command which handles:
//      • prox.toml project detection (project-level execution via `prm run`)
//      • active .prox / .pxpl file detection (file-level via `prm run "<path>"`)
//      • PRM CLI availability check with installation docs link
//      • auto-save before execution
//      • reuse/create "ProXPL" integrated terminal
//      • clear user-facing error when no ProXPL file is active
// ---------------------------------------------------------------------------

const PROXPL_CATEGORY = localize2('proxplCategory', 'ProXPL');

registerAction2(class ProxplRunAction extends Action2 {
	constructor() {
		super({
			id: 'proxpl.runFile',
			title: { value: localize('proxplRunTitle', 'Run'), original: 'Run' },
			category: PROXPL_CATEGORY,
			icon: proxplRunViewIcon,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('proxpl.run');
	}
});

// ---------------------------------------------------------------------------
// 5. ProXPL: Build
// ---------------------------------------------------------------------------

registerAction2(class ProxplBuildAction extends Action2 {
	constructor() {
		super({
			id: 'proxpl.buildFile',
			title: { value: localize('proxplBuildTitle', 'Build'), original: 'Build' },
			category: PROXPL_CATEGORY,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('proxpl.build');
	}
});

// ---------------------------------------------------------------------------
// 6. ProXPL: Debug
// ---------------------------------------------------------------------------

registerAction2(class ProxplDebugAction extends Action2 {
	constructor() {
		super({
			id: 'proxpl.debugFile',
			title: { value: localize('proxplDebugTitle', 'Debug'), original: 'Debug' },
			category: PROXPL_CATEGORY,
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const commandService = accessor.get(ICommandService);
		await commandService.executeCommand('proxpl.debug');
	}
});

// ---------------------------------------------------------------------------
// 7. Right-click context menu on the ProXPL Run Activity Bar button
// ---------------------------------------------------------------------------

MenuRegistry.appendMenuItem(MenuId.ViewContainerTitleContext, {
	command: { id: 'proxpl.runFile', title: localize('proxplRunMenu', 'Run ProXPL') },
	when: `viewContainer == ${PROXPL_RUN_VIEWLET_ID}`,
	group: '1_proxpl',
	order: 1,
});

MenuRegistry.appendMenuItem(MenuId.ViewContainerTitleContext, {
	command: { id: 'proxpl.buildFile', title: localize('proxplBuildMenu', 'Build ProXPL') },
	when: `viewContainer == ${PROXPL_RUN_VIEWLET_ID}`,
	group: '1_proxpl',
	order: 2,
});

MenuRegistry.appendMenuItem(MenuId.ViewContainerTitleContext, {
	command: { id: 'proxpl.debugFile', title: localize('proxplDebugMenu', 'Debug ProXPL') },
	when: `viewContainer == ${PROXPL_RUN_VIEWLET_ID}`,
	group: '1_proxpl',
	order: 3,
});
