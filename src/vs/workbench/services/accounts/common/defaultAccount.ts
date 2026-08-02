/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { AuthenticationSession, IAuthenticationService } from '../../authentication/common/authentication.js';
import { IRequestService } from '../../../../platform/request/common/request.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize } from '../../../../nls.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Barrier, timeout } from '../../../../base/common/async.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { IDefaultAccount } from '../../../../base/common/defaultAccount.js';
import { IWorkbenchEnvironmentService } from '../../environment/common/environmentService.js';
import { isWeb } from '../../../../base/common/platform.js';
import { IDefaultAccountService } from '../../../../platform/defaultAccount/common/defaultAccount.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

export const DEFAULT_ACCOUNT_SIGN_IN_COMMAND = 'workbench.actions.accounts.signIn';

const enum DefaultAccountStatus {
	Uninitialized = 'uninitialized',
	Unavailable = 'unavailable',
	Available = 'available',
}

const CONTEXT_DEFAULT_ACCOUNT_STATE = new RawContextKey<string>('defaultAccountStatus', DefaultAccountStatus.Uninitialized);

export class DefaultAccountService extends Disposable implements IDefaultAccountService {
	declare _serviceBrand: undefined;

	private _defaultAccount: IDefaultAccount | null | undefined = undefined;
	get defaultAccount(): IDefaultAccount | null { return this._defaultAccount ?? null; }

	private readonly initBarrier = new Barrier();

	private readonly _onDidChangeDefaultAccount = this._register(new Emitter<IDefaultAccount | null>());
	readonly onDidChangeDefaultAccount = this._onDidChangeDefaultAccount.event;

	async getDefaultAccount(): Promise<IDefaultAccount | null> {
		await this.initBarrier.wait();
		return this.defaultAccount;
	}

	setDefaultAccount(account: IDefaultAccount | null): void {
		const oldAccount = this._defaultAccount;
		this._defaultAccount = account;

		if (oldAccount !== this._defaultAccount) {
			this._onDidChangeDefaultAccount.fire(this._defaultAccount);
		}

		this.initBarrier.open();
	}

}

export class DefaultAccountManagementContribution extends Disposable implements IWorkbenchContribution {

	static ID = 'workbench.contributions.defaultAccountManagement';

	private defaultAccount: IDefaultAccount | null = null;
	private readonly accountStatusContext: IContextKey<string>;

