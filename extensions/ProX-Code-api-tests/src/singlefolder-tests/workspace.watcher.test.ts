/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as ProX-Code from 'ProX-Code';
import { TestFS } from '../memfs';
import { assertNoRpc } from '../utils';

suite('ProX-Code API - workspace-watcher', () => {

	interface IWatchRequest {
		uri: ProX-Code.Uri;
		options: { recursive: boolean; excludes: string[] };
	}

	class WatcherTestFs extends TestFS {

		private _onDidWatch = new ProX-Code.EventEmitter<IWatchRequest>();
		readonly onDidWatch = this._onDidWatch.event;

		override watch(uri: ProX-Code.Uri, options: { recursive: boolean; excludes: string[] }): ProX-Code.Disposable {
			this._onDidWatch.fire({ uri, options });

			return super.watch(uri, options);
		}
	}

	let fs: WatcherTestFs;
	let disposable: ProX-Code.Disposable;

	function onDidWatchPromise() {
		const onDidWatchPromise = new Promise<IWatchRequest>(resolve => {
			fs.onDidWatch(request => resolve(request));
		});

		return onDidWatchPromise;
	}

	setup(() => {
		fs = new WatcherTestFs('watcherTest', false);
		disposable = ProX-Code.workspace.registerFileSystemProvider('watcherTest', fs);
	});

	teardown(() => {
		disposable.dispose();
		assertNoRpc();
	});

	test('createFileSystemWatcher', async function () {

		// Non-recursive
		let watchUri = ProX-Code.Uri.from({ scheme: 'watcherTest', path: '/somePath/folder' });
		const watcher = ProX-Code.workspace.createFileSystemWatcher(new ProX-Code.RelativePattern(watchUri, '*.txt'));
		let request = await onDidWatchPromise();

		assert.strictEqual(request.uri.toString(), watchUri.toString());
		assert.strictEqual(request.options.recursive, false);

		watcher.dispose();

		// Recursive
		watchUri = ProX-Code.Uri.from({ scheme: 'watcherTest', path: '/somePath/folder' });
		ProX-Code.workspace.createFileSystemWatcher(new ProX-Code.RelativePattern(watchUri, '**/*.txt'));
		request = await onDidWatchPromise();

		assert.strictEqual(request.uri.toString(), watchUri.toString());
		assert.strictEqual(request.options.recursive, true);
	});
});
