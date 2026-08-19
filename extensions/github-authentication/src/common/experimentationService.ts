/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class ExperimentationTelemetry {
	private sharedProperties: Record<string, string> = {};

	constructor(_context?: vscode.ExtensionContext) { }

	/**
	 * Sends telemetry event safely without requiring external Microsoft telemetry packages.
	 */
	sendTelemetryEvent(_eventName: string, _properties?: Record<string, string>, _measurements?: Record<string, number>): void {
		// In ProX-Code, telemetry is handled locally or disabled
	}

	/**
	 * Sends telemetry error event.
	 */
	sendTelemetryErrorEvent(
		_eventName: string,
		_properties?: Record<string, string>,
		_measurements?: Record<string, number>
	): void {
		// In ProX-Code, telemetry is handled locally or disabled
	}

	setSharedProperty(name: string, value: string): void {
		this.sharedProperties[name] = value;
	}

	postEvent(eventName: string, props: Map<string, string>): void {
		const event: Record<string, string> = {};
		for (const [key, value] of props) {
			event[key] = value;
		}
		this.sendTelemetryEvent(eventName, event);
	}

	dispose(): void {
		// No-op cleanup
	}
}
