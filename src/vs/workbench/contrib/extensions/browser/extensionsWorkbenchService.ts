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
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IExtensionGalleryService, IExtensionIdentifier, IExtensionInfo, IExtensionManagementService, IExtensionQueryOptions, IGalleryExtension, ILocalExtension, IQueryOptions, InstallExtensionResult, InstallOptions } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { ExtensionType, IExtensionManifest } from '../../../../platform/extensions/common/extensions.js';
import { ProgressLocation } from '../../../../platform/progress/common/progress.js';
import { EnablementState, IExtensionManagementServer, IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { AutoUpdateConfigurationKey, AutoUpdateConfigurationValue, ExtensionRuntimeState, ExtensionState, IExtension, IExtensionsNotification, IExtensionsWorkbenchService, InstallExtensionOptions } from '../common/extensions.js';

export class Extension implements IExtension {
	readonly type: ExtensionType = ExtensionType.User;
	readonly isBuiltin: boolean = false;
	readonly isWorkspaceScoped: boolean = false;
	readonly state: ExtensionState;
	readonly name: string;
	readonly displayName: string;
	readonly identifier: IExtensionIdentifier;
	readonly publisher: string;
	readonly publisherDisplayName: string;
	readonly version: string;
	readonly private: boolean = false;
	readonly latestVersion: string;
	readonly preRelease: boolean = false;
	readonly isPreReleaseVersion: boolean = false;
	readonly hasPreReleaseVersion: boolean = false;
	readonly hasReleaseVersion: boolean = true;
	readonly description: string;
	readonly installCount?: number;
	readonly rating?: number;
	readonly ratingCount?: number;
	readonly outdated: boolean;
	readonly outdatedTargetPlatform: boolean = false;
	readonly runtimeState: ExtensionRuntimeState | undefined = undefined;
	readonly enablementState: EnablementState = EnablementState.EnabledGlobally;
	readonly tags: readonly string[] = [];
	readonly categories: readonly string[] = [];
	readonly dependencies: string[] = [];
	readonly extensionPack: string[] = [];
	readonly telemetryData: any = undefined;
	readonly preview: boolean = false;
	readonly pinned: boolean = false;
	readonly iconUrl?: string;
	readonly iconUrlFallback?: string;
	readonly isMalicious: boolean | undefined = undefined;
	readonly maliciousInfoLink: string | undefined = undefined;
	readonly missingFromGallery?: boolean = false;
	readonly local?: ILocalExtension;
	gallery?: IGalleryExtension;
	readonly resourceExtension?: any;
	readonly deprecationInfo?: undefined;
	readonly server?: undefined;

	constructor(
		state: () => ExtensionState,
		_isBuiltin: (() => boolean | undefined) | undefined,
		localOrPublisher?: ILocalExtension | string,
		gallery?: IGalleryExtension,
		resourceExtension?: any,
		..._rest: any[]
	) {
		this.state = state();
		this.local = typeof localOrPublisher === 'string' ? undefined : localOrPublisher;
		this.gallery = gallery;
		this.resourceExtension = resourceExtension;
		this.name = this.local?.manifest.name ?? this.gallery?.name ?? 'extension';
		this.displayName = this.local?.manifest.displayName ?? this.gallery?.displayName ?? this.name;
		this.identifier = this.local?.identifier ?? { id: this.gallery?.identifier?.id ?? this.name, uuid: this.gallery?.identifier?.uuid ?? '00000000-0000-0000-0000-000000000000' };
		this.publisher = this.local?.manifest.publisher ?? this.gallery?.publisher ?? 'pub';
		this.publisherDisplayName = this.local?.publisherDisplayName ?? this.gallery?.publisherDisplayName ?? this.publisher;
		this.version = this.local?.manifest.version ?? this.gallery?.version ?? '0.0.0';
		this.latestVersion = this.version;
		this.description = this.local?.manifest.description ?? this.gallery?.description ?? '';
		this.outdated = !!(this.local && this.gallery && this.compareVersions(this.local.manifest.version, this.gallery.version) < 0);
	}

	private compareVersions(a: string, b: string): number {
		const [pa, pb] = [a.split('.').map(Number), b.split('.').map(Number)];
		const len = Math.max(pa.length, pb.length);
		for (let i = 0; i < len; i++) {
			const va = pa[i] ?? 0;
			const vb = pb[i] ?? 0;
			if (va !== vb) {
				return va < vb ? -1 : 1;
			}
		}
		return 0;
	}

	async getManifest(_token: CancellationToken): Promise<IExtensionManifest | null> {
		return this.local?.manifest ?? null;
	}
	hasReadme(): boolean { return false; }
	async getReadme(_token: CancellationToken): Promise<string> { return ''; }
	hasChangelog(): boolean { return false; }
	async getChangelog(_token: CancellationToken): Promise<string> { return ''; }
}

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

	private readonly _onDidChangeExtensionsNotification = this._register(new Emitter<IExtensionsNotification | undefined>());
	readonly onDidChangeExtensionsNotification: Event<IExtensionsNotification | undefined> = this._onDidChangeExtensionsNotification.event;

	private _extensionsNotification: IExtensionsNotification | undefined;
	private _local: IExtension[] = [];
	get local(): IExtension[] { return this._local; }
	get installed(): IExtension[] { return this._local; }
	get outdated(): IExtension[] { return []; }

	readonly whenInitialized: Promise<void>;

	constructor(
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
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

	getExtensionRuntimeStatus(_extension: IExtension): IExtensionRuntimeStatus | undefined {
		return undefined;
	}

	async updateRunningExtensions(_message?: string): Promise<void> {
		return;
	}

	getExtensionsNotification(): IExtensionsNotification | undefined {
		return this._extensionsNotification;
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

	async openSearch(_query: string, _focus?: boolean): Promise<void> {
		// Extensions sidebar search disabled in ProX-Code
	}

	async checkForUpdates(): Promise<void> { }

	async updateAll(): Promise<InstallExtensionResult[]> { return []; }

	getEnabledAutoUpdateExtensions(): string[] { return []; }
	getDisabledAutoUpdateExtensions(): string[] { return []; }

	getAutoUpdateValue(): AutoUpdateConfigurationValue {
		return this.configurationService.getValue<AutoUpdateConfigurationValue>(AutoUpdateConfigurationKey) ?? true;
	}

	isAutoUpdateEnabledFor(_extensionOrPublisher: IExtension | string): boolean {
		return true;
	}

	async updateAutoUpdateEnablementFor(_extensionOrPublisher: IExtension | string, _enable: boolean): Promise<void> { }

	async shouldRequireConsentToUpdate(_extension: IExtension): Promise<string | undefined> { return undefined; }

	async updateAutoUpdateForAllExtensions(_value: boolean): Promise<void> { }

	async togglePreRelease(_extension: IExtension): Promise<void> { }

	isExtensionPinned(_extension: IExtension): boolean {
		return false;
	}

	async togglePinExtension(_extension: IExtension): Promise<void> { }
}
