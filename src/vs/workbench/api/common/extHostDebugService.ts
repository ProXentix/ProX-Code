/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as ProX-Code from 'ProX-Code';
import { coalesce } from '../../../base/common/arrays.js';
import { asPromise } from '../../../base/common/async.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable as DisposableCls, toDisposable } from '../../../base/common/lifecycle.js';
import { ThemeIcon as ThemeIconUtils } from '../../../base/common/themables.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { ISignService } from '../../../platform/sign/common/sign.js';
import { IWorkspaceFolder } from '../../../platform/workspace/common/workspace.js';
import { AbstractDebugAdapter } from '../../contrib/debug/common/abstractDebugAdapter.js';
import { DebugVisualizationType, IAdapterDescriptor, IConfig, IDebugAdapter, IDebugAdapterExecutable, IDebugAdapterImpl, IDebugAdapterNamedPipeServer, IDebugAdapterServer, IDebuggerContribution, IDebugVisualization, IDebugVisualizationContext, IDebugVisualizationTreeItem, MainThreadDebugVisualization } from '../../contrib/debug/common/debug.js';
import { convertToDAPaths, convertToVSCPaths, isDebuggerMainContribution } from '../../contrib/debug/common/debugUtils.js';
import { ExtensionDescriptionRegistry } from '../../services/extensions/common/extensionDescriptionRegistry.js';
import { Dto } from '../../services/extensions/common/proxyIdentifier.js';
import { DebugSessionUUID, ExtHostDebugServiceShape, IBreakpointsDeltaDto, IDebugSessionDto, IFunctionBreakpointDto, ISourceMultiBreakpointDto, IStackFrameFocusDto, IThreadFocusDto, MainContext, MainThreadDebugServiceShape, MainThreadTelemetryShape } from './extHost.protocol.js';
import { IExtHostCommands } from './extHostCommands.js';
import { IExtHostConfiguration } from './extHostConfiguration.js';
import { IExtHostEditorTabs } from './extHostEditorTabs.js';
import { IExtHostExtensionService } from './extHostExtensionService.js';
import { IExtHostRpcService } from './extHostRpcService.js';
import { IExtHostTesting } from './extHostTesting.js';
import * as Convert from './extHostTypeConverters.js';
import { Breakpoint, DataBreakpoint, DebugAdapterExecutable, DebugAdapterInlineImplementation, DebugAdapterNamedPipeServer, DebugAdapterServer, DebugConsoleMode, DebugStackFrame, DebugThread, Disposable, FunctionBreakpoint, Location, Position, setBreakpointId, SourceBreakpoint, ThemeIcon } from './extHostTypes.js';
import { IExtHostVariableResolverProvider } from './extHostVariableResolverService.js';
import { IExtHostWorkspace } from './extHostWorkspace.js';

export const IExtHostDebugService = createDecorator<IExtHostDebugService>('IExtHostDebugService');

export interface IExtHostDebugService extends ExtHostDebugServiceShape {

	readonly _serviceBrand: undefined;

	onDidStartDebugSession: Event<ProX-Code.DebugSession>;
	onDidTerminateDebugSession: Event<ProX-Code.DebugSession>;
	onDidChangeActiveDebugSession: Event<ProX-Code.DebugSession | undefined>;
	activeDebugSession: ProX-Code.DebugSession | undefined;
	activeDebugConsole: ProX-Code.DebugConsole;
	onDidReceiveDebugSessionCustomEvent: Event<ProX-Code.DebugSessionCustomEvent>;
	onDidChangeBreakpoints: Event<ProX-Code.BreakpointsChangeEvent>;
	breakpoints: ProX-Code.Breakpoint[];
	onDidChangeActiveStackItem: Event<ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined>;
	activeStackItem: ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined;

	addBreakpoints(breakpoints0: readonly ProX-Code.Breakpoint[]): Promise<void>;
	removeBreakpoints(breakpoints0: readonly ProX-Code.Breakpoint[]): Promise<void>;
	startDebugging(folder: ProX-Code.WorkspaceFolder | undefined, nameOrConfig: string | ProX-Code.DebugConfiguration, options: ProX-Code.DebugSessionOptions): Promise<boolean>;
	stopDebugging(session?: ProX-Code.DebugSession): Promise<void>;
	registerDebugConfigurationProvider(type: string, provider: ProX-Code.DebugConfigurationProvider, trigger: ProX-Code.DebugConfigurationProviderTriggerKind): ProX-Code.Disposable;
	registerDebugAdapterDescriptorFactory(extension: IExtensionDescription, type: string, factory: ProX-Code.DebugAdapterDescriptorFactory): ProX-Code.Disposable;
	registerDebugAdapterTrackerFactory(type: string, factory: ProX-Code.DebugAdapterTrackerFactory): ProX-Code.Disposable;
	registerDebugVisualizationProvider<T extends ProX-Code.DebugVisualization>(extension: IExtensionDescription, id: string, provider: ProX-Code.DebugVisualizationProvider<T>): ProX-Code.Disposable;
	registerDebugVisualizationTree<T extends ProX-Code.DebugTreeItem>(extension: IExtensionDescription, id: string, provider: ProX-Code.DebugVisualizationTree<T>): ProX-Code.Disposable;
	asDebugSourceUri(source: ProX-Code.DebugProtocolSource, session?: ProX-Code.DebugSession): ProX-Code.Uri;
}

export abstract class ExtHostDebugServiceBase extends DisposableCls implements IExtHostDebugService, ExtHostDebugServiceShape {

	declare readonly _serviceBrand: undefined;

	private _configProviderHandleCounter: number;
	private _configProviders: ConfigProviderTuple[];

	private _adapterFactoryHandleCounter: number;
	private _adapterFactories: DescriptorFactoryTuple[];

	private _trackerFactoryHandleCounter: number;
	private _trackerFactories: TrackerFactoryTuple[];

	private _debugServiceProxy: MainThreadDebugServiceShape;
	private _debugSessions: Map<DebugSessionUUID, ExtHostDebugSession> = new Map<DebugSessionUUID, ExtHostDebugSession>();

	private readonly _onDidStartDebugSession: Emitter<ProX-Code.DebugSession>;
	get onDidStartDebugSession(): Event<ProX-Code.DebugSession> { return this._onDidStartDebugSession.event; }

	private readonly _onDidTerminateDebugSession: Emitter<ProX-Code.DebugSession>;
	get onDidTerminateDebugSession(): Event<ProX-Code.DebugSession> { return this._onDidTerminateDebugSession.event; }

