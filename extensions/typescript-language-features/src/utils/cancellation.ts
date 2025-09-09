/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';

const noopDisposable = ProX-Code.Disposable.from();

export const nulToken: ProX-Code.CancellationToken = {
	isCancellationRequested: false,
	onCancellationRequested: () => noopDisposable
};
