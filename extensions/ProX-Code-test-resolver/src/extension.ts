/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as net from 'net';
import * as http from 'http';
import * as crypto from 'crypto';
import { downloadAndUnzipVSCodeServer } from './download';
import { terminateProcess } from './util/processes';

let extHostProcess: cp.ChildProcess | undefined;
const enum CharCode {
	Backspace = 8,
	LineFeed = 10
}

let outputChannel: ProX-Code.OutputChannel;

const SLOWED_DOWN_CONNECTION_DELAY = 800;

export function activate(context: ProX-Code.ExtensionContext) {

	let connectionPaused = false;
	const connectionPausedEvent = new ProX-Code.EventEmitter<boolean>();

	let connectionSlowedDown = false;
	const connectionSlowedDownEvent = new ProX-Code.EventEmitter<boolean>();
	const slowedDownConnections = new Set<Function>();
	connectionSlowedDownEvent.event(slowed => {
		if (!slowed) {
			for (const cb of slowedDownConnections) {
				cb();
			}
			slowedDownConnections.clear();
		}
	});

	function getTunnelFeatures(): ProX-Code.TunnelInformation['tunnelFeatures'] {
		return {
			elevation: true,
			privacyOptions: ProX-Code.workspace.getConfiguration('testresolver').get('supportPublicPorts') ? [
				{
					id: 'public',
					label: 'Public',
					themeIcon: 'eye'
				},
				{
					id: 'other',
					label: 'Other',
					themeIcon: 'circuit-board'
				},
				{
					id: 'private',
					label: 'Private',
					themeIcon: 'eye-closed'
				}
			] : []
		};
	}

	function maybeSlowdown(): Promise<void> | void {
		if (connectionSlowedDown) {
			return new Promise(resolve => {
				const handle = setTimeout(() => {
					resolve();
					slowedDownConnections.delete(resolve);
				}, SLOWED_DOWN_CONNECTION_DELAY);

				slowedDownConnections.add(() => {
					resolve();
					clearTimeout(handle);
				});
			});
		}
	}

	function doResolve(authority: string, progress: ProX-Code.Progress<{ message?: string; increment?: number }>): Promise<ProX-Code.ResolverResult> {
		if (connectionPaused) {
			throw ProX-Code.RemoteAuthorityResolverError.TemporarilyNotAvailable('Not available right now');
		}
		const connectionToken = String(crypto.randomInt(0xffffffffff));

		// eslint-disable-next-line no-async-promise-executor
		const serverPromise = new Promise<ProX-Code.ResolvedAuthority>(async (res, rej) => {
			progress.report({ message: 'Starting Test Resolver' });
			outputChannel = ProX-Code.window.createOutputChannel('TestResolver');

			let isResolved = false;
			async function processError(message: string) {
				outputChannel.appendLine(message);
				if (!isResolved) {
					isResolved = true;
					outputChannel.show();

					const result = await ProX-Code.window.showErrorMessage(message, { modal: true }, ...getActions());
					if (result) {
						await result.execute();
					}
					rej(ProX-Code.RemoteAuthorityResolverError.NotAvailable(message, true));
				}
			}

			let lastProgressLine = '';
			function processOutput(output: string) {
				outputChannel.append(output);
				for (let i = 0; i < output.length; i++) {
					const chr = output.charCodeAt(i);
					if (chr === CharCode.LineFeed) {
						const match = lastProgressLine.match(/Extension host agent listening on (\d+)/);
						if (match) {
							isResolved = true;
							res(new ProX-Code.ResolvedAuthority('127.0.0.1', parseInt(match[1], 10), connectionToken)); // success!
						}
						lastProgressLine = '';
					} else if (chr === CharCode.Backspace) {
						lastProgressLine = lastProgressLine.substr(0, lastProgressLine.length - 1);
					} else {
						lastProgressLine += output.charAt(i);
					}
				}
			}
			const delay = getConfiguration('startupDelay');
			if (typeof delay === 'number') {
				let remaining = Math.ceil(delay);
				outputChannel.append(`Delaying startup by ${remaining} seconds (configured by "testresolver.startupDelay").`);
				while (remaining > 0) {
					progress.report({ message: `Delayed resolving: Remaining ${remaining}s` });
					await (sleep(1000));
					remaining--;
				}
			}

			if (getConfiguration('startupError') === true) {
				processError('Test Resolver failed for testing purposes (configured by "testresolver.startupError").');
				return;
			}

			const { updateUrl, commit, quality, serverDataFolderName, serverApplicationName, dataFolderName } = getProductConfiguration();
			const commandArgs = ['--host=127.0.0.1', '--port=0', '--disable-telemetry', '--use-host-proxy', '--accept-server-license-terms'];
			const env = getNewEnv();
			const remoteDataDir = process.env['TESTRESOLVER_DATA_FOLDER'] || path.join(os.homedir(), `${serverDataFolderName || dataFolderName}-testresolver`);
			const logsDir = process.env['TESTRESOLVER_LOGS_FOLDER'];
			if (logsDir) {
				commandArgs.push('--logsPath', logsDir);
			}
			const logLevel = process.env['TESTRESOLVER_LOG_LEVEL'];
			if (logLevel) {
				commandArgs.push('--log', logLevel);
			}
			outputChannel.appendLine(`Using data folder at ${remoteDataDir}`);
			commandArgs.push('--server-data-dir', remoteDataDir);

			commandArgs.push('--connection-token', connectionToken);

			if (!commit) { // dev mode
				const serverCommand = process.platform === 'win32' ? 'code-server.bat' : 'code-server.sh';
				const ProX-CodePath = path.resolve(path.join(context.extensionPath, '..', '..'));
				const serverCommandPath = path.join(ProX-CodePath, 'scripts', serverCommand);

				outputChannel.appendLine(`Launching server: "${serverCommandPath}" ${commandArgs.join(' ')}`);
				const shell = (process.platform === 'win32');
				extHostProcess = cp.spawn(serverCommandPath, commandArgs, { env, cwd: ProX-CodePath, shell });
			} else {
				const extensionToInstall = process.env['TESTRESOLVER_INSTALL_BUILTIN_EXTENSION'];
				if (extensionToInstall) {
					commandArgs.push('--install-builtin-extension', extensionToInstall);
					commandArgs.push('--start-server');
				}
				const serverCommand = `${serverApplicationName}${process.platform === 'win32' ? '.cmd' : ''}`;
				let serverLocation = env['VSCODE_REMOTE_SERVER_PATH']; // support environment variable to specify location of server on disk
				if (!serverLocation) {
					const serverBin = path.join(remoteDataDir, 'bin');
					progress.report({ message: 'Installing VSCode Server' });
					serverLocation = await downloadAndUnzipVSCodeServer(updateUrl, commit, quality, serverBin, m => outputChannel.appendLine(m));
				}

				outputChannel.appendLine(`Using server build at ${serverLocation}`);
				outputChannel.appendLine(`Server arguments ${commandArgs.join(' ')}`);
				const shell = (process.platform === 'win32');
				extHostProcess = cp.spawn(path.join(serverLocation, 'bin', serverCommand), commandArgs, { env, cwd: serverLocation, shell });
			}
			extHostProcess.stdout!.on('data', (data: Buffer) => processOutput(data.toString()));
			extHostProcess.stderr!.on('data', (data: Buffer) => processOutput(data.toString()));
			extHostProcess.on('error', (error: Error) => {
				processError(`server failed with error:\n${error.message}`);
				extHostProcess = undefined;
			});
			extHostProcess.on('close', (code: number) => {
				processError(`server closed unexpectedly.\nError code: ${code}`);
				extHostProcess = undefined;
			});
			context.subscriptions.push({
				dispose: () => {
					if (extHostProcess) {
						terminateProcess(extHostProcess, context.extensionPath);
					}
				}
			});
		});

		return serverPromise.then((serverAddr): Promise<ProX-Code.ResolverResult> => {
			if (authority.includes('managed')) {
				console.log('Connecting via a managed authority');
				return Promise.resolve(new ProX-Code.ManagedResolvedAuthority(async () => {
					const remoteSocket = net.createConnection({ port: serverAddr.port });
					const dataEmitter = new ProX-Code.EventEmitter<Uint8Array>();
					const closeEmitter = new ProX-Code.EventEmitter<Error | undefined>();
					const endEmitter = new ProX-Code.EventEmitter<void>();

					await new Promise((res, rej) => {
						remoteSocket.on('data', d => dataEmitter.fire(d))
							.on('error', err => { rej(); closeEmitter.fire(err); })
							.on('close', () => endEmitter.fire())
							.on('end', () => endEmitter.fire())
							.on('connect', res);
					});


					return {
						onDidReceiveMessage: dataEmitter.event,
						onDidClose: closeEmitter.event,
						onDidEnd: endEmitter.event,
						send: d => remoteSocket.write(d),
						end: () => remoteSocket.end(),
					};
				}, connectionToken));
			}

			return new Promise<ProX-Code.ResolvedAuthority>((res, _rej) => {
				const proxyServer = net.createServer(proxySocket => {
					outputChannel.appendLine(`Proxy connection accepted`);
					let remoteReady = true, localReady = true;
					const remoteSocket = net.createConnection({ port: serverAddr.port });

					let isDisconnected = false;
					const handleConnectionPause = () => {
						const newIsDisconnected = connectionPaused;
						if (isDisconnected !== newIsDisconnected) {
							outputChannel.appendLine(`Connection state: ${newIsDisconnected ? 'open' : 'paused'}`);
							isDisconnected = newIsDisconnected;
							if (!isDisconnected) {
								outputChannel.appendLine(`Resume remote and proxy sockets.`);
								if (remoteSocket.isPaused() && localReady) {
									remoteSocket.resume();
								}
								if (proxySocket.isPaused() && remoteReady) {
									proxySocket.resume();
								}
							} else {
								outputChannel.appendLine(`Pausing remote and proxy sockets.`);
								if (!remoteSocket.isPaused()) {
									remoteSocket.pause();
								}
								if (!proxySocket.isPaused()) {
									proxySocket.pause();
								}
							}
						}
					};

					connectionPausedEvent.event(_ => handleConnectionPause());
					handleConnectionPause();

					proxySocket.on('data', async (data) => {
						await maybeSlowdown();
						remoteReady = remoteSocket.write(data);
						if (!remoteReady) {
							proxySocket.pause();
						}
					});
					remoteSocket.on('data', async (data) => {
						await maybeSlowdown();
						localReady = proxySocket.write(data);
						if (!localReady) {
							remoteSocket.pause();
						}
					});
					proxySocket.on('drain', () => {
						localReady = true;
						if (!isDisconnected) {
							remoteSocket.resume();
						}
					});
					remoteSocket.on('drain', () => {
						remoteReady = true;
						if (!isDisconnected) {
							proxySocket.resume();
						}
					});
					proxySocket.on('close', () => {
						outputChannel.appendLine(`Proxy socket closed, closing remote socket.`);
						remoteSocket.end();
					});
					remoteSocket.on('close', () => {
						outputChannel.appendLine(`Remote socket closed, closing proxy socket.`);
						proxySocket.end();
					});
					context.subscriptions.push({
						dispose: () => {
							proxySocket.end();
							remoteSocket.end();
						}
					});
				});
				proxyServer.listen(0, '127.0.0.1', () => {
					const port = (<net.AddressInfo>proxyServer.address()).port;
					outputChannel.appendLine(`Going through proxy at port ${port}`);
					res(new ProX-Code.ResolvedAuthority('127.0.0.1', port, connectionToken));
				});
				context.subscriptions.push({
					dispose: () => {
						proxyServer.close();
					}
				});
			});
		});
	}

	const authorityResolverDisposable = ProX-Code.workspace.registerRemoteAuthorityResolver('test', {
		async getCanonicalURI(uri: ProX-Code.Uri): Promise<ProX-Code.Uri> {
			return ProX-Code.Uri.file(uri.path);
		},
		resolve(_authority: string): Thenable<ProX-Code.ResolverResult> {
			return ProX-Code.window.withProgress({
				location: ProX-Code.ProgressLocation.Notification,
				title: 'Open TestResolver Remote ([details](command:ProX-Code-testresolver.showLog))',
				cancellable: false
			}, async (progress) => {
				const rr = await doResolve(_authority, progress);
				rr.tunnelFeatures = getTunnelFeatures();
				return rr;
			});
		},
		tunnelFactory,
		showCandidatePort
	});
	context.subscriptions.push(authorityResolverDisposable);

	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.newWindow', () => {
		return ProX-Code.commands.executeCommand('ProX-Code.newWindow', { remoteAuthority: 'test+test' });
	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.currentWindow', () => {
		return ProX-Code.commands.executeCommand('ProX-Code.newWindow', { remoteAuthority: 'test+test', reuseWindow: true });
	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.currentWindowManaged', () => {
		return ProX-Code.commands.executeCommand('ProX-Code.newWindow', { remoteAuthority: 'test+managed', reuseWindow: true });
	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.newWindowWithError', () => {
		return ProX-Code.commands.executeCommand('ProX-Code.newWindow', { remoteAuthority: 'test+error' });
	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.killServerAndTriggerHandledError', () => {
		authorityResolverDisposable.dispose();
		if (extHostProcess) {
			terminateProcess(extHostProcess, context.extensionPath);
		}
		ProX-Code.workspace.registerRemoteAuthorityResolver('test', {
			async resolve(_authority: string): Promise<ProX-Code.ResolvedAuthority> {
				setTimeout(async () => {
					await ProX-Code.window.showErrorMessage('Just a custom message.', { modal: true, useCustom: true }, 'OK', 'Great');
				}, 2000);
				throw ProX-Code.RemoteAuthorityResolverError.NotAvailable('Intentional Error', true);
			}
		});
	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.showLog', () => {
		if (outputChannel) {
			outputChannel.show();
		}
	}));

	const pauseStatusBarEntry = ProX-Code.window.createStatusBarItem(ProX-Code.StatusBarAlignment.Left);
	pauseStatusBarEntry.text = 'Remote connection paused. Click to undo';
	pauseStatusBarEntry.command = 'ProX-Code-testresolver.toggleConnectionPause';
	pauseStatusBarEntry.backgroundColor = new ProX-Code.ThemeColor('statusBarItem.errorBackground');

	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.toggleConnectionPause', () => {
		if (!connectionPaused) {
			connectionPaused = true;
			pauseStatusBarEntry.show();
		} else {
			connectionPaused = false;
			pauseStatusBarEntry.hide();
		}
		connectionPausedEvent.fire(connectionPaused);
	}));

	const slowdownStatusBarEntry = ProX-Code.window.createStatusBarItem(ProX-Code.StatusBarAlignment.Left);
	slowdownStatusBarEntry.text = 'Remote connection slowed down. Click to undo';
	slowdownStatusBarEntry.command = 'ProX-Code-testresolver.toggleConnectionSlowdown';
	slowdownStatusBarEntry.backgroundColor = new ProX-Code.ThemeColor('statusBarItem.errorBackground');

	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.toggleConnectionSlowdown', () => {
		if (!connectionSlowedDown) {
			connectionSlowedDown = true;
			slowdownStatusBarEntry.show();
		} else {
			connectionSlowedDown = false;
			slowdownStatusBarEntry.hide();
		}
		connectionSlowedDownEvent.fire(connectionSlowedDown);
	}));

	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.openTunnel', async () => {
		const result = await ProX-Code.window.showInputBox({
			prompt: 'Enter the remote port for the tunnel',
			value: '5000',
			validateInput: input => /^[\d]+$/.test(input) ? undefined : 'Not a valid number'
		});
		if (result) {
			const port = Number.parseInt(result);
			ProX-Code.workspace.openTunnel({
				remoteAddress: {
					host: '127.0.0.1',
					port: port
				},
				localAddressPort: port + 1
			});
		}

	}));
	context.subscriptions.push(ProX-Code.commands.registerCommand('ProX-Code-testresolver.startRemoteServer', async () => {
		const result = await ProX-Code.window.showInputBox({
			prompt: 'Enter the port for the remote server',
			value: '5000',
			validateInput: input => /^[\d]+$/.test(input) ? undefined : 'Not a valid number'
		});
		if (result) {
			runHTTPTestServer(Number.parseInt(result));
		}

	}));
	ProX-Code.commands.executeCommand('setContext', 'forwardedPortsViewEnabled', true);
}

