/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Uri } from 'vscode';
import { AuthProviderType } from '../github';

const VALID_DESKTOP_CALLBACK_SCHEMES = [
	'vscode',
	'vscode-insiders',
	'prox-code',
	'vscode-wsl',
	'vscode-exploration'
];

export function isSupportedClient(uri: Uri): boolean {
	return (
		VALID_DESKTOP_CALLBACK_SCHEMES.includes(uri.scheme) ||
		// vscode.dev & insiders.prox-code.dev
		/(?:^|\.)vscode\.dev$/.test(uri.authority) ||
		// github.dev & codespaces
		/(?:^|\.)github\.dev$/.test(uri.authority)
	);
}

export function isSupportedTarget(type: AuthProviderType, gheUri?: Uri): boolean {
	return (
		type === AuthProviderType.github ||
		isHostedGitHubEnterprise(gheUri!)
	);
}

export function isHostedGitHubEnterprise(uri: Uri): boolean {
	return /\.ghe\.com$/.test(uri.authority);
}
