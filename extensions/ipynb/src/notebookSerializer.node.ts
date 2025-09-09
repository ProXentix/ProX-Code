/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { DeferredPromise, generateUuid } from './helper';
import { NotebookSerializerBase } from './notebookSerializer';

export class NotebookSerializer extends NotebookSerializerBase {
	private experimentalSave = ProX-Code.workspace.getConfiguration('ipynb').get('experimental.serialization', false);
	private worker?: import('node:worker_threads').Worker;
	private tasks = new Map<string, DeferredPromise<Uint8Array>>();

	constructor(context: ProX-Code.ExtensionContext) {
		super(context);
		context.subscriptions.push(ProX-Code.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('ipynb.experimental.serialization')) {
				this.experimentalSave = ProX-Code.workspace.getConfiguration('ipynb').get('experimental.serialization', false);
			}
		}));
	}

	override dispose() {
		try {
			void this.worker?.terminate();
		} catch {
			//
		}
		super.dispose();
	}

	public override async serializeNotebook(data: ProX-Code.NotebookData, token: ProX-Code.CancellationToken): Promise<Uint8Array> {
		if (this.disposed) {
			return new Uint8Array(0);
		}

		if (this.experimentalSave) {
			return this.serializeViaWorker(data);
		}

		return super.serializeNotebook(data, token);
	}

	private async startWorker() {
		if (this.disposed) {
			throw new Error('Serializer disposed');
		}
		if (this.worker) {
			return this.worker;
		}
		const { Worker } = await import('node:worker_threads');
		const outputDir = getOutputDir(this.context);
		this.worker = new Worker(ProX-Code.Uri.joinPath(this.context.extensionUri, outputDir, 'notebookSerializerWorker.js').fsPath, {});
		this.worker.on('exit', (exitCode) => {
			if (!this.disposed) {
				console.error(`IPynb Notebook Serializer Worker exited unexpectedly`, exitCode);
			}
			this.worker = undefined;
		});
		this.worker.on('message', (result: { data: Uint8Array; id: string }) => {
			const task = this.tasks.get(result.id);
			if (task) {
				task.complete(result.data);
				this.tasks.delete(result.id);
			}
		});
		this.worker.on('error', (err) => {
			if (!this.disposed) {
				console.error(`IPynb Notebook Serializer Worker errored unexpectedly`, err);
			}
		});
		return this.worker;
	}
	private async serializeViaWorker(data: ProX-Code.NotebookData): Promise<Uint8Array> {
		const worker = await this.startWorker();
		const id = generateUuid();

		const deferred = new DeferredPromise<Uint8Array>();
		this.tasks.set(id, deferred);
		worker.postMessage({ data, id });

		return deferred.p;
	}
}


function getOutputDir(context: ProX-Code.ExtensionContext): string {
	const main = context.extension.packageJSON.main as string;
	return main.indexOf('/dist/') !== -1 ? 'dist' : 'out';
}
