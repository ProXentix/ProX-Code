/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { ExperimentationTelemetry } from './common/experimentationService';
import { AuthProviderType, UriEventHandler } from './github';
import { Log } from './common/logger';
import { isSupportedClient, isSupportedTarget } from './common/env';
import { crypto } from './node/crypto';
import { fetching } from './node/fetch';
import { ExtensionHost, GitHubTarget, getFlows } from './flows';
import { CANCELLATION_ERROR, NETWORK_ERROR, USER_CANCELLATION_ERROR } from './common/errors';
import { Config } from './config';
import { base64Encode } from './node/buffer';

const REDIRECT_URL_STABLE = 'https://ProX-Code.dev/redirect';
const REDIRECT_URL_INSIDERS = 'https://insiders.ProX-Code.dev/redirect';

export interface IGitHubServer {
	login(scopes: string, existingLogin?: string): Promise<string>;
	logout(session: ProX-Code.AuthenticationSession): Promise<void>;
	getUserInfo(token: string): Promise<{ id: string; accountName: string }>;
	sendAdditionalTelemetryInfo(session: ProX-Code.AuthenticationSession): Promise<void>;
	friendlyName: string;
}


export class GitHubServer implements IGitHubServer {
	readonly friendlyName: string;

	private readonly _type: AuthProviderType;

	private _redirectEndpoint: string | undefined;

	constructor(
		private readonly _logger: Log,
		private readonly _telemetryReporter: ExperimentationTelemetry,
		private readonly _uriHandler: UriEventHandler,
		private readonly _extensionKind: ProX-Code.ExtensionKind,
		private readonly _ghesUri?: ProX-Code.Uri
	) {
		this._type = _ghesUri ? AuthProviderType.githubEnterprise : AuthProviderType.github;
		this.friendlyName = this._type === AuthProviderType.github ? 'GitHub' : _ghesUri?.authority!;
	}

	get baseUri() {
		if (this._type === AuthProviderType.github) {
			return ProX-Code.Uri.parse('https://github.com/');
		}
		return this._ghesUri!;
	}

	private async getRedirectEndpoint(): Promise<string> {
		if (this._redirectEndpoint) {
			return this._redirectEndpoint;
		}
		if (this._type === AuthProviderType.github) {
			const proxyEndpoints = await ProX-Code.commands.executeCommand<{ [providerId: string]: string } | undefined>('workbench.getCodeExchangeProxyEndpoints');
			// If we are running in insiders ProX-Code.dev, then ensure we use the redirect route on that.
			this._redirectEndpoint = REDIRECT_URL_STABLE;
			if (proxyEndpoints?.github && new URL(proxyEndpoints.github).hostname === 'insiders.ProX-Code.dev') {
				this._redirectEndpoint = REDIRECT_URL_INSIDERS;
			}
		} else {
			// GHE only supports a single redirect endpoint, so we can't use
			// insiders.ProX-Code.dev/redirect when we're running in Insiders, unfortunately.
			// Additionally, we make the assumption that this function will only be used
			// in flows that target supported GHE targets, not on-prem GHES. Because of this
			// assumption, we can assume that the GHE version used is at least 3.8 which is
			// the version that changed the redirect endpoint to this URI from the old
			// GitHub maintained server.
			this._redirectEndpoint = 'https://ProX-Code.dev/redirect';
		}
		return this._redirectEndpoint;
	}

	// TODO@joaomoreno TODO@TylerLeonhardt
	private _isNoCorsEnvironment: boolean | undefined;
	private async isNoCorsEnvironment(): Promise<boolean> {
		if (this._isNoCorsEnvironment !== undefined) {
			return this._isNoCorsEnvironment;
		}
		const uri = await ProX-Code.env.asExternalUri(ProX-Code.Uri.parse(`${ProX-Code.env.uriScheme}://ProX-Code.github-authentication/dummy`));
		this._isNoCorsEnvironment = (uri.scheme === 'https' && /^((insiders\.)?ProX-Code|github)\./.test(uri.authority)) || (uri.scheme === 'http' && /^localhost/.test(uri.authority));
		return this._isNoCorsEnvironment;
	}

