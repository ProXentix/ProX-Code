/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import { createServer, Server } from 'net';
import { dirname } from 'path';
import * as ProX-Code from 'ProX-Code';

const enum State {
	Disabled = 'disabled',
	OnlyWithFlag = 'onlyWithFlag',
	Smart = 'smart',
	Always = 'always',
}
const TEXT_STATUSBAR_LABEL = {
	[State.Disabled]: ProX-Code.l10n.t('Auto Attach: Disabled'),
	[State.Always]: ProX-Code.l10n.t('Auto Attach: Always'),
	[State.Smart]: ProX-Code.l10n.t('Auto Attach: Smart'),
	[State.OnlyWithFlag]: ProX-Code.l10n.t('Auto Attach: With Flag'),
};

const TEXT_STATE_LABEL = {
	[State.Disabled]: ProX-Code.l10n.t('Disabled'),
	[State.Always]: ProX-Code.l10n.t('Always'),
	[State.Smart]: ProX-Code.l10n.t('Smart'),
	[State.OnlyWithFlag]: ProX-Code.l10n.t('Only With Flag'),
};
const TEXT_STATE_DESCRIPTION = {
	[State.Disabled]: ProX-Code.l10n.t('Auto attach is disabled and not shown in status bar'),
	[State.Always]: ProX-Code.l10n.t('Auto attach to every Node.js process launched in the terminal'),
	[State.Smart]: ProX-Code.l10n.t("Auto attach when running scripts that aren't in a node_modules folder"),
	[State.OnlyWithFlag]: ProX-Code.l10n.t('Only auto attach when the `--inspect` flag is given')
};
const TEXT_TOGGLE_WORKSPACE = ProX-Code.l10n.t('Toggle auto attach in this workspace');
const TEXT_TOGGLE_GLOBAL = ProX-Code.l10n.t('Toggle auto attach on this machine');
const TEXT_TEMP_DISABLE = ProX-Code.l10n.t('Temporarily disable auto attach in this session');
const TEXT_TEMP_ENABLE = ProX-Code.l10n.t('Re-enable auto attach');
const TEXT_TEMP_DISABLE_LABEL = ProX-Code.l10n.t('Auto Attach: Disabled');

const TOGGLE_COMMAND = 'extension.node-debug.toggleAutoAttach';
const STORAGE_IPC = 'jsDebugIpcState';

const SETTING_SECTION = 'debug.javascript';
const SETTING_STATE = 'autoAttachFilter';

/**
 * settings that, when changed, should cause us to refresh the state vars
 */
const SETTINGS_CAUSE_REFRESH = new Set(
	['autoAttachSmartPattern', SETTING_STATE].map(s => `${SETTING_SECTION}.${s}`),
);


let currentState: Promise<{ context: ProX-Code.ExtensionContext; state: State | null }>;
let statusItem: ProX-Code.StatusBarItem | undefined; // and there is no status bar item
let server: Promise<Server | undefined> | undefined; // auto attach server
let isTemporarilyDisabled = false; // whether the auto attach server is disabled temporarily, reset whenever the state changes

export function activate(context: ProX-Code.ExtensionContext): void {
	currentState = Promise.resolve({ context, state: null });

	context.subscriptions.push(
		ProX-Code.commands.registerCommand(TOGGLE_COMMAND, toggleAutoAttachSetting.bind(null, context)),
	);

	context.subscriptions.push(
		ProX-Code.workspace.onDidChangeConfiguration(e => {
			// Whenever a setting is changed, disable auto attach, and re-enable
			// it (if necessary) to refresh variables.
			if (
				e.affectsConfiguration(`${SETTING_SECTION}.${SETTING_STATE}`) ||
				[...SETTINGS_CAUSE_REFRESH].some(setting => e.affectsConfiguration(setting))
			) {
				refreshAutoAttachVars();
			}
		}),
	);

	updateAutoAttach(readCurrentState());
}

export async function deactivate(): Promise<void> {
	await destroyAttachServer();
}

function refreshAutoAttachVars() {
	updateAutoAttach(State.Disabled);
	updateAutoAttach(readCurrentState());
}

function getDefaultScope(info: ReturnType<ProX-Code.WorkspaceConfiguration['inspect']>) {
	if (!info) {
		return ProX-Code.ConfigurationTarget.Global;
	} else if (info.workspaceFolderValue) {
		return ProX-Code.ConfigurationTarget.WorkspaceFolder;
	} else if (info.workspaceValue) {
		return ProX-Code.ConfigurationTarget.Workspace;
	} else if (info.globalValue) {
		return ProX-Code.ConfigurationTarget.Global;
	}

	return ProX-Code.ConfigurationTarget.Global;
}

type PickResult = { state: State } | { setTempDisabled: boolean } | { scope: ProX-Code.ConfigurationTarget } | undefined;
type PickItem = ProX-Code.QuickPickItem & ({ state: State } | { setTempDisabled: boolean });