type ActionItem = (ProX-Code.MessageItem & { execute: () => void });

function getActions(): ActionItem[] {
	const actions: ActionItem[] = [];
	const isDirty = ProX-Code.workspace.textDocuments.some(d => d.isDirty) || ProX-Code.workspace.workspaceFile && ProX-Code.workspace.workspaceFile.scheme === 'untitled';

	actions.push({
		title: 'Retry',
		execute: async () => {
			await ProX-Code.commands.executeCommand('workbench.action.reloadWindow');
		}
	});
	if (!isDirty) {
		actions.push({
			title: 'Close Remote',
			execute: async () => {
				await ProX-Code.commands.executeCommand('ProX-Code.newWindow', { reuseWindow: true, remoteAuthority: null });
			}
		});
	}
	actions.push({
		title: 'Ignore',
		isCloseAffordance: true,
		execute: async () => {
			ProX-Code.commands.executeCommand('ProX-Code-testresolver.showLog'); // no need to wait
		}
	});
	return actions;
}

export interface IProductConfiguration {
	updateUrl: string;
	commit: string;
	quality: string;
	dataFolderName: string;
	serverApplicationName?: string;
	serverDataFolderName?: string;
}

function getProductConfiguration(): IProductConfiguration {
	const content = fs.readFileSync(path.join(ProX-Code.env.appRoot, 'product.json')).toString();
	return JSON.parse(content) as IProductConfiguration;
}