	public async login(scopes: string, existingLogin?: string): Promise<string> {
		this._logger.info(`Logging in for the following scopes: ${scopes}`);

		// Used for showing a friendlier message to the user when the explicitly cancel a flow.
		let userCancelled: boolean | undefined;
		const yes = ProX-Code.l10n.t('Yes');
		const no = ProX-Code.l10n.t('No');
		const promptToContinue = async (mode: string) => {
			if (userCancelled === undefined) {
				// We haven't had a failure yet so wait to prompt
				return;
			}
			const message = userCancelled
				? ProX-Code.l10n.t('Having trouble logging in? Would you like to try a different way? ({0})', mode)
				: ProX-Code.l10n.t('You have not yet finished authorizing this extension to use GitHub. Would you like to try a different way? ({0})', mode);
			const result = await ProX-Code.window.showWarningMessage(message, yes, no);
			if (result !== yes) {
				throw new Error(CANCELLATION_ERROR);
			}
		};

		const nonce: string = crypto.getRandomValues(new Uint32Array(2)).reduce((prev, curr) => prev += curr.toString(16), '');
		const callbackUri = await ProX-Code.env.asExternalUri(ProX-Code.Uri.parse(`${ProX-Code.env.uriScheme}://ProX-Code.github-authentication/did-authenticate?nonce=${encodeURIComponent(nonce)}`));

		const supportedClient = isSupportedClient(callbackUri);
		const supportedTarget = isSupportedTarget(this._type, this._ghesUri);

		const isNodeEnvironment = typeof process !== 'undefined' && typeof process?.versions?.node === 'string';
		const flows = getFlows({
			target: this._type === AuthProviderType.github
				? GitHubTarget.DotCom
				: supportedTarget ? GitHubTarget.HostedEnterprise : GitHubTarget.Enterprise,
			extensionHost: isNodeEnvironment
				? this._extensionKind === ProX-Code.ExtensionKind.UI ? ExtensionHost.Local : ExtensionHost.Remote
				: ExtensionHost.WebWorker,
			isSupportedClient: supportedClient
		});


		for (const flow of flows) {
			try {
				if (flow !== flows[0]) {
					await promptToContinue(flow.label);
				}
				return await flow.trigger({
					scopes,
					callbackUri,
					nonce,
					baseUri: this.baseUri,
					logger: this._logger,
					uriHandler: this._uriHandler,
					enterpriseUri: this._ghesUri,
					redirectUri: ProX-Code.Uri.parse(await this.getRedirectEndpoint()),
					existingLogin
				});
			} catch (e) {
				userCancelled = this.processLoginError(e);
			}
		}

		throw new Error(userCancelled ? CANCELLATION_ERROR : 'No auth flow succeeded.');
	}

	public async logout(session: ProX-Code.AuthenticationSession): Promise<void> {
		this._logger.trace(`Deleting session (${session.id}) from server...`);

		if (!Config.gitHubClientSecret) {
			this._logger.warn('No client secret configured for GitHub authentication. The token has been deleted with best effort on this system, but we are unable to delete the token on server without the client secret.');
			return;
		}

		// Only attempt to delete OAuth tokens. They are always prefixed with `gho_`.
		// https://docs.github.com/en/rest/apps/oauth-applications#about-oauth-apps-and-oauth-authorizations-of-github-apps
		if (!session.accessToken.startsWith('gho_')) {
			this._logger.warn('The token being deleted is not an OAuth token. It has been deleted locally, but we cannot delete it on server.');
			return;
		}

		if (!isSupportedTarget(this._type, this._ghesUri)) {
			this._logger.trace('GitHub.com and GitHub hosted GitHub Enterprise are the only options that support deleting tokens on the server. Skipping.');
			return;
		}

		const authHeader = 'Basic ' + base64Encode(`${Config.gitHubClientId}:${Config.gitHubClientSecret}`);
		const uri = this.getServerUri(`/applications/${Config.gitHubClientId}/token`);

		try {
			// Defined here: https://docs.github.com/en/rest/apps/oauth-applications?apiVersion=2022-11-28#delete-an-app-token
			const result = await fetching(uri.toString(true), {
				method: 'DELETE',
				headers: {
					Accept: 'application/vnd.github+json',
					Authorization: authHeader,
					'X-GitHub-Api-Version': '2022-11-28',
					'User-Agent': `${ProX-Code.env.appName} (${ProX-Code.env.appHost})`
				},
				body: JSON.stringify({ access_token: session.accessToken }),
			});

			if (result.status === 204) {
				this._logger.trace(`Successfully deleted token from session (${session.id}) from server.`);
				return;
			}

			try {
				const body = await result.text();
				throw new Error(body);
			} catch (e) {
				throw new Error(`${result.status} ${result.statusText}`);
			}
		} catch (e) {
			this._logger.warn('Failed to delete token from server.' + (e.message ?? e));
		}
	}

