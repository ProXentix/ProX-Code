/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const SharedProcessLifecycle = {
	exit: 'ProX-Code:electron-main->shared-process=exit',
	ipcReady: 'ProX-Code:shared-process->electron-main=ipc-ready',
	initDone: 'ProX-Code:shared-process->electron-main=init-done'
};

export const SharedProcessChannelConnection = {
	request: 'ProX-Code:createSharedProcessChannelConnection',
	response: 'ProX-Code:createSharedProcessChannelConnectionResult'
};

export const SharedProcessRawConnection = {
	request: 'ProX-Code:createSharedProcessRawConnection',
	response: 'ProX-Code:createSharedProcessRawConnectionResult'
};