	constructor(
		@IDefaultAccountService private readonly defaultAccountService: IDefaultAccountService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IProductService private readonly productService: IProductService,
		@IRequestService _requestService: IRequestService,
		@ILogService private readonly logService: ILogService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super();
		this.accountStatusContext = CONTEXT_DEFAULT_ACCOUNT_STATE.bindTo(contextKeyService);
		this.initialize().then(() => {
			type DefaultAccountStatusTelemetry = {
				status: string;
				initial: boolean;
			};
			type DefaultAccountStatusTelemetryClassification = {
				owner: 'sandy081';
				comment: 'Log default account availability status';
				status: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Indicates whether default account is available or not.' };
				initial: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'Indicates whether this is the initial status report.' };
			};
			this.telemetryService.publicLog2<DefaultAccountStatusTelemetry, DefaultAccountStatusTelemetryClassification>('defaultaccount:status', { status: this.defaultAccount ? 'available' : 'unavailable', initial: true });

			this._register(this.authenticationService.onDidChangeSessions(async e => {
				if (e.providerId !== this.getDefaultAccountProviderId()) {
					return;
				}
				if (this.defaultAccount && e.event.removed?.some(session => session.id === this.defaultAccount?.sessionId)) {
					this.setDefaultAccount(null);
				} else {
					this.setDefaultAccount(await this.getDefaultAccountFromAuthenticatedSessions(e.providerId, this.productService.defaultAccount!.authenticationProvider.scopes));
				}

				this.telemetryService.publicLog2<DefaultAccountStatusTelemetry, DefaultAccountStatusTelemetryClassification>('defaultaccount:status', { status: this.defaultAccount ? 'available' : 'unavailable', initial: false });
			}));
		});
	}

	private async initialize(): Promise<void> {
		this.logService.debug('[DefaultAccount] Starting initialization');
		let defaultAccount: IDefaultAccount | null = null;
		try {
			defaultAccount = await this.fetchDefaultAccount();
		} catch (error) {
			this.logService.error('[DefaultAccount] Error during initialization', getErrorMessage(error));
		}
		this.setDefaultAccount(defaultAccount);
		this.logService.debug('[DefaultAccount] Initialization complete');
	}

	private async fetchDefaultAccount(): Promise<IDefaultAccount | null> {
		if (!this.productService.defaultAccount) {
			this.logService.debug('[DefaultAccount] No default account configuration in product service, skipping initialization');
			return null;
		}

		if (isWeb && !this.environmentService.remoteAuthority) {
			this.logService.debug('[DefaultAccount] Running in web without remote, skipping initialization');
			return null;
		}

		const defaultAccountProviderId = this.getDefaultAccountProviderId();
		this.logService.debug('[DefaultAccount] Default account provider ID:', defaultAccountProviderId);
		if (!defaultAccountProviderId) {
			return null;
		}

		await this.extensionService.whenInstalledExtensionsRegistered();
		this.logService.debug('[DefaultAccount] Installed extensions registered.');

		const declaredProvider = this.authenticationService.declaredProviders.find(provider => provider.id === defaultAccountProviderId);
		if (!declaredProvider) {
			this.logService.info(`[DefaultAccount] Authentication provider is not declared.`, defaultAccountProviderId);
			return null;
		}

		this.registerSignInAction(defaultAccountProviderId, this.productService.defaultAccount.authenticationProvider.scopes[0]);
		return await this.getDefaultAccountFromAuthenticatedSessions(defaultAccountProviderId, this.productService.defaultAccount.authenticationProvider.scopes);
	}

	private setDefaultAccount(account: IDefaultAccount | null): void {
		this.defaultAccount = account;
		this.defaultAccountService.setDefaultAccount(this.defaultAccount);
		if (this.defaultAccount) {
			this.accountStatusContext.set(DefaultAccountStatus.Available);
			this.logService.debug('[DefaultAccount] Account status set to Available');
		} else {
			this.accountStatusContext.set(DefaultAccountStatus.Unavailable);
			this.logService.debug('[DefaultAccount] Account status set to Unavailable');
		}
	}

	private async getDefaultAccountFromAuthenticatedSessions(authProviderId: string, allScopes: string[][]): Promise<IDefaultAccount | null> {
		try {
			this.logService.debug('[DefaultAccount] Getting Default Account from authenticated sessions for provider:', authProviderId);
			const session = await this.findMatchingProviderSession(authProviderId, allScopes);

			if (!session) {
				this.logService.debug('[DefaultAccount] No matching session found for provider:', authProviderId);
				return null;
			}

			const account: IDefaultAccount = {
				sessionId: session.id,
				enterprise: this.isEnterpriseAuthenticationProvider(authProviderId) || session.account.label.includes('_'),
			};
			this.logService.debug('[DefaultAccount] Successfully created default account for provider:', authProviderId);
			return account;
		} catch (error) {
			this.logService.error('[DefaultAccount] Failed to create default account for provider:', authProviderId, getErrorMessage(error));
			return null;
		}
	}

	private async findMatchingProviderSession(authProviderId: string, allScopes: string[][]): Promise<AuthenticationSession | undefined> {
		const sessions = await this.getSessions(authProviderId);
		for (const session of sessions) {
			this.logService.debug('[DefaultAccount] Checking session with scopes', session.scopes);
			for (const scopes of allScopes) {
				if (this.scopesMatch(session.scopes, scopes)) {
					return session;
				}
			}
		}
		return undefined;
	}

	private async getSessions(authProviderId: string): Promise<readonly AuthenticationSession[]> {
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				return await this.authenticationService.getSessions(authProviderId, undefined, undefined, true);
			} catch (error) {
				this.logService.warn(`[DefaultAccount] Attempt ${attempt} to get sessions failed:`, getErrorMessage(error));
				if (attempt === 3) {
					throw error;
				}
				await timeout(500);
			}
		}
		throw new Error('Unable to get sessions after multiple attempts');
	}

	private scopesMatch(scopes: ReadonlyArray<string>, expectedScopes: string[]): boolean {
		return expectedScopes.every(scope => scopes.includes(scope));
	}

	private getDefaultAccountProviderId(): string | undefined {
		if (this.productService.defaultAccount && this.configurationService.getValue<string | undefined>(this.productService.defaultAccount.authenticationProvider.enterpriseProviderConfig) === this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId) {
			return this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId;
		}
		return this.productService.defaultAccount?.authenticationProvider.id;
	}

	private isEnterpriseAuthenticationProvider(providerId: string | undefined): boolean {
		if (!providerId) {
			return false;
		}

		return providerId === this.productService.defaultAccount?.authenticationProvider.enterpriseProviderId;
	}

	private registerSignInAction(authProviderId: string, scopes: string[]): void {
		const that = this;
		this._register(registerAction2(class extends Action2 {
			constructor() {
				super({
					id: DEFAULT_ACCOUNT_SIGN_IN_COMMAND,
					title: localize('sign in', "Sign in"),
				});
			}
			run(): Promise<AuthenticationSession> {
				return that.authenticationService.createSession(authProviderId, scopes);
			}
		}));
	}

}

registerWorkbenchContribution2('workbench.contributions.defaultAccountManagement', DefaultAccountManagementContribution, WorkbenchPhase.AfterRestored);
