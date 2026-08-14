/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application, Logger } from '../../../../automation';
import { installAllHandlers } from '../../utils';
import * as assert from 'assert';

export function setup(logger: Logger) {
	describe('Codicon', () => {
		installAllHandlers(logger);

		it('verifies that codicon font loads correctly', async function () {
			const app = this.app as Application;
			
			// Wait for the workbench to be fully loaded
			await app.workbench.explorer.openExplorerView();
			
			// Evaluate document.fonts.check to ensure the codicon font has been successfully loaded and decoded by the renderer
			const isCodiconLoaded = await app.code.driver.evaluate({
				expression: `document.fonts.check('16px codicon')`,
				returnByValue: true
			});
			
			assert.ok(isCodiconLoaded.result.value, 'The codicon font should be loaded by the browser.');
		});
	});
}
