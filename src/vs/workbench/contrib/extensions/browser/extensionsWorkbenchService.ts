/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { IMarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IPager, singlePagePager } from '../../../../base/common/paging.js';
import { URI } from '../../../../base/common/uri.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IExtensionGalleryService, IExtensionIdentifier, IExtensionInfo, IExtensionManagementService, IExtensionQueryOptions, IGalleryExtension, ILocalExtension, IQueryOptions, InstallOptions } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionType, IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { EnablementState, IExtensionManagementServer, IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { ExtensionRuntimeState, ExtensionState, IExtension, IExtensionsWorkbenchService, InstallExtensionOptions } from '../common/extensions.js';

class BuiltinExtensionWrapper implements IExtension {
	readonly type: ExtensionType = ExtensionType.System;
	readonly isBuiltin: boolean = true;
	readonly isWorkspaceScoped: boolean = false;
	readonly state: ExtensionState = ExtensionState.Installed;
	readonly pinned: boolean = false;
	readonly private: boolean = false;
	readonly preRelease: boolean = false;
	readonly isPreReleaseVersion: boolean = false;
	readonly hasPreReleaseVersion: boolean = false;
	readonly hasReleaseVersion: boolean = true;
	readonly outdated: boolean = false;
	readonly outdatedTargetPlatform: boolean = false;
	readonly runtimeState: ExtensionRuntimeState | undefined = undefined;
	readonly tags: readonly string[] = [];
	readonly categories: readonly string[] = [];
	readonly dependencies: string[] = [];
	readonly extensionPack: string[] = [];
	readonly telemetryData: any = undefined;
	readonly preview: boolean = false;
	readonly isMalicious: boolean | undefined = undefined;
	readonly maliciousInfoLink: string | undefined = undefined;
	readonly gallery?: IGalleryExtension = undefined;

	constructor(
		readonly local: ILocalExtension,
		private readonly enablementService: IWorkbenchExtensionEnablementService
	) { }

	get name(): string { return this.local.manifest.name; }
	get displayName(): string { return this.local.manifest.displayName || this.local.manifest.name; }
	get identifier(): IExtensionIdentifier { return this.local.identifier; }
	get publisher(): string { return this.local.manifest.publisher; }
	get publisherDisplayName(): string { return this.local.manifest.publisher; }
	get version(): string { return this.local.manifest.version; }
	get latestVersion(): string { return this.local.manifest.version; }
	get description(): string { return this.local.manifest.description || ''; }
	get enablementState(): EnablementState { return this.enablementService.getEnablementState(this.local); }

	async getManifest(_token: CancellationToken): Promise<IExtensionManifest | null> {
		return this.local.manifest;
	}

	hasReadme(): boolean { return false; }
	async getReadme(_token: CancellationToken): Promise<string> { return ''; }
	hasChangelog(): boolean { return false; }
	async getChangelog(_token: CancellationToken): Promise<string> { return ''; }
}

export class ExtensionsWorkbenchService extends Disposable implements IExtensionsWorkbenchService {
	declare readonly _serviceBrand: undefined;

	private readonly _onChange = this._register(new Emitter<IExtension | undefined>());
	readonly onChange: Event<IExtension | undefined> = this._onChange.event;

	private readonly _onReset = this._register(new Emitter<void>());
	readonly onReset: Event<void> = this._onReset.event;

	private _local: IExtension[] = [];
	get local(): IExtension[] { return this._local; }
	get installed(): IExtension[] { return this._local; }
	get outdated(): IExtension[] { return []; }

	readonly whenInitialized: Promise<void>;

	constructor(
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService,
	) {
		super();

		this.whenInitialized = this.queryLocal().then(() => undefined);

		this._register(this.extensionManagementService.onDidInstallExtensions(() => this.queryLocal()));
		this._register(this.extensionManagementService.onDidUninstallExtension(() => this.queryLocal()));
		this._register(this.extensionEnablementService.onEnablementChanged(() => this._onChange.fire(undefined)));
	}

	async queryLocal(_server?: IExtensionManagementServer): Promise<IExtension[]> {
		const installed = await this.extensionManagementService.getInstalled();
		this._local = installed.map(local => new BuiltinExtensionWrapper(local, this.extensionEnablementService));
		this._onChange.fire(undefined);
		return this._local;
	}

	async queryGallery(_options?: any, _token?: CancellationToken): Promise<IPager<IExtension>> {
		return singlePagePager([]);
	}

	async getExtensions(_extensionInfos: IExtensionInfo[], _options?: any, _token?: CancellationToken): Promise<IExtension[]> {
		return [];
	}

	async getResourceExtensions(_locations: URI[], _isWorkspaceScoped: boolean): Promise<IExtension[]> {
		return [];
	}

	async canInstall(_extension: IExtension): Promise<true | IMarkdownString> {
		return true;
	}

	async install(target: string | URI | IExtension, _installOptions?: InstallExtensionOptions, _progressLocation?: ProgressLocation | string): Promise<IExtension> {
		if (target instanceof URI) {
			const local = await this.extensionManagementService.install(target);
			const ext = new BuiltinExtensionWrapper(local, this.extensionEnablementService);
			await this.queryLocal();
			return ext;
		}
		throw new Error('Marketplace installations are disabled in ProX-Code.');
	}

	async installInServer(_extension: IExtension, _server: IExtensionManagementServer, _installOptions?: InstallOptions): Promise<void> { }

	async downloadVSIX(_extension: string, _versionKind: 'prerelease' | 'release' | 'any'): Promise<void> { }

	async uninstall(extension: IExtension): Promise<void> {
		if (extension.local) {
			await this.extensionManagementService.uninstall(extension.local);
			await this.queryLocal();
		}
	}

	async reinstall(extension: IExtension): Promise<IExtension> {
		return extension;
	}

	canSetLanguage(_extension: IExtension): boolean {
		return false;
	}

	async setLanguage(_extension: IExtension): Promise<void> { }

	async setEnablement(extensions: IExtension | IExtension[], state: EnablementState): Promise<void> {
		const list = Array.isArray(extensions) ? extensions : [extensions];
		const locals = list.map(e => e.local).filter((l): l is ILocalExtension => !!l);
		await this.extensionEnablementService.setEnablement(locals, state);
	}

	async open(_extension: IExtension | string, _options?: any): Promise<any> {
		// Extension details viewer disabled in ProX-Code
		return undefined;
	}

	async openSearch(_query: string): Promise<void> {
		// Extensions sidebar search disabled in ProX-Code
	}

	async checkForUpdates(): Promise<void> { }

	async updateAll(): Promise<void> { }

	isExtensionPinned(_extension: IExtension): boolean {
		return false;
	}

	async togglePinExtension(_extension: IExtension): Promise<void> { }
}
