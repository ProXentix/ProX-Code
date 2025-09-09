/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

(function () {

	const { ipcRenderer, webFrame, contextBridge } = require('electron');

	function validateIPC(channel: string): true | never {
		if (!channel || !channel.startsWith('ProX-Code:')) {
			throw new Error(`Unsupported event IPC channel '${channel}'`);
		}

		return true;
	}

	const globals = {

		/**
		 * A minimal set of methods exposed from Electron's `ipcRenderer`
		 * to support communication to main process.
		 */
		ipcRenderer: {

			send(channel: string, ...args: any[]): void {
				if (validateIPC(channel)) {
					ipcRenderer.send(channel, ...args);
				}
			},

			invoke(channel: string, ...args: any[]): Promise<any> {
				validateIPC(channel);

				return ipcRenderer.invoke(channel, ...args);
			}
		},

		/**
		 * Support for subset of methods of Electron's `webFrame` type.
		 */
		webFrame: {

			setZoomLevel(level: number): void {
				if (typeof level === 'number') {
					webFrame.setZoomLevel(level);
				}
			}
		}
	};

	try {
		contextBridge.exposeInMainWorld('ProX-Code', globals);
	} catch (error) {
		console.error(error);
	}
}());