	private readonly _onDidChangeActiveDebugSession: Emitter<ProX-Code.DebugSession | undefined>;
	get onDidChangeActiveDebugSession(): Event<ProX-Code.DebugSession | undefined> { return this._onDidChangeActiveDebugSession.event; }

	private _activeDebugSession: ExtHostDebugSession | undefined;
	get activeDebugSession(): ProX-Code.DebugSession | undefined { return this._activeDebugSession?.api; }

	private readonly _onDidReceiveDebugSessionCustomEvent: Emitter<ProX-Code.DebugSessionCustomEvent>;
	get onDidReceiveDebugSessionCustomEvent(): Event<ProX-Code.DebugSessionCustomEvent> { return this._onDidReceiveDebugSessionCustomEvent.event; }

	private _activeDebugConsole: ExtHostDebugConsole;
	get activeDebugConsole(): ProX-Code.DebugConsole { return this._activeDebugConsole.value; }

	private _breakpoints: Map<string, ProX-Code.Breakpoint>;

	private readonly _onDidChangeBreakpoints: Emitter<ProX-Code.BreakpointsChangeEvent>;

	private _activeStackItem: ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined;
	private readonly _onDidChangeActiveStackItem: Emitter<ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined>;

	private _debugAdapters: Map<number, IDebugAdapter>;
	private _debugAdaptersTrackers: Map<number, ProX-Code.DebugAdapterTracker>;

	private _debugVisualizationTreeItemIdsCounter = 0;
	private readonly _debugVisualizationProviders = new Map<string, ProX-Code.DebugVisualizationProvider>();
	private readonly _debugVisualizationTrees = new Map<string, ProX-Code.DebugVisualizationTree>();
	private readonly _debugVisualizationTreeItemIds = new WeakMap<ProX-Code.DebugTreeItem, number>();
	private readonly _debugVisualizationElements = new Map<number, { provider: string; item: ProX-Code.DebugTreeItem; children?: number[] }>();

	private _signService: ISignService | undefined;

	private readonly _visualizers = new Map<number, { v: ProX-Code.DebugVisualization; provider: ProX-Code.DebugVisualizationProvider; extensionId: string }>();
	private _visualizerIdCounter = 0;

	private _telemetryProxy: MainThreadTelemetryShape;

	constructor(
		@IExtHostRpcService extHostRpcService: IExtHostRpcService,
		@IExtHostWorkspace protected readonly _workspaceService: IExtHostWorkspace,
		@IExtHostExtensionService private readonly _extensionService: IExtHostExtensionService,
		@IExtHostConfiguration protected readonly _configurationService: IExtHostConfiguration,
		@IExtHostEditorTabs protected readonly _editorTabs: IExtHostEditorTabs,
		@IExtHostVariableResolverProvider private readonly _variableResolver: IExtHostVariableResolverProvider,
		@IExtHostCommands private readonly _commands: IExtHostCommands,
		@IExtHostTesting private readonly _testing: IExtHostTesting,
	) {
		super();

		this._configProviderHandleCounter = 0;
		this._configProviders = [];

		this._adapterFactoryHandleCounter = 0;
		this._adapterFactories = [];

		this._trackerFactoryHandleCounter = 0;
		this._trackerFactories = [];

		this._debugAdapters = new Map();
		this._debugAdaptersTrackers = new Map();

		this._onDidStartDebugSession = this._register(new Emitter<ProX-Code.DebugSession>());
		this._onDidTerminateDebugSession = this._register(new Emitter<ProX-Code.DebugSession>());
		this._onDidChangeActiveDebugSession = this._register(new Emitter<ProX-Code.DebugSession | undefined>());
		this._onDidReceiveDebugSessionCustomEvent = this._register(new Emitter<ProX-Code.DebugSessionCustomEvent>());

		this._debugServiceProxy = extHostRpcService.getProxy(MainContext.MainThreadDebugService);

		this._onDidChangeBreakpoints = this._register(new Emitter<ProX-Code.BreakpointsChangeEvent>());

		this._onDidChangeActiveStackItem = this._register(new Emitter<ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined>());

		this._activeDebugConsole = new ExtHostDebugConsole(this._debugServiceProxy);

		this._breakpoints = new Map<string, ProX-Code.Breakpoint>();

		this._extensionService.getExtensionRegistry().then((extensionRegistry: ExtensionDescriptionRegistry) => {
			this._register(extensionRegistry.onDidChange(_ => {
				this.registerAllDebugTypes(extensionRegistry);
			}));
			this.registerAllDebugTypes(extensionRegistry);
		});

		this._telemetryProxy = extHostRpcService.getProxy(MainContext.MainThreadTelemetry);
	}

	public async $getVisualizerTreeItem(treeId: string, element: IDebugVisualizationContext): Promise<IDebugVisualizationTreeItem | undefined> {
		const context = this.hydrateVisualizationContext(element);
		if (!context) {
			return undefined;
		}

		const item = await this._debugVisualizationTrees.get(treeId)?.getTreeItem?.(context);
		return item ? this.convertVisualizerTreeItem(treeId, item) : undefined;
	}

	public registerDebugVisualizationTree<T extends ProX-Code.DebugTreeItem>(manifest: IExtensionDescription, id: string, provider: ProX-Code.DebugVisualizationTree<T>): ProX-Code.Disposable {
		const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
		const key = this.extensionVisKey(extensionId, id);
		if (this._debugVisualizationProviders.has(key)) {
			throw new Error(`A debug visualization provider with id '${id}' is already registered`);
		}

		this._debugVisualizationTrees.set(key, provider);
		this._debugServiceProxy.$registerDebugVisualizerTree(key, !!provider.editItem);
		return toDisposable(() => {
			this._debugServiceProxy.$unregisterDebugVisualizerTree(key);
			this._debugVisualizationTrees.delete(id);
		});
	}

	public async $getVisualizerTreeItemChildren(treeId: string, element: number): Promise<IDebugVisualizationTreeItem[]> {
		const item = this._debugVisualizationElements.get(element)?.item;
		if (!item) {
			return [];
		}

		const children = await this._debugVisualizationTrees.get(treeId)?.getChildren?.(item);
		return children?.map(i => this.convertVisualizerTreeItem(treeId, i)) || [];
	}

	public async $editVisualizerTreeItem(element: number, value: string): Promise<IDebugVisualizationTreeItem | undefined> {
		const e = this._debugVisualizationElements.get(element);
		if (!e) { return undefined; }

		const r = await this._debugVisualizationTrees.get(e.provider)?.editItem?.(e.item, value);
		return this.convertVisualizerTreeItem(e.provider, r || e.item);
	}