async function toggleAutoAttachSetting(context: ProX-Code.ExtensionContext, scope?: ProX-Code.ConfigurationTarget): Promise<void> {
	const section = ProX-Code.workspace.getConfiguration(SETTING_SECTION);
	scope = scope || getDefaultScope(section.inspect(SETTING_STATE));

	const isGlobalScope = scope === ProX-Code.ConfigurationTarget.Global;
	const quickPick = ProX-Code.window.createQuickPick<PickItem>();
	const current = readCurrentState();

	const items: PickItem[] = [State.Always, State.Smart, State.OnlyWithFlag, State.Disabled].map(state => ({
		state,
		label: TEXT_STATE_LABEL[state],
		description: TEXT_STATE_DESCRIPTION[state],
		alwaysShow: true,
	}));

	if (current !== State.Disabled) {
		items.unshift({
			setTempDisabled: !isTemporarilyDisabled,
			label: isTemporarilyDisabled ? TEXT_TEMP_ENABLE : TEXT_TEMP_DISABLE,
			alwaysShow: true,
		});
	}

	quickPick.items = items;
	quickPick.activeItems = isTemporarilyDisabled
		? [items[0]]
		: quickPick.items.filter(i => 'state' in i && i.state === current);
	quickPick.title = isGlobalScope ? TEXT_TOGGLE_GLOBAL : TEXT_TOGGLE_WORKSPACE;
	quickPick.buttons = [
		{
			iconPath: new ProX-Code.ThemeIcon(isGlobalScope ? 'folder' : 'globe'),
			tooltip: isGlobalScope ? TEXT_TOGGLE_WORKSPACE : TEXT_TOGGLE_GLOBAL,
		},
	];

	quickPick.show();

	let result = await new Promise<PickResult>(resolve => {
		quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]));
		quickPick.onDidHide(() => resolve(undefined));
		quickPick.onDidTriggerButton(() => {
			resolve({
				scope: isGlobalScope
					? ProX-Code.ConfigurationTarget.Workspace
					: ProX-Code.ConfigurationTarget.Global,
			});
		});
	});

	quickPick.dispose();

	if (!result) {
		return;
	}

	if ('scope' in result) {
		return await toggleAutoAttachSetting(context, result.scope);
	}

	if ('state' in result) {
		if (result.state !== current) {
			section.update(SETTING_STATE, result.state, scope);
		} else if (isTemporarilyDisabled) {
			result = { setTempDisabled: false };
		}
	}

	if ('setTempDisabled' in result) {
		updateStatusBar(context, current, true);
		isTemporarilyDisabled = result.setTempDisabled;
		if (result.setTempDisabled) {
			await destroyAttachServer();
		} else {
			await createAttachServer(context); // unsets temp disabled var internally
		}
		updateStatusBar(context, current, false);
	}
}

function readCurrentState(): State {
	const section = ProX-Code.workspace.getConfiguration(SETTING_SECTION);
	return section.get<State>(SETTING_STATE) ?? State.Disabled;
}

async function clearJsDebugAttachState(context: ProX-Code.ExtensionContext) {
	if (server || await context.workspaceState.get(STORAGE_IPC)) {
		await context.workspaceState.update(STORAGE_IPC, undefined);
		await ProX-Code.commands.executeCommand('extension.js-debug.clearAutoAttachVariables');
		await destroyAttachServer();
	}
}

/**
 * Turns auto attach on, and returns the server auto attach is listening on
 * if it's successful.
 */
async function createAttachServer(context: ProX-Code.ExtensionContext) {
	const ipcAddress = await getIpcAddress(context);
	if (!ipcAddress) {
		return undefined;
	}

	server = createServerInner(ipcAddress).catch(async err => {
		console.error('[debug-auto-launch] Error creating auto attach server: ', err);

		if (process.platform !== 'win32') {
			// On macOS, and perhaps some Linux distros, the temporary directory can
			// sometimes change. If it looks like that's the cause of a listener
			// error, automatically refresh the auto attach vars.
			try {
				await fs.access(dirname(ipcAddress));
			} catch {
				console.error('[debug-auto-launch] Refreshing variables from error');
				refreshAutoAttachVars();
				return undefined;
			}
		}

		return undefined;
	});

	return await server;
}

const createServerInner = async (ipcAddress: string) => {
	try {
		return await createServerInstance(ipcAddress);
	} catch (e) {
		// On unix/linux, the file can 'leak' if the process exits unexpectedly.
		// If we see this, try to delete the file and then listen again.
		await fs.unlink(ipcAddress).catch(() => undefined);
		return await createServerInstance(ipcAddress);
	}
};

