/**
 * ProX-Code Extensions Contribution
 */

// import { } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
// import { } from '../../../../base/common/platform.js';
import { localize, } from '../../../../nls.js';
import { Action2, IAction2Options, IMenuItem, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';

import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';

import { ExtensionGalleryManifestStatus, IExtensionGalleryManifest, IExtensionGalleryManifestService } from '../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionStorageService } from '../../../../platform/extensionManagement/common/extensionStorage.js';
import { ExtensionType } from '../../../../platform/extensions/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Extensions, IQuickAccessRegistry } from '../../../../platform/quickinput/common/quickAccess.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IUserDataProfilesService } from '../../../../platform/userDataProfile/common/userDataProfile.js';
// import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { Extensions as ConfigurationMigrationExtensions, IConfigurationMigrationRegistry } from '../../../common/configuration.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, registerWorkbenchContribution2, Extensions as WorkbenchExtensions, WorkbenchPhase } from '../../../common/contributions.js';
// import { EditorExtensions } from '../../../common/editor.js';
import { ViewContainer } from '../../../common/views.js';
// import { } from '../../../services/editor/common/editorService.js';
import { IPublisherInfo, IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import {  IExtensionManagementServerService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionRecommendationsService } from '../../../services/extensionRecommendations/common/extensionRecommendations.js';
// import { } from '../../../services/host/browser/host.js';
// import { } from '../../../services/lifecycle/common/lifecycle.js';
// import { } from '../../../services/preferences/common/preferences.js';

// import { } from '../../webview/browser/webview.js';
import {  AutoUpdateConfigurationKey, CONTEXT_EXTENSIONS_GALLERY_STATUS, CONTEXT_HAS_GALLERY,     IExtensionsWorkbenchService, } from '../common/extensions.js';
import { ExtensionsConfigurationSchema, ExtensionsConfigurationSchemaId } from '../common/extensionsFileTemplate.js';
// import { ExtensionsInput } from '../common/extensionsInput.js';
// [REMOVED - module not available] import { SearchExtensionsTool, SearchExtensionsToolData } from '../common/searchExtensionsTool.js';

// import { ShowRuntimeExtensionsAction } from './abstractRuntimeExtensionsEditor.js';
// import { ExtensionEditor } from './extensionEditor.js';
// import { } from './extensionEnablementWorkspaceTrustTransitionParticipant.js';
import { ExtensionRecommendationNotificationService } from './extensionRecommendationNotificationService.js';
import { ExtensionRecommendationsService } from './extensionRecommendationsService.js';
// import { } from './extensionsActivationProgress.js';
// import { } from './extensionsCompletionItemsProvider.js';
// import { } from './extensionsDependencyChecker.js';
import { clearSearchResultsIcon, configureRecommendedIcon, extensionsViewIcon, filterIcon, installWorkspaceRecommendedIcon, refreshIcon } from './extensionsIcons.js';
import { InstallExtensionQuickAccessProvider, } from './extensionsQuickAccess.js';
import { BuiltInExtensionsContext, ExtensionMarketplaceStatusUpdater, ExtensionsSearchValueContext, ExtensionsSortByContext, ExtensionsViewletViewsContribution, MaliciousExtensionChecker, RecommendedExtensionsContext, SearchHasTextContext, SearchMarketplaceExtensionsContext, StatusUpdater } from './extensionsViewlet.js';
import { ExtensionsWorkbenchService } from './extensionsWorkbenchService.js';
import './media/extensionManagement.css';
// import { } from './unsupportedExtensionsMigrationContribution.js';

// Singletons
registerSingleton(IExtensionsWorkbenchService, ExtensionsWorkbenchService, InstantiationType.Eager /* Auto updates extensions */);
registerSingleton(IExtensionRecommendationNotificationService, ExtensionRecommendationNotificationService, InstantiationType.Delayed);
registerSingleton(IExtensionRecommendationsService, ExtensionRecommendationsService, InstantiationType.Eager /* Prompts recommendations in the background */);

// Quick Access Disabled

// Editor disabled for ProX-Code

// Contexts
export const CONTEXT_HAS_LOCAL_SERVER = new RawContextKey<boolean>('hasLocalServer', false);
export const CONTEXT_HAS_REMOTE_SERVER = new RawContextKey<boolean>('hasRemoteServer', false);
export const CONTEXT_HAS_WEB_SERVER = new RawContextKey<boolean>('hasWebServer', false);

// Extensions View Container - Disabled for ProX-Code (removed from Sidebar)
export let VIEW_CONTAINER: ViewContainer = {} as any;

type IExtensionActionOptions = IAction2Options & {
	menuTitles?: { [id: string]: string };
	run(accessor: ServicesAccessor, ...args: unknown[]): Promise<any>;
};

class ExtensionsContributions extends Disposable implements IWorkbenchContribution {

	constructor(
		@IExtensionManagementService private readonly _extensionManagementService: IExtensionManagementService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService,
		@IExtensionGalleryManifestService private readonly extensionGalleryManifestService: IExtensionGalleryManifestService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IExtensionsWorkbenchService private readonly _extensionsWorkbenchService: IExtensionsWorkbenchService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IProductService private readonly _productService: IProductService,
	) {
		super();
		const hasLocalServerContext = CONTEXT_HAS_LOCAL_SERVER.bindTo(contextKeyService);
		if (this.extensionManagementServerService.localExtensionManagementServer) {
			hasLocalServerContext.set(true);
		}

		const hasRemoteServerContext = CONTEXT_HAS_REMOTE_SERVER.bindTo(contextKeyService);
		if (this.extensionManagementServerService.remoteExtensionManagementServer) {
			hasRemoteServerContext.set(true);
		}

		const hasWebServerContext = CONTEXT_HAS_WEB_SERVER.bindTo(contextKeyService);
		if (this.extensionManagementServerService.webExtensionManagementServer) {
			hasWebServerContext.set(true);
		}

		this.updateExtensionGalleryStatusContexts();
		this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifestStatus(() => this.updateExtensionGalleryStatusContexts()));
		extensionGalleryManifestService.getExtensionGalleryManifest()
			.then(extensionGalleryManifest => {
				this.updateGalleryCapabilitiesContexts(extensionGalleryManifest);
				this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest(manifest => this.updateGalleryCapabilitiesContexts(manifest)));
			});
		this.registerGlobalActions();
		this.registerContextMenuActions();
	}

	private async updateExtensionGalleryStatusContexts(): Promise<void> {
		CONTEXT_HAS_GALLERY.bindTo(this.contextKeyService).set(this.extensionGalleryManifestService.extensionGalleryManifestStatus === ExtensionGalleryManifestStatus.Available);
		CONTEXT_EXTENSIONS_GALLERY_STATUS.bindTo(this.contextKeyService).set(this.extensionGalleryManifestService.extensionGalleryManifestStatus);
	}

	private async updateGalleryCapabilitiesContexts(extensionGalleryManifest: IExtensionGalleryManifest | null): Promise<void> {
		if (this.extensionManagementServerService.localExtensionManagementServer
			|| this.extensionManagementServerService.remoteExtensionManagementServer
			|| this.extensionManagementServerService.webExtensionManagementServer
		) {
			Registry.as<IQuickAccessRegistry>(Extensions.Quickaccess).registerQuickAccessProvider({
				ctor: InstallExtensionQuickAccessProvider,
				prefix: InstallExtensionQuickAccessProvider.PREFIX,
				placeholder: localize('installExtensionQuickAccessPlaceholder', "Type the name of an extension to install or search."),
				helpEntries: [{ description: localize('installExtensionQuickAccessHelp', "Install or Search Extensions") }]
			});
		}
	}

	// Global actions
	private registerGlobalActions(): void {
		// Disabled for ProX-Code
	}
	// Extension Context Menu
	private registerContextMenuActions(): void {
		// Disabled for ProX-Code
	}

	private registerExtensionAction(extensionActionOptions: IExtensionActionOptions): IDisposable {
		const menus = extensionActionOptions.menu ? Array.isArray(extensionActionOptions.menu) ? extensionActionOptions.menu : [extensionActionOptions.menu] : [];
		let menusWithOutTitles: ({ id: MenuId } & Omit<IMenuItem, 'command'>)[] = [];
		const menusWithTitles: { id: MenuId; item: IMenuItem }[] = [];
		if (extensionActionOptions.menuTitles) {
			for (let index = 0; index < menus.length; index++) {
				const menu = menus[index];
				const menuTitle = extensionActionOptions.menuTitles[menu.id.id];
				if (menuTitle) {
					menusWithTitles.push({ id: menu.id, item: { ...menu, command: { id: extensionActionOptions.id, title: menuTitle } } });
				} else {
					menusWithOutTitles.push(menu);
				}
			}
		} else {
			menusWithOutTitles = menus;
		}
		const disposables = new DisposableStore();
		disposables.add(registerAction2(class extends Action2 {
			constructor() {
				super({
					...extensionActionOptions,
					menu: menusWithOutTitles
				});
			}
			run(accessor: ServicesAccessor, ...args: unknown[]): Promise<any> {
				return extensionActionOptions.run(accessor, ...args);
			}
		}));
		if (menusWithTitles.length) {
			disposables.add(MenuRegistry.appendMenuItems(menusWithTitles));
		}
		return disposables;
	}

}