	public $disposeVisualizedTree(element: number): void {
		const root = this._debugVisualizationElements.get(element);
		if (!root) {
			return;
		}

		const queue = [root.children];
		for (const children of queue) {
			if (children) {
				for (const child of children) {
					queue.push(this._debugVisualizationElements.get(child)?.children);
					this._debugVisualizationElements.delete(child);
				}
			}
		}
	}

	private convertVisualizerTreeItem(treeId: string, item: ProX-Code.DebugTreeItem): IDebugVisualizationTreeItem {
		let id = this._debugVisualizationTreeItemIds.get(item);
		if (!id) {
			id = this._debugVisualizationTreeItemIdsCounter++;
			this._debugVisualizationTreeItemIds.set(item, id);
			this._debugVisualizationElements.set(id, { provider: treeId, item });
		}

		return Convert.DebugTreeItem.from(item, id);
	}

	public asDebugSourceUri(src: ProX-Code.DebugProtocolSource, session?: ProX-Code.DebugSession): URI {

		const source = <any>src;

		if (typeof source.sourceReference === 'number' && source.sourceReference > 0) {
			// src can be retrieved via DAP's "source" request

			let debug = `debug:${encodeURIComponent(source.path || '')}`;
			let sep = '?';

			if (session) {
				debug += `${sep}session=${encodeURIComponent(session.id)}`;
				sep = '&';
			}

			debug += `${sep}ref=${source.sourceReference}`;

			return URI.parse(debug);
		} else if (source.path) {
			// src is just a local file path
			return URI.file(source.path);
		} else {
			throw new Error(`cannot create uri from DAP 'source' object; properties 'path' and 'sourceReference' are both missing.`);
		}
	}

	private registerAllDebugTypes(extensionRegistry: ExtensionDescriptionRegistry) {

		const debugTypes: string[] = [];

		for (const ed of extensionRegistry.getAllExtensionDescriptions()) {
			if (ed.contributes) {
				const debuggers = <IDebuggerContribution[]>ed.contributes['debuggers'];
				if (debuggers && debuggers.length > 0) {
					for (const dbg of debuggers) {
						if (isDebuggerMainContribution(dbg)) {
							debugTypes.push(dbg.type);
						}
					}
				}
			}
		}

		this._debugServiceProxy.$registerDebugTypes(debugTypes);
	}

	// extension debug API


	get activeStackItem(): ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined {
		return this._activeStackItem;
	}

	get onDidChangeActiveStackItem(): Event<ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined> {
		return this._onDidChangeActiveStackItem.event;
	}

	get onDidChangeBreakpoints(): Event<ProX-Code.BreakpointsChangeEvent> {
		return this._onDidChangeBreakpoints.event;
	}

	get breakpoints(): ProX-Code.Breakpoint[] {
		const result: ProX-Code.Breakpoint[] = [];
		this._breakpoints.forEach(bp => result.push(bp));
		return result;
	}

	public async $resolveDebugVisualizer(id: number, token: CancellationToken): Promise<MainThreadDebugVisualization> {
		const visualizer = this._visualizers.get(id);
		if (!visualizer) {
			throw new Error(`No debug visualizer found with id '${id}'`);
		}

		let { v, provider, extensionId } = visualizer;
		if (!v.visualization) {
			v = await provider.resolveDebugVisualization?.(v, token) || v;
			visualizer.v = v;
		}

		if (!v.visualization) {
			throw new Error(`No visualization returned from resolveDebugVisualization in '${provider}'`);
		}

		return this.serializeVisualization(extensionId, v.visualization)!;
	}

	public async $executeDebugVisualizerCommand(id: number): Promise<void> {
		const visualizer = this._visualizers.get(id);
		if (!visualizer) {
			throw new Error(`No debug visualizer found with id '${id}'`);
		}

		const command = visualizer.v.visualization;
		if (command && 'command' in command) {
			this._commands.executeCommand(command.command, ...(command.arguments || []));
		}
	}

	private hydrateVisualizationContext(context: IDebugVisualizationContext): ProX-Code.DebugVisualizationContext | undefined {
		const session = this._debugSessions.get(context.sessionId);
		return session && {
			session: session.api,
			variable: context.variable,
			containerId: context.containerId,
			frameId: context.frameId,
			threadId: context.threadId,
		};
	}

	public async $provideDebugVisualizers(extensionId: string, id: string, context: IDebugVisualizationContext, token: CancellationToken): Promise<IDebugVisualization.Serialized[]> {
		const contextHydrated = this.hydrateVisualizationContext(context);
		const key = this.extensionVisKey(extensionId, id);
		const provider = this._debugVisualizationProviders.get(key);
		if (!contextHydrated || !provider) {
			return []; // probably ended in the meantime
		}

		const visualizations = await provider.provideDebugVisualization(contextHydrated, token);

		if (!visualizations) {
			return [];
		}

		return visualizations.map(v => {
			const id = ++this._visualizerIdCounter;
			this._visualizers.set(id, { v, provider, extensionId });
			const icon = v.iconPath ? this.getIconPathOrClass(v.iconPath) : undefined;
			return {
				id,
				name: v.name,
				iconClass: icon?.iconClass,
				iconPath: icon?.iconPath,
				visualization: this.serializeVisualization(extensionId, v.visualization),
			};
		});
	}

	public $disposeDebugVisualizers(ids: number[]): void {
		for (const id of ids) {
			this._visualizers.delete(id);
		}
	}

	public registerDebugVisualizationProvider<T extends ProX-Code.DebugVisualization>(manifest: IExtensionDescription, id: string, provider: ProX-Code.DebugVisualizationProvider<T>): ProX-Code.Disposable {
		if (!manifest.contributes?.debugVisualizers?.some(r => r.id === id)) {
			throw new Error(`Extensions may only call registerDebugVisualizationProvider() for renderers they contribute (got ${id})`);
		}

		const extensionId = ExtensionIdentifier.toKey(manifest.identifier);
		const key = this.extensionVisKey(extensionId, id);
		if (this._debugVisualizationProviders.has(key)) {
			throw new Error(`A debug visualization provider with id '${id}' is already registered`);
		}

		this._debugVisualizationProviders.set(key, provider);
		this._debugServiceProxy.$registerDebugVisualizer(extensionId, id);
		return toDisposable(() => {
			this._debugServiceProxy.$unregisterDebugVisualizer(extensionId, id);
			this._debugVisualizationProviders.delete(id);
		});
	}

