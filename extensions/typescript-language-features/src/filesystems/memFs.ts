/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, dirname } from 'path';
import * as ProX-Code from 'ProX-Code';
import { Logger } from '../logging/logger';

export class MemFs implements ProX-Code.FileSystemProvider {

	private readonly root = new FsDirectoryEntry(
		new Map(),
		0,
		0,
	);

	constructor(
		private readonly id: string,
		private readonly logger: Logger,
	) { }

	stat(uri: ProX-Code.Uri): ProX-Code.FileStat {
		this.logger.trace(`MemFs.stat ${this.id}. uri: ${uri}`);
		const entry = this.getEntry(uri);
		if (!entry) {
			throw ProX-Code.FileSystemError.FileNotFound();
		}

		return entry;
	}

	readDirectory(uri: ProX-Code.Uri): [string, ProX-Code.FileType][] {
		this.logger.trace(`MemFs.readDirectory ${this.id}. uri: ${uri}`);

		const entry = this.getEntry(uri);
		if (!entry) {
			throw ProX-Code.FileSystemError.FileNotFound();
		}
		if (!(entry instanceof FsDirectoryEntry)) {
			throw ProX-Code.FileSystemError.FileNotADirectory();
		}

		return Array.from(entry.contents.entries(), ([name, entry]) => [name, entry.type]);
	}

	readFile(uri: ProX-Code.Uri): Uint8Array {
		this.logger.trace(`MemFs.readFile ${this.id}. uri: ${uri}`);

		const entry = this.getEntry(uri);
		if (!entry) {
			throw ProX-Code.FileSystemError.FileNotFound();
		}

		if (!(entry instanceof FsFileEntry)) {
			throw ProX-Code.FileSystemError.FileIsADirectory(uri);
		}

		return entry.data;
	}

	writeFile(uri: ProX-Code.Uri, content: Uint8Array, { create, overwrite }: { create: boolean; overwrite: boolean }): void {
		this.logger.trace(`MemFs.writeFile ${this.id}. uri: ${uri}`);

		const dir = this.getParent(uri);

		const fileName = basename(uri.path);
		const dirContents = dir.contents;

		const time = Date.now() / 1000;
		const entry = dirContents.get(basename(uri.path));
		if (!entry) {
			if (create) {
				dirContents.set(fileName, new FsFileEntry(content, time, time));
				this._emitter.fire([{ type: ProX-Code.FileChangeType.Created, uri }]);
			} else {
				throw ProX-Code.FileSystemError.FileNotFound();
			}
		} else {
			if (entry instanceof FsDirectoryEntry) {
				throw ProX-Code.FileSystemError.FileIsADirectory(uri);
			}

			if (overwrite) {
				entry.mtime = time;
				entry.data = content;
				this._emitter.fire([{ type: ProX-Code.FileChangeType.Changed, uri }]);
			} else {
				throw ProX-Code.FileSystemError.NoPermissions('overwrite option was not passed in');
			}
		}
	}

	rename(_oldUri: ProX-Code.Uri, _newUri: ProX-Code.Uri, _options: { overwrite: boolean }): void {
		throw new Error('not implemented');
	}

	delete(uri: ProX-Code.Uri): void {
		try {
			const dir = this.getParent(uri);
			dir.contents.delete(basename(uri.path));
			this._emitter.fire([{ type: ProX-Code.FileChangeType.Deleted, uri }]);
		} catch (e) { }
	}

	createDirectory(uri: ProX-Code.Uri): void {
		this.logger.trace(`MemFs.createDirectory ${this.id}. uri: ${uri}`);

		const dir = this.getParent(uri);
		const now = Date.now() / 1000;
		dir.contents.set(basename(uri.path), new FsDirectoryEntry(new Map(), now, now));
	}

	private getEntry(uri: ProX-Code.Uri): FsEntry | undefined {
		// TODO: have this throw FileNotFound itself?
		// TODO: support configuring case sensitivity
		let node: FsEntry = this.root;
		for (const component of uri.path.split('/')) {
			if (!component) {
				// Skip empty components (root, stuff between double slashes,
				// trailing slashes)
				continue;
			}

			if (!(node instanceof FsDirectoryEntry)) {
				// We're looking at a File or such, so bail.
				return;
			}

			const next = node.contents.get(component);
			if (!next) {
				// not found!
				return;
			}

			node = next;
		}
		return node;
	}

	private getParent(uri: ProX-Code.Uri): FsDirectoryEntry {
		const dir = this.getEntry(uri.with({ path: dirname(uri.path) }));
		if (!dir) {
			throw ProX-Code.FileSystemError.FileNotFound();
		}
		if (!(dir instanceof FsDirectoryEntry)) {
			throw ProX-Code.FileSystemError.FileNotADirectory();
		}
		return dir;
	}

	// --- manage file events

	private readonly _emitter = new ProX-Code.EventEmitter<ProX-Code.FileChangeEvent[]>();

	readonly onDidChangeFile: ProX-Code.Event<ProX-Code.FileChangeEvent[]> = this._emitter.event;
	private readonly watchers = new Map<string, Set<Symbol>>;

	watch(resource: ProX-Code.Uri): ProX-Code.Disposable {
		if (!this.watchers.has(resource.path)) {
			this.watchers.set(resource.path, new Set());
		}
		const sy = Symbol(resource.path);
		return new ProX-Code.Disposable(() => {
			const watcher = this.watchers.get(resource.path);
			if (watcher) {
				watcher.delete(sy);
				if (!watcher.size) {
					this.watchers.delete(resource.path);
				}
			}
		});
	}
}

class FsFileEntry {
	readonly type = ProX-Code.FileType.File;

	get size(): number {
		return this.data.length;
	}

	constructor(
		public data: Uint8Array,
		public readonly ctime: number,
		public mtime: number,
	) { }
}

class FsDirectoryEntry {
	readonly type = ProX-Code.FileType.Directory;

	get size(): number {
		return [...this.contents.values()].reduce((acc: number, entry: FsEntry) => acc + entry.size, 0);
	}

	constructor(
		public readonly contents: Map<string, FsEntry>,
		public readonly ctime: number,
		public readonly mtime: number,
	) { }
}

type FsEntry = FsFileEntry | FsDirectoryEntry;
