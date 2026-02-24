/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from '../../../../base/common/event.js';
import { IInstantiationService, createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ITunnelService, RemoteTunnel } from '../../../../platform/tunnel/common/tunnel.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { TunnelInformation } from '../../../../platform/remote/common/remoteAuthorityResolver.js';
import { Attributes, CandidatePort, TunnelCloseReason, TunnelModel, TunnelProperties } from './tunnelModel.js';

export const IRemoteExplorerService = createDecorator<IRemoteExplorerService>('remoteExplorerService');
export const REMOTE_EXPLORER_TYPE_KEY: string = 'remote.explorerType';
export const PORT_AUTO_FORWARD_SETTING = 'remote.autoForwardPorts';
export const PORT_AUTO_SOURCE_SETTING = 'remote.autoForwardPortsSource';
export const PORT_AUTO_FALLBACK_SETTING = 'remote.autoForwardPortsFallback';
export const PORT_AUTO_SOURCE_SETTING_PROCESS = 'process';
export const PORT_AUTO_SOURCE_SETTING_OUTPUT = 'output';
export const PORT_AUTO_SOURCE_SETTING_HYBRID = 'hybrid';

export enum PortsEnablement {
	Disabled = 0,
	ViewOnly = 1,
	AdditionalFeatures = 2
}

export interface IRemoteExplorerService {
	readonly _serviceBrand: undefined;
	readonly tunnelModel: TunnelModel;
	forward(tunnelProperties: TunnelProperties, attributes?: Attributes | null): Promise<RemoteTunnel | string | undefined>;
	close(remote: { host: string; port: number }, reason: TunnelCloseReason): Promise<void>;
	setTunnelInformation(tunnelInformation: TunnelInformation | undefined): void;
	setCandidateFilter(filter: ((candidates: CandidatePort[]) => Promise<CandidatePort[]>) | undefined): IDisposable;
	onFoundNewCandidates(candidates: CandidatePort[]): void;
	restore(): Promise<void>;
	enablePortsFeatures(viewOnly: boolean): void;
	readonly onEnabledPortsFeatures: Event<void>;
	portsFeaturesEnabled: PortsEnablement;
	readonly namedProcesses: Map<number, string>;
}

class RemoteExplorerService implements IRemoteExplorerService {
	public _serviceBrand: undefined;
	private _tunnelModel: TunnelModel;
	private readonly _onEnabledPortsFeatures: Emitter<void> = new Emitter();
	public readonly onEnabledPortsFeatures: Event<void> = this._onEnabledPortsFeatures.event;
	private _portsFeaturesEnabled: PortsEnablement = PortsEnablement.Disabled;
	public readonly namedProcesses = new Map<number, string>();

	constructor(
		@ITunnelService private readonly tunnelService: ITunnelService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		this._tunnelModel = instantiationService.createInstance(TunnelModel);
	}

	get tunnelModel(): TunnelModel {
		return this._tunnelModel;
	}

	forward(tunnelProperties: TunnelProperties, attributes?: Attributes | null): Promise<RemoteTunnel | string | undefined> {
		return this.tunnelModel.forward(tunnelProperties, attributes);
	}

	close(remote: { host: string; port: number }, reason: TunnelCloseReason): Promise<void> {
		return this.tunnelModel.close(remote.host, remote.port, reason);
	}

	setTunnelInformation(tunnelInformation: TunnelInformation | undefined): void {
		if (tunnelInformation?.features) {
			this.tunnelService.setTunnelFeatures(tunnelInformation.features);
		}
		this.tunnelModel.addEnvironmentTunnels(tunnelInformation?.environmentTunnels);
	}

	setCandidateFilter(filter: (candidates: CandidatePort[]) => Promise<CandidatePort[]>): IDisposable {
		if (!filter) {
			return {
				dispose: () => { }
			};
		}
		this.tunnelModel.setCandidateFilter(filter);
		return {
			dispose: () => {
				this.tunnelModel.setCandidateFilter(undefined);
			}
		};
	}

	onFoundNewCandidates(candidates: CandidatePort[]): void {
		this.tunnelModel.setCandidates(candidates);
	}

	restore(): Promise<void> {
		return this.tunnelModel.restoreForwarded();
	}

	enablePortsFeatures(viewOnly: boolean): void {
		this._portsFeaturesEnabled = viewOnly ? PortsEnablement.ViewOnly : PortsEnablement.AdditionalFeatures;
		this._onEnabledPortsFeatures.fire();
	}

	get portsFeaturesEnabled(): PortsEnablement {
		return this._portsFeaturesEnabled;
	}
}

registerSingleton(IRemoteExplorerService, RemoteExplorerService, InstantiationType.Delayed);