class ExtensionStorageCleaner implements IWorkbenchContribution {

	constructor(
		@IExtensionManagementService extensionManagementService: IExtensionManagementService,
		@IStorageService storageService: IStorageService,
	) {
		ExtensionStorageService.removeOutdatedExtensionVersions(extensionManagementService, storageService);
	}
}

class TrustedPublishersInitializer implements IWorkbenchContribution {
	constructor(
		@IWorkbenchExtensionManagementService extensionManagementService: IWorkbenchExtensionManagementService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
		@IProductService productService: IProductService,
		@IStorageService storageService: IStorageService,
	) {
		const trustedPublishersInitStatusKey = 'trusted-publishers-init-migration';
		if (!storageService.get(trustedPublishersInitStatusKey, StorageScope.APPLICATION)) {
			for (const profile of userDataProfilesService.profiles) {
				extensionManagementService.getInstalled(ExtensionType.User, profile.extensionsResource)
					.then(async extensions => {
						const trustedPublishers = new Map<string, IPublisherInfo>();
						for (const extension of extensions) {
							if (!extension.publisherDisplayName) {
								continue;
							}
							const publisher = extension.manifest.publisher.toLowerCase();
							if (productService.trustedExtensionPublishers?.includes(publisher)
								|| (extension.publisherDisplayName && productService.trustedExtensionPublishers?.includes(extension.publisherDisplayName.toLowerCase()))) {
								continue;
							}
							trustedPublishers.set(publisher, { publisher, publisherDisplayName: extension.publisherDisplayName });
						}
						if (trustedPublishers.size) {
							extensionManagementService.trustPublishers(...trustedPublishers.values());
						}
						storageService.store(trustedPublishersInitStatusKey, 'true', StorageScope.APPLICATION, StorageTarget.MACHINE);
					});
			}
		}
	}
}


const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
/*
workbenchRegistry.registerWorkbenchContribution(ExtensionsContributions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(StatusUpdater, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(MaliciousExtensionChecker, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(KeymapExtensions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionsViewletViewsContribution, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionActivationProgress, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(ExtensionDependencyChecker, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(ExtensionEnablementWorkspaceTrustTransitionParticipant, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionsCompletionItemsProvider, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(UnsupportedExtensionsMigrationContrib, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(TrustedPublishersInitializer, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(ExtensionMarketplaceStatusUpdater, LifecyclePhase.Eventually);
if (isWeb) {
	workbenchRegistry.registerWorkbenchContribution(ExtensionStorageCleaner, LifecyclePhase.Eventually);
}
*/



// Running Extensions disabled for ProX-Code
// registerAction2(ShowRuntimeExtensionsAction);



Registry.as<IConfigurationMigrationRegistry>(ConfigurationMigrationExtensions.ConfigurationMigration)
	.registerConfigurationMigrations([{
		key: AutoUpdateConfigurationKey,
		migrateFn: (value, accessor) => {
			if (value === 'onlySelectedExtensions') {
				return { value: false };
			}
			return [];
		}
	}]);