function getNewEnv(): { [x: string]: string | undefined } {
	const env = { ...process.env };
	delete env['ELECTRON_RUN_AS_NODE'];
	return env;
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

function getConfiguration<T>(id: string): T | undefined {
	return ProX-Code.workspace.getConfiguration('testresolver').get<T>(id);
}

const remoteServers: number[] = [];

async function showCandidatePort(_host: string, port: number, _detail: string): Promise<boolean> {
	return remoteServers.includes(port) || port === 100;
}

async function tunnelFactory(tunnelOptions: ProX-Code.TunnelOptions, tunnelCreationOptions: ProX-Code.TunnelCreationOptions): Promise<ProX-Code.Tunnel> {
	outputChannel.appendLine(`Tunnel factory request: Remote ${tunnelOptions.remoteAddress.port} -> local ${tunnelOptions.localAddressPort}`);
	if (tunnelCreationOptions.elevationRequired) {
		await ProX-Code.window.showInformationMessage('This is a fake elevation message. A real resolver would show a native elevation prompt.', { modal: true }, 'Ok');
	}

	return createTunnelService();

	function newTunnel(localAddress: { host: string; port: number }): ProX-Code.Tunnel {
		const onDidDispose: ProX-Code.EventEmitter<void> = new ProX-Code.EventEmitter();
		let isDisposed = false;
		return {
			localAddress,
			remoteAddress: tunnelOptions.remoteAddress,
			public: !!ProX-Code.workspace.getConfiguration('testresolver').get('supportPublicPorts') && tunnelOptions.public,
			privacy: tunnelOptions.privacy,
			protocol: tunnelOptions.protocol,
			onDidDispose: onDidDispose.event,
			dispose: () => {
				if (!isDisposed) {
					isDisposed = true;
					onDidDispose.fire();
				}
			}
		};
	}

	function createTunnelService(): Promise<ProX-Code.Tunnel> {
		return new Promise<ProX-Code.Tunnel>((res, _rej) => {
			const proxyServer = net.createServer(proxySocket => {
				const remoteSocket = net.createConnection({ host: tunnelOptions.remoteAddress.host, port: tunnelOptions.remoteAddress.port });
				remoteSocket.pipe(proxySocket);
				proxySocket.pipe(remoteSocket);
			});
			let localPort = 0;

			if (tunnelOptions.localAddressPort) {
				// When the tunnelOptions include a localAddressPort, we should use that.
				// However, the test resolver all runs on one machine, so if the localAddressPort is the same as the remote port,
				// then we must use a different port number.
				localPort = tunnelOptions.localAddressPort;
			} else {
				localPort = tunnelOptions.remoteAddress.port;
			}

			if (localPort === tunnelOptions.remoteAddress.port) {
				localPort += 1;
			}

			// The test resolver can't actually handle privileged ports, it only pretends to.
			if (localPort < 1024 && process.platform !== 'win32') {
				localPort = 0;
			}
			proxyServer.listen(localPort, '127.0.0.1', () => {
				const localPort = (<net.AddressInfo>proxyServer.address()).port;
				outputChannel.appendLine(`New test resolver tunnel service: Remote ${tunnelOptions.remoteAddress.port} -> local ${localPort}`);
				const tunnel = newTunnel({ host: '127.0.0.1', port: localPort });
				tunnel.onDidDispose(() => proxyServer.close());
				res(tunnel);
			});
		});
	}
}

function runHTTPTestServer(port: number): ProX-Code.Disposable {
	const server = http.createServer((_req, res) => {
		res.writeHead(200);
		res.end(`Hello, World from test server running on port ${port}!`);
	});
	remoteServers.push(port);
	server.listen(port, '127.0.0.1');
	const message = `Opened HTTP server on http://127.0.0.1:${port}`;
	console.log(message);
	outputChannel.appendLine(message);
	return {
		dispose: () => {
			server.close();
			const index = remoteServers.indexOf(port);
			if (index !== -1) {
				remoteServers.splice(index, 1);
			}
		}
	};
}