	public addBreakpoints(breakpoints0: ProX-Code.Breakpoint[]): Promise<void> {
		// filter only new breakpoints
		const breakpoints = breakpoints0.filter(bp => {
			const id = bp.id;
			if (!this._breakpoints.has(id)) {
				this._breakpoints.set(id, bp);
				return true;
			}
			return false;
		});

		// send notification for added breakpoints
		this.fireBreakpointChanges(breakpoints, [], []);

		// convert added breakpoints to DTOs
		const dtos: Array<ISourceMultiBreakpointDto | IFunctionBreakpointDto> = [];
		const map = new Map<string, ISourceMultiBreakpointDto>();
		for (const bp of breakpoints) {
			if (bp instanceof SourceBreakpoint) {
				let dto = map.get(bp.location.uri.toString());
				if (!dto) {
					dto = {
						type: 'sourceMulti',
						uri: bp.location.uri,
						lines: []
					} satisfies ISourceMultiBreakpointDto;
					map.set(bp.location.uri.toString(), dto);
					dtos.push(dto);
				}
				dto.lines.push({
					id: bp.id,
					enabled: bp.enabled,
					condition: bp.condition,
					hitCondition: bp.hitCondition,
					logMessage: bp.logMessage,
					line: bp.location.range.start.line,
					character: bp.location.range.start.character,
					mode: bp.mode,
				});
			} else if (bp instanceof FunctionBreakpoint) {
				dtos.push({
					type: 'function',
					id: bp.id,
					enabled: bp.enabled,
					hitCondition: bp.hitCondition,
					logMessage: bp.logMessage,
					condition: bp.condition,
					functionName: bp.functionName,
					mode: bp.mode,
				});
			}
		}

		// send DTOs to ProX Code
		return this._debugServiceProxy.$registerBreakpoints(dtos);
	}

	public removeBreakpoints(breakpoints0: ProX-Code.Breakpoint[]): Promise<void> {
		// remove from array
		const breakpoints = breakpoints0.filter(b => this._breakpoints.delete(b.id));

		// send notification
		this.fireBreakpointChanges([], breakpoints, []);

		// unregister with ProX Code
		const ids = breakpoints.filter(bp => bp instanceof SourceBreakpoint).map(bp => bp.id);
		const fids = breakpoints.filter(bp => bp instanceof FunctionBreakpoint).map(bp => bp.id);
		const dids = breakpoints.filter(bp => bp instanceof DataBreakpoint).map(bp => bp.id);
		return this._debugServiceProxy.$unregisterBreakpoints(ids, fids, dids);
	}

	public startDebugging(folder: ProX-Code.WorkspaceFolder | undefined, nameOrConfig: string | ProX-Code.DebugConfiguration, options: ProX-Code.DebugSessionOptions): Promise<boolean> {
		const testRunMeta = options.testRun && this._testing.getMetadataForRun(options.testRun);

		return this._debugServiceProxy.$startDebugging(folder ? folder.uri : undefined, nameOrConfig, {
			parentSessionID: options.parentSession ? options.parentSession.id : undefined,
			lifecycleManagedByParent: options.lifecycleManagedByParent,
			repl: options.consoleMode === DebugConsoleMode.MergeWithParent ? 'mergeWithParent' : 'separate',
			noDebug: options.noDebug,
			compact: options.compact,
			suppressSaveBeforeStart: options.suppressSaveBeforeStart,
			testRun: testRunMeta && {
				runId: testRunMeta.runId,
				taskId: testRunMeta.taskId,
			},

			// Check debugUI for back-compat, #147264
			suppressDebugStatusbar: options.suppressDebugStatusbar ?? (options as any).debugUI?.simple,
			suppressDebugToolbar: options.suppressDebugToolbar ?? (options as any).debugUI?.simple,
			suppressDebugView: options.suppressDebugView ?? (options as any).debugUI?.simple,
		});
	}

	public stopDebugging(session?: ProX-Code.DebugSession): Promise<void> {
		return this._debugServiceProxy.$stopDebugging(session ? session.id : undefined);
	}

	public registerDebugConfigurationProvider(type: string, provider: ProX-Code.DebugConfigurationProvider, trigger: ProX-Code.DebugConfigurationProviderTriggerKind): ProX-Code.Disposable {

		if (!provider) {
			return new Disposable(() => { });
		}

		const handle = this._configProviderHandleCounter++;
		this._configProviders.push({ type, handle, provider });

		this._debugServiceProxy.$registerDebugConfigurationProvider(type, trigger,
			!!provider.provideDebugConfigurations,
			!!provider.resolveDebugConfiguration,
			!!provider.resolveDebugConfigurationWithSubstitutedVariables,
			handle);

		return new Disposable(() => {
			this._configProviders = this._configProviders.filter(p => p.provider !== provider);		// remove
			this._debugServiceProxy.$unregisterDebugConfigurationProvider(handle);
		});
	}

	public registerDebugAdapterDescriptorFactory(extension: IExtensionDescription, type: string, factory: ProX-Code.DebugAdapterDescriptorFactory): ProX-Code.Disposable {

		if (!factory) {
			return new Disposable(() => { });
		}

		// a DebugAdapterDescriptorFactory can only be registered in the extension that contributes the debugger
		if (!this.definesDebugType(extension, type)) {
			throw new Error(`a DebugAdapterDescriptorFactory can only be registered from the extension that defines the '${type}' debugger.`);
		}

		// make sure that only one factory for this type is registered
		if (this.getAdapterDescriptorFactoryByType(type)) {
			throw new Error(`a DebugAdapterDescriptorFactory can only be registered once per a type.`);
		}

		const handle = this._adapterFactoryHandleCounter++;
		this._adapterFactories.push({ type, handle, factory });

		this._debugServiceProxy.$registerDebugAdapterDescriptorFactory(type, handle);

		return new Disposable(() => {
			this._adapterFactories = this._adapterFactories.filter(p => p.factory !== factory);		// remove
			this._debugServiceProxy.$unregisterDebugAdapterDescriptorFactory(handle);
		});
	}

	public registerDebugAdapterTrackerFactory(type: string, factory: ProX-Code.DebugAdapterTrackerFactory): ProX-Code.Disposable {

		if (!factory) {
			return new Disposable(() => { });
		}

		const handle = this._trackerFactoryHandleCounter++;
		this._trackerFactories.push({ type, handle, factory });

		return new Disposable(() => {
			this._trackerFactories = this._trackerFactories.filter(p => p.factory !== factory);		// remove
		});
	}

