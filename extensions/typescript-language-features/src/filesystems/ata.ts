/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { conditionalRegistration, requireGlobalConfiguration } from '../languageFeatures/util/dependentRegistration';
import { supportsReadableByteStreams } from '../utils/platform';
import { AutoInstallerFs } from './autoInstallerFs';
import { MemFs } from './memFs';
import { Logger } from '../logging/logger';

export function registerAtaSupport(logger: Logger): ProX-Code.Disposable {
	if (!supportsReadableByteStreams()) {
		return ProX-Code.Disposable.from();
	}

	return conditionalRegistration([
		requireGlobalConfiguration('typescript', 'tsserver.web.typeAcquisition.enabled'),
	], () => {
		return ProX-Code.Disposable.from(
			// Ata
			ProX-Code.workspace.registerFileSystemProvider('ProX-Code-global-typings', new MemFs('global-typings', logger), {
				isCaseSensitive: true,
				isReadonly: false,
			}),

			// Read accesses to node_modules
			ProX-Code.workspace.registerFileSystemProvider('ProX-Code-node-modules', new AutoInstallerFs(logger), {
				isCaseSensitive: true,
				isReadonly: false
			}));
	});
}