const createServerInstance = (ipcAddress: string) =>
	new Promise<Server>((resolve, reject) => {
		const s = createServer(socket => {
			const data: Buffer[] = [];
			socket.on('data', async chunk => {
				if (chunk[chunk.length - 1] !== 0) {
					// terminated with NUL byte
					data.push(chunk);
					return;
				}

				data.push(chunk.slice(0, -1));

				try {
					await ProX-Code.commands.executeCommand(
						'extension.js-debug.autoAttachToProcess',
						JSON.parse(Buffer.concat(data).toString()),
					);
					socket.write(Buffer.from([0]));
				} catch (err) {
					socket.write(Buffer.from([1]));
					console.error(err);
				}
			});
		})
			.on('error', reject)
			.listen(ipcAddress, () => resolve(s));
	});

/**
 * Destroys the auto-attach server, if it's running.
 */
async function destroyAttachServer() {
	const instance = await server;
	if (instance) {
		await new Promise(r => instance.close(r));
	}
}

interface CachedIpcState {
	ipcAddress: string;
	jsDebugPath: string | undefined;
	settingsValue: string;
}

/**
 * Map of logic that happens when auto attach states are entered and exited.
 * All state transitions are queued and run in order; promises are awaited.
 */
const transitions: { [S in State]: (context: ProX-Code.ExtensionContext) => Promise<void> } = {
	async [State.Disabled](context) {
		await clearJsDebugAttachState(context);
	},

	async [State.OnlyWithFlag](context) {
		await createAttachServer(context);
	},

	async [State.Smart](context) {
		await createAttachServer(context);
	},

	async [State.Always](context) {
		await createAttachServer(context);
	},
};

/**
 * Ensures the status bar text reflects the current state.
 */
function updateStatusBar(context: ProX-Code.ExtensionContext, state: State, busy = false) {
	if (state === State.Disabled && !busy) {
		statusItem?.hide();
		return;
	}

	if (!statusItem) {
		statusItem = ProX-Code.window.createStatusBarItem('status.debug.autoAttach', ProX-Code.StatusBarAlignment.Left);
		statusItem.name = ProX-Code.l10n.t("Debug Auto Attach");
		statusItem.command = TOGGLE_COMMAND;
		statusItem.tooltip = ProX-Code.l10n.t("Automatically attach to node.js processes in debug mode");
		context.subscriptions.push(statusItem);
	}

	let text = busy ? '$(loading) ' : '';
	text += isTemporarilyDisabled ? TEXT_TEMP_DISABLE_LABEL : TEXT_STATUSBAR_LABEL[state];
	statusItem.text = text;
	statusItem.show();
}

/**
 * Updates the auto attach feature based on the user or workspace setting
 */
function updateAutoAttach(newState: State) {
	currentState = currentState.then(async ({ context, state: oldState }) => {
		if (newState === oldState) {
			return { context, state: oldState };
		}

		if (oldState !== null) {
			updateStatusBar(context, oldState, true);
		}

		await transitions[newState](context);
		isTemporarilyDisabled = false;
		updateStatusBar(context, newState, false);
		return { context, state: newState };
	});
}

/**
 * Gets the IPC address for the server to listen on for js-debug sessions. This
 * is cached such that we can reuse the address of previous activations.
 */
async function getIpcAddress(context: ProX-Code.ExtensionContext) {
	// Iff the `cachedData` is present, the js-debug registered environment
	// variables for this workspace--cachedData is set after successfully
	// invoking the attachment command.
	const cachedIpc = context.workspaceState.get<CachedIpcState>(STORAGE_IPC);

	// We invalidate the IPC data if the js-debug path changes, since that
	// indicates the extension was updated or reinstalled and the
	// environment variables will have been lost.
	// todo: make a way in the API to read environment data directly without activating js-debug?
	const jsDebugPath =
		ProX-Code.extensions.getExtension('ms-ProX-Code.js-debug-nightly')?.extensionPath ||
		ProX-Code.extensions.getExtension('ms-ProX-Code.js-debug')?.extensionPath;

	const settingsValue = getJsDebugSettingKey();
	if (cachedIpc?.jsDebugPath === jsDebugPath && cachedIpc?.settingsValue === settingsValue) {
		return cachedIpc.ipcAddress;
	}

	const result = await ProX-Code.commands.executeCommand<{ ipcAddress: string }>(
		'extension.js-debug.setAutoAttachVariables',
		cachedIpc?.ipcAddress,
	);
	if (!result) {
		return;
	}

	const ipcAddress = result.ipcAddress;
	await context.workspaceState.update(STORAGE_IPC, {
		ipcAddress,
		jsDebugPath,
		settingsValue,
	} satisfies CachedIpcState);

	return ipcAddress;
}

function getJsDebugSettingKey() {
	const o: { [key: string]: unknown } = {};
	const config = ProX-Code.workspace.getConfiguration(SETTING_SECTION);
	for (const setting of SETTINGS_CAUSE_REFRESH) {
		o[setting] = config.get(setting);
	}

	return JSON.stringify(o);
}