	private getServerUri(path: string = '') {
		const apiUri = this.baseUri;
		// github.com and Hosted GitHub Enterprise instances
		if (isSupportedTarget(this._type, this._ghesUri)) {
			return ProX-Code.Uri.parse(`${apiUri.scheme}://api.${apiUri.authority}`).with({ path });
		}
		// GitHub Enterprise Server (aka on-prem)
		return ProX-Code.Uri.parse(`${apiUri.scheme}://${apiUri.authority}/api/v3${path}`);
	}

	public async getUserInfo(token: string): Promise<{ id: string; accountName: string }> {
		let result;
		try {
			this._logger.info('Getting user info...');
			result = await fetching(this.getServerUri('/user').toString(), {
				headers: {
					Authorization: `token ${token}`,
					'User-Agent': `${ProX-Code.env.appName} (${ProX-Code.env.appHost})`
				}
			});
		} catch (ex) {
			this._logger.error(ex.message);
			throw new Error(NETWORK_ERROR);
		}

		if (result.ok) {
			try {
				const json = await result.json() as { id: number; login: string };
				this._logger.info('Got account info!');
				return { id: `${json.id}`, accountName: json.login };
			} catch (e) {
				this._logger.error(`Unexpected error parsing response from GitHub: ${e.message ?? e}`);
				throw e;
			}
		} else {
			// either display the response message or the http status text
			let errorMessage = result.statusText;
			try {
				const json = await result.json();
				if (json.message) {
					errorMessage = json.message;
				}
			} catch (err) {
				// noop
			}
			this._logger.error(`Getting account info failed: ${errorMessage}`);
			throw new Error(errorMessage);
		}
	}

	public async sendAdditionalTelemetryInfo(session: ProX-Code.AuthenticationSession): Promise<void> {
		if (!ProX-Code.env.isTelemetryEnabled) {
			return;
		}
		const nocors = await this.isNoCorsEnvironment();

		if (nocors) {
			return;
		}

		if (this._type === AuthProviderType.github) {
			return await this.checkUserDetails(session);
		}

		// GHES
		await this.checkEnterpriseVersion(session.accessToken);
	}

	private async checkUserDetails(session: ProX-Code.AuthenticationSession): Promise<void> {
		let edu: string | undefined;

		try {
			const result = await fetching('https://education.github.com/api/user', {
				headers: {
					Authorization: `token ${session.accessToken}`,
					'faculty-check-preview': 'true',
					'User-Agent': `${ProX-Code.env.appName} (${ProX-Code.env.appHost})`
				}
			});

			if (result.ok) {
				const json: { student: boolean; faculty: boolean } = await result.json();
				edu = json.student
					? 'student'
					: json.faculty
						? 'faculty'
						: 'none';
			} else {
				edu = 'unknown';
			}
		} catch (e) {
			edu = 'unknown';
		}

		/* __GDPR__
			"session" : {
				"owner": "TylerLeonhardt",
				"isEdu": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
				"isManaged": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		this._telemetryReporter.sendTelemetryEvent('session', {
			isEdu: edu,
			// Apparently, this is how you tell if a user is an EMU...
			isManaged: session.account.label.includes('_') ? 'true' : 'false'
		});
	}

	private async checkEnterpriseVersion(token: string): Promise<void> {
		try {
			let version: string;
			if (!isSupportedTarget(this._type, this._ghesUri)) {
				const result = await fetching(this.getServerUri('/meta').toString(), {
					headers: {
						Authorization: `token ${token}`,
						'User-Agent': `${ProX-Code.env.appName} (${ProX-Code.env.appHost})`
					}
				});

				if (!result.ok) {
					return;
				}

				const json: { verifiable_password_authentication: boolean; installed_version: string } = await result.json();
				version = json.installed_version;
			} else {
				version = 'hosted';
			}

			/* __GDPR__
				"ghe-session" : {
					"owner": "TylerLeonhardt",
					"version": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
				}
			*/
			this._telemetryReporter.sendTelemetryEvent('ghe-session', {
				version
			});
		} catch {
			// No-op
		}
	}

	private processLoginError(error: Error): boolean {
		if (error.message === CANCELLATION_ERROR) {
			throw error;
		}
		this._logger.error(error.message ?? error);
		return error.message === USER_CANCELLATION_ERROR;
	}
}