	// RPC methods (ExtHostDebugServiceShape)

	public async $runInTerminal(args: DebugProtocol.RunInTerminalRequestArguments, sessionId: string): Promise<number | undefined> {
		return Promise.resolve(undefined);
	}

	public async $substituteVariables(folderUri: UriComponents | undefined, config: IConfig): Promise<IConfig> {
		let ws: IWorkspaceFolder | undefined;
		const folder = await this.getFolder(folderUri);
		if (folder) {
			ws = {
				uri: folder.uri,
				name: folder.name,
				index: folder.index,
				toResource: () => {
					throw new Error('Not implemented');
				}
			};
		}
		const variableResolver = await this._variableResolver.getResolver();
		return variableResolver.resolveAsync(ws, config);
	}

	protected createDebugAdapter(adapter: ProX-Code.DebugAdapterDescriptor, session: ExtHostDebugSession): AbstractDebugAdapter | undefined {
		if (adapter instanceof DebugAdapterInlineImplementation) {
			return new DirectDebugAdapter(adapter.implementation);
		}
		return undefined;
	}

	protected createSignService(): ISignService | undefined {
		return undefined;
	}

	public async $startDASession(debugAdapterHandle: number, sessionDto: IDebugSessionDto): Promise<void> {
		const mythis = this;

		const session = await this.getSession(sessionDto);

		return this.getAdapterDescriptor(this.getAdapterDescriptorFactoryByType(session.type), session).then(daDescriptor => {

			if (!daDescriptor) {
				throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}' (extension might have failed to activate)`);
			}

			const da = this.createDebugAdapter(daDescriptor, session);
			if (!da) {
				throw new Error(`Couldn't create a debug adapter for type '${session.type}'.`);
			}

			const debugAdapter = da;

			this._debugAdapters.set(debugAdapterHandle, debugAdapter);

			return this.getDebugAdapterTrackers(session).then(tracker => {

				if (tracker) {
					this._debugAdaptersTrackers.set(debugAdapterHandle, tracker);
				}

				debugAdapter.onMessage(async message => {

					if (message.type === 'request' && (<DebugProtocol.Request>message).command === 'handshake') {

						const request = <DebugProtocol.Request>message;

						const response: DebugProtocol.Response = {
							type: 'response',
							seq: 0,
							command: request.command,
							request_seq: request.seq,
							success: true
						};

						if (!this._signService) {
							this._signService = this.createSignService();
						}

						try {
							if (this._signService) {
								const signature = await this._signService.sign(request.arguments.value);
								response.body = {
									signature: signature
								};
								debugAdapter.sendResponse(response);
							} else {
								throw new Error('no signer');
							}
						} catch (e) {
							response.success = false;
							response.message = e.message;
							debugAdapter.sendResponse(response);
						}
					} else {
						if (tracker && tracker.onDidSendMessage) {
							tracker.onDidSendMessage(message);
						}

						// DA -> ProX Code
						try {
							// Try to catch details for #233167
							message = convertToVSCPaths(message, true);
						} catch (e) {
							const type = message.type + '_' + ((message as any).command ?? (message as any).event ?? '');
							this._telemetryProxy.$publicLog2<DebugProtocolMessageErrorEvent, DebugProtocolMessageErrorClassification>('debugProtocolMessageError', { type, from: session.type });
							throw e;
						}

						mythis._debugServiceProxy.$acceptDAMessage(debugAdapterHandle, message);
					}
				});
				debugAdapter.onError(err => {
					if (tracker && tracker.onError) {
						tracker.onError(err);
					}
					this._debugServiceProxy.$acceptDAError(debugAdapterHandle, err.name, err.message, err.stack);
				});
				debugAdapter.onExit((code: number | null) => {
					if (tracker && tracker.onExit) {
						tracker.onExit(code ?? undefined, undefined);
					}
					this._debugServiceProxy.$acceptDAExit(debugAdapterHandle, code ?? undefined, undefined);
				});

				if (tracker && tracker.onWillStartSession) {
					tracker.onWillStartSession();
				}

				return debugAdapter.startSession();
			});
		});
	}

	public $sendDAMessage(debugAdapterHandle: number, message: DebugProtocol.ProtocolMessage): void {

		// ProX Code -> DA
		message = convertToDAPaths(message, false);

		const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle);	// TODO@AW: same handle?
		if (tracker && tracker.onWillReceiveMessage) {
			tracker.onWillReceiveMessage(message);
		}

		const da = this._debugAdapters.get(debugAdapterHandle);
		da?.sendMessage(message);
	}

	public $stopDASession(debugAdapterHandle: number): Promise<void> {

		const tracker = this._debugAdaptersTrackers.get(debugAdapterHandle);
		this._debugAdaptersTrackers.delete(debugAdapterHandle);
		if (tracker && tracker.onWillStopSession) {
			tracker.onWillStopSession();
		}

		const da = this._debugAdapters.get(debugAdapterHandle);
		this._debugAdapters.delete(debugAdapterHandle);
		if (da) {
			return da.stopSession();
		} else {
			return Promise.resolve(void 0);
		}
	}

	public $acceptBreakpointsDelta(delta: IBreakpointsDeltaDto): void {

		const a: ProX-Code.Breakpoint[] = [];
		const r: ProX-Code.Breakpoint[] = [];
		const c: ProX-Code.Breakpoint[] = [];

		if (delta.added) {
			for (const bpd of delta.added) {
				const id = bpd.id;
				if (id && !this._breakpoints.has(id)) {
					let bp: Breakpoint;
					if (bpd.type === 'function') {
						bp = new FunctionBreakpoint(bpd.functionName, bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
					} else if (bpd.type === 'data') {
						bp = new DataBreakpoint(bpd.label, bpd.dataId, bpd.canPersist, bpd.enabled, bpd.hitCondition, bpd.condition, bpd.logMessage, bpd.mode);
					} else {
						const uri = URI.revive(bpd.uri);
						bp = new SourceBreakpoint(new Location(uri, new Position(bpd.line, bpd.character)), bpd.enabled, bpd.condition, bpd.hitCondition, bpd.logMessage, bpd.mode);
					}
					setBreakpointId(bp, id);
					this._breakpoints.set(id, bp);
					a.push(bp);
				}
			}
		}

		if (delta.removed) {
			for (const id of delta.removed) {
				const bp = this._breakpoints.get(id);
				if (bp) {
					this._breakpoints.delete(id);
					r.push(bp);
				}
			}
		}

		if (delta.changed) {
			for (const bpd of delta.changed) {
				if (bpd.id) {
					const bp = this._breakpoints.get(bpd.id);
					if (bp) {
						if (bp instanceof FunctionBreakpoint && bpd.type === 'function') {
							const fbp = <any>bp;
							fbp.enabled = bpd.enabled;
							fbp.condition = bpd.condition;
							fbp.hitCondition = bpd.hitCondition;
							fbp.logMessage = bpd.logMessage;
							fbp.functionName = bpd.functionName;
						} else if (bp instanceof SourceBreakpoint && bpd.type === 'source') {
							const sbp = <any>bp;
							sbp.enabled = bpd.enabled;
							sbp.condition = bpd.condition;
							sbp.hitCondition = bpd.hitCondition;
							sbp.logMessage = bpd.logMessage;
							sbp.location = new Location(URI.revive(bpd.uri), new Position(bpd.line, bpd.character));
						}
						c.push(bp);
					}
				}
			}
		}

		this.fireBreakpointChanges(a, r, c);
	}

	public async $acceptStackFrameFocus(focusDto: IThreadFocusDto | IStackFrameFocusDto | undefined): Promise<void> {
		let focus: ProX-Code.DebugThread | ProX-Code.DebugStackFrame | undefined;
		if (focusDto) {
			const session = await this.getSession(focusDto.sessionId);
			if (focusDto.kind === 'thread') {
				focus = new DebugThread(session.api, focusDto.threadId);
			} else {
				focus = new DebugStackFrame(session.api, focusDto.threadId, focusDto.frameId);
			}
		}

		this._activeStackItem = focus;
		this._onDidChangeActiveStackItem.fire(this._activeStackItem);
	}

	public $provideDebugConfigurations(configProviderHandle: number, folderUri: UriComponents | undefined, token: CancellationToken): Promise<ProX-Code.DebugConfiguration[]> {
		return asPromise(async () => {
			const provider = this.getConfigProviderByHandle(configProviderHandle);
			if (!provider) {
				throw new Error('no DebugConfigurationProvider found');
			}
			if (!provider.provideDebugConfigurations) {
				throw new Error('DebugConfigurationProvider has no method provideDebugConfigurations');
			}
			const folder = await this.getFolder(folderUri);
			return provider.provideDebugConfigurations(folder, token);
		}).then(debugConfigurations => {
			if (!debugConfigurations) {
				throw new Error('nothing returned from DebugConfigurationProvider.provideDebugConfigurations');
			}
			return debugConfigurations;
		});
	}

	public $resolveDebugConfiguration(configProviderHandle: number, folderUri: UriComponents | undefined, debugConfiguration: ProX-Code.DebugConfiguration, token: CancellationToken): Promise<ProX-Code.DebugConfiguration | null | undefined> {
		return asPromise(async () => {
			const provider = this.getConfigProviderByHandle(configProviderHandle);
			if (!provider) {
				throw new Error('no DebugConfigurationProvider found');
			}
			if (!provider.resolveDebugConfiguration) {
				throw new Error('DebugConfigurationProvider has no method resolveDebugConfiguration');
			}
			const folder = await this.getFolder(folderUri);
			return provider.resolveDebugConfiguration(folder, debugConfiguration, token);
		});
	}

	public $resolveDebugConfigurationWithSubstitutedVariables(configProviderHandle: number, folderUri: UriComponents | undefined, debugConfiguration: ProX-Code.DebugConfiguration, token: CancellationToken): Promise<ProX-Code.DebugConfiguration | null | undefined> {
		return asPromise(async () => {
			const provider = this.getConfigProviderByHandle(configProviderHandle);
			if (!provider) {
				throw new Error('no DebugConfigurationProvider found');
			}
			if (!provider.resolveDebugConfigurationWithSubstitutedVariables) {
				throw new Error('DebugConfigurationProvider has no method resolveDebugConfigurationWithSubstitutedVariables');
			}
			const folder = await this.getFolder(folderUri);
			return provider.resolveDebugConfigurationWithSubstitutedVariables(folder, debugConfiguration, token);
		});
	}

	public async $provideDebugAdapter(adapterFactoryHandle: number, sessionDto: IDebugSessionDto): Promise<Dto<IAdapterDescriptor>> {
		const adapterDescriptorFactory = this.getAdapterDescriptorFactoryByHandle(adapterFactoryHandle);
		if (!adapterDescriptorFactory) {
			return Promise.reject(new Error('no adapter descriptor factory found for handle'));
		}
		const session = await this.getSession(sessionDto);
		return this.getAdapterDescriptor(adapterDescriptorFactory, session).then(adapterDescriptor => {
			if (!adapterDescriptor) {
				throw new Error(`Couldn't find a debug adapter descriptor for debug type '${session.type}'`);
			}
			return this.convertToDto(adapterDescriptor);
		});
	}

	public async $acceptDebugSessionStarted(sessionDto: IDebugSessionDto): Promise<void> {
		const session = await this.getSession(sessionDto);
		this._onDidStartDebugSession.fire(session.api);
	}

	public async $acceptDebugSessionTerminated(sessionDto: IDebugSessionDto): Promise<void> {
		const session = await this.getSession(sessionDto);
		if (session) {
			this._onDidTerminateDebugSession.fire(session.api);
			this._debugSessions.delete(session.id);
		}
	}

	public async $acceptDebugSessionActiveChanged(sessionDto: IDebugSessionDto | undefined): Promise<void> {
		this._activeDebugSession = sessionDto ? await this.getSession(sessionDto) : undefined;
		this._onDidChangeActiveDebugSession.fire(this._activeDebugSession?.api);
	}

	public async $acceptDebugSessionNameChanged(sessionDto: IDebugSessionDto, name: string): Promise<void> {
		const session = await this.getSession(sessionDto);
		session?._acceptNameChanged(name);
	}

	public async $acceptDebugSessionCustomEvent(sessionDto: IDebugSessionDto, event: any): Promise<void> {
		const session = await this.getSession(sessionDto);
		const ee: ProX-Code.DebugSessionCustomEvent = {
			session: session.api,
			event: event.event,
			body: event.body
		};
		this._onDidReceiveDebugSessionCustomEvent.fire(ee);
	}

	// private & dto helpers

	private convertToDto(x: ProX-Code.DebugAdapterDescriptor): Dto<IAdapterDescriptor> {
		if (x instanceof DebugAdapterExecutable) {
			return this.convertExecutableToDto(x);
		} else if (x instanceof DebugAdapterServer) {
			return this.convertServerToDto(x);
		} else if (x instanceof DebugAdapterNamedPipeServer) {
			return this.convertPipeServerToDto(x);
		} else if (x instanceof DebugAdapterInlineImplementation) {
			return this.convertImplementationToDto(x);
		} else {
			throw new Error('convertToDto unexpected type');
		}
	}

	protected convertExecutableToDto(x: DebugAdapterExecutable): IDebugAdapterExecutable {
		return {
			type: 'executable',
			command: x.command,
			args: x.args,
			options: x.options
		};
	}

	protected convertServerToDto(x: DebugAdapterServer): IDebugAdapterServer {
		return {
			type: 'server',
			port: x.port,
			host: x.host
		};
	}

	protected convertPipeServerToDto(x: DebugAdapterNamedPipeServer): IDebugAdapterNamedPipeServer {
		return {
			type: 'pipeServer',
			path: x.path
		};
	}

	protected convertImplementationToDto(x: DebugAdapterInlineImplementation): IDebugAdapterImpl {
		return {
			type: 'implementation',
		};
	}

	private getAdapterDescriptorFactoryByType(type: string): ProX-Code.DebugAdapterDescriptorFactory | undefined {
		const results = this._adapterFactories.filter(p => p.type === type);
		if (results.length > 0) {
			return results[0].factory;
		}
		return undefined;
	}

	private getAdapterDescriptorFactoryByHandle(handle: number): ProX-Code.DebugAdapterDescriptorFactory | undefined {
		const results = this._adapterFactories.filter(p => p.handle === handle);
		if (results.length > 0) {
			return results[0].factory;
		}
		return undefined;
	}

	private getConfigProviderByHandle(handle: number): ProX-Code.DebugConfigurationProvider | undefined {
		const results = this._configProviders.filter(p => p.handle === handle);
		if (results.length > 0) {
			return results[0].provider;
		}
		return undefined;
	}

	private definesDebugType(ed: IExtensionDescription, type: string) {
		if (ed.contributes) {
			const debuggers = ed.contributes['debuggers'];
			if (debuggers && debuggers.length > 0) {
				for (const dbg of debuggers) {
					// only debugger contributions with a "label" are considered a "defining" debugger contribution
					if (dbg.label && dbg.type) {
						if (dbg.type === type) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}

	private getDebugAdapterTrackers(session: ExtHostDebugSession): Promise<ProX-Code.DebugAdapterTracker | undefined> {

		const config = session.configuration;
		const type = config.type;

		const promises = this._trackerFactories
			.filter(tuple => tuple.type === type || tuple.type === '*')
			.map(tuple => asPromise<ProX-Code.ProviderResult<ProX-Code.DebugAdapterTracker>>(() => tuple.factory.createDebugAdapterTracker(session.api)).then(p => p, err => null));

		return Promise.race([
			Promise.all(promises).then(result => {
				const trackers = coalesce(result);	// filter null
				if (trackers.length > 0) {
					return new MultiTracker(trackers);
				}
				return undefined;
			}),
			new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 1000)),
		]).catch(err => {
			// ignore errors
			return undefined;
		});
	}

	private async getAdapterDescriptor(adapterDescriptorFactory: ProX-Code.DebugAdapterDescriptorFactory | undefined, session: ExtHostDebugSession): Promise<ProX-Code.DebugAdapterDescriptor | undefined> {

		// a "debugServer" attribute in the launch config takes precedence
		const serverPort = session.configuration.debugServer;
		if (typeof serverPort === 'number') {
			return Promise.resolve(new DebugAdapterServer(serverPort));
		}

		if (adapterDescriptorFactory) {
			const extensionRegistry = await this._extensionService.getExtensionRegistry();
			return asPromise(() => adapterDescriptorFactory.createDebugAdapterDescriptor(session.api, this.daExecutableFromPackage(session, extensionRegistry))).then(daDescriptor => {
				if (daDescriptor) {
					return daDescriptor;
				}
				return undefined;
			});
		}

		// fallback: use executable information from package.json
		const extensionRegistry = await this._extensionService.getExtensionRegistry();
		return Promise.resolve(this.daExecutableFromPackage(session, extensionRegistry));
	}

	protected daExecutableFromPackage(session: ExtHostDebugSession, extensionRegistry: ExtensionDescriptionRegistry): DebugAdapterExecutable | undefined {
		return undefined;
	}

	private fireBreakpointChanges(added: ProX-Code.Breakpoint[], removed: ProX-Code.Breakpoint[], changed: ProX-Code.Breakpoint[]) {
		if (added.length > 0 || removed.length > 0 || changed.length > 0) {
			this._onDidChangeBreakpoints.fire(Object.freeze({
				added,
				removed,
				changed,
			}));
		}
	}

	private async getSession(dto: IDebugSessionDto): Promise<ExtHostDebugSession> {
		if (dto) {
			if (typeof dto === 'string') {
				const ds = this._debugSessions.get(dto);
				if (ds) {
					return ds;
				}
			} else {
				let ds = this._debugSessions.get(dto.id);
				if (!ds) {
					const folder = await this.getFolder(dto.folderUri);
					const parent = dto.parent ? this._debugSessions.get(dto.parent) : undefined;
					ds = new ExtHostDebugSession(this._debugServiceProxy, dto.id, dto.type, dto.name, folder, dto.configuration, parent?.api);
					this._debugSessions.set(ds.id, ds);
					this._debugServiceProxy.$sessionCached(ds.id);
				}
				return ds;
			}
		}
		throw new Error('cannot find session');
	}

	private getFolder(_folderUri: UriComponents | undefined): Promise<ProX-Code.WorkspaceFolder | undefined> {
		if (_folderUri) {
			const folderURI = URI.revive(_folderUri);
			return this._workspaceService.resolveWorkspaceFolder(folderURI);
		}
		return Promise.resolve(undefined);
	}

	private extensionVisKey(extensionId: string, id: string) {
		return `${extensionId}\0${id}`;
	}

	private serializeVisualization(extensionId: string, viz: ProX-Code.DebugVisualization['visualization']): MainThreadDebugVisualization | undefined {
		if (!viz) {
			return undefined;
		}

		if ('title' in viz && 'command' in viz) {
			return { type: DebugVisualizationType.Command };
		}

		if ('treeId' in viz) {
			return { type: DebugVisualizationType.Tree, id: `${extensionId}\0${viz.treeId}` };
		}

		throw new Error('Unsupported debug visualization type');
	}

	private getIconPathOrClass(icon: ProX-Code.DebugVisualization['iconPath']) {
		const iconPathOrIconClass = this.getIconUris(icon);
		let iconPath: { dark: URI; light?: URI | undefined } | undefined;
		let iconClass: string | undefined;
		if ('id' in iconPathOrIconClass) {
			iconClass = ThemeIconUtils.asClassName(iconPathOrIconClass);
		} else {
			iconPath = iconPathOrIconClass;
		}

		return {
			iconPath,
			iconClass
		};
	}

	private getIconUris(iconPath: ProX-Code.DebugVisualization['iconPath']): { dark: URI; light?: URI } | { id: string } {
		if (iconPath instanceof ThemeIcon) {
			return { id: iconPath.id };
		}
		const dark = typeof iconPath === 'object' && 'dark' in iconPath ? iconPath.dark : iconPath;
		const light = typeof iconPath === 'object' && 'light' in iconPath ? iconPath.light : iconPath;
		return {
			dark: (typeof dark === 'string' ? URI.file(dark) : dark) as URI,
			light: (typeof light === 'string' ? URI.file(light) : light) as URI,
		};
	}
}

export class ExtHostDebugSession {
	private apiSession?: ProX-Code.DebugSession;
	constructor(
		private _debugServiceProxy: MainThreadDebugServiceShape,
		private _id: DebugSessionUUID,
		private _type: string,
		private _name: string,
		private _workspaceFolder: ProX-Code.WorkspaceFolder | undefined,
		private _configuration: ProX-Code.DebugConfiguration,
		private _parentSession: ProX-Code.DebugSession | undefined) {
	}

	public get api(): ProX-Code.DebugSession {
		const that = this;
		return this.apiSession ??= Object.freeze({
			id: that._id,
			type: that._type,
			get name() {
				return that._name;
			},
			set name(name: string) {
				that._name = name;
				that._debugServiceProxy.$setDebugSessionName(that._id, name);
			},
			parentSession: that._parentSession,
			workspaceFolder: that._workspaceFolder,
			configuration: that._configuration,
			customRequest(command: string, args: any): Promise<any> {
				return that._debugServiceProxy.$customDebugAdapterRequest(that._id, command, args);
			},
			getDebugProtocolBreakpoint(breakpoint: ProX-Code.Breakpoint): Promise<ProX-Code.DebugProtocolBreakpoint | undefined> {
				return that._debugServiceProxy.$getDebugProtocolBreakpoint(that._id, breakpoint.id);
			}
		});
	}

	public get id(): string {
		return this._id;
	}

	public get type(): string {
		return this._type;
	}

	_acceptNameChanged(name: string) {
		this._name = name;
	}

	public get configuration(): ProX-Code.DebugConfiguration {
		return this._configuration;
	}
}

export class ExtHostDebugConsole {

	readonly value: ProX-Code.DebugConsole;

	constructor(proxy: MainThreadDebugServiceShape) {

		this.value = Object.freeze({
			append(value: string): void {
				proxy.$appendDebugConsole(value);
			},
			appendLine(value: string): void {
				this.append(value + '\n');
			}
		});
	}
}

interface ConfigProviderTuple {
	type: string;
	handle: number;
	provider: ProX-Code.DebugConfigurationProvider;
}

interface DescriptorFactoryTuple {
	type: string;
	handle: number;
	factory: ProX-Code.DebugAdapterDescriptorFactory;
}

interface TrackerFactoryTuple {
	type: string;
	handle: number;
	factory: ProX-Code.DebugAdapterTrackerFactory;
}

class MultiTracker implements ProX-Code.DebugAdapterTracker {

	constructor(private trackers: ProX-Code.DebugAdapterTracker[]) {
	}

	onWillStartSession(): void {
		this.trackers.forEach(t => t.onWillStartSession ? t.onWillStartSession() : undefined);
	}

	onWillReceiveMessage(message: any): void {
		this.trackers.forEach(t => t.onWillReceiveMessage ? t.onWillReceiveMessage(message) : undefined);
	}

	onDidSendMessage(message: any): void {
		this.trackers.forEach(t => t.onDidSendMessage ? t.onDidSendMessage(message) : undefined);
	}

	onWillStopSession(): void {
		this.trackers.forEach(t => t.onWillStopSession ? t.onWillStopSession() : undefined);
	}

	onError(error: Error): void {
		this.trackers.forEach(t => t.onError ? t.onError(error) : undefined);
	}

	onExit(code: number, signal: string): void {
		this.trackers.forEach(t => t.onExit ? t.onExit(code, signal) : undefined);
	}
}

/*
 * Call directly into a debug adapter implementation
 */
class DirectDebugAdapter extends AbstractDebugAdapter {

	constructor(private implementation: ProX-Code.DebugAdapter) {
		super();

		implementation.onDidSendMessage((message: ProX-Code.DebugProtocolMessage) => {
			this.acceptMessage(message as DebugProtocol.ProtocolMessage);
		});
	}

	startSession(): Promise<void> {
		return Promise.resolve(undefined);
	}

	sendMessage(message: DebugProtocol.ProtocolMessage): void {
		this.implementation.handleMessage(message);
	}

	stopSession(): Promise<void> {
		this.implementation.dispose();
		return Promise.resolve(undefined);
	}
}


export class WorkerExtHostDebugService extends ExtHostDebugServiceBase {
	constructor(
		@IExtHostRpcService extHostRpcService: IExtHostRpcService,
		@IExtHostWorkspace workspaceService: IExtHostWorkspace,
		@IExtHostExtensionService extensionService: IExtHostExtensionService,
		@IExtHostConfiguration configurationService: IExtHostConfiguration,
		@IExtHostEditorTabs editorTabs: IExtHostEditorTabs,
		@IExtHostVariableResolverProvider variableResolver: IExtHostVariableResolverProvider,
		@IExtHostCommands commands: IExtHostCommands,
		@IExtHostTesting testing: IExtHostTesting,
	) {
		super(extHostRpcService, workspaceService, extensionService, configurationService, editorTabs, variableResolver, commands, testing);
	}
}

// Collecting info for #233167 specifically
type DebugProtocolMessageErrorClassification = {
	from: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The type of the debug adapter that the event is from.' };
	type: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The type of the event that was malformed.' };
	owner: 'roblourens';
	comment: 'Sent to collect details about misbehaving debug extensions.';
};

type DebugProtocolMessageErrorEvent = {
	from: string;
	type: string;
};
