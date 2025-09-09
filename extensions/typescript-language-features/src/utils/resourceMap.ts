/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import * as fileSchemes from '../configuration/fileSchemes';
import { looksLikeAbsoluteWindowsPath } from './fs';

/**
 * Maps of file resources
 *
 * Attempts to handle correct mapping on both case sensitive and case in-sensitive
 * file systems.
 */
export class ResourceMap<T> {

	private static readonly defaultPathNormalizer = (resource: ProX-Code.Uri): string => {
		if (resource.scheme === fileSchemes.file) {
			return resource.fsPath;
		}
		return resource.toString(true);
	};

	private readonly _map = new Map<string, { readonly resource: ProX-Code.Uri; value: T }>();

	constructor(
		protected readonly _normalizePath: (resource: ProX-Code.Uri) => string | undefined = ResourceMap.defaultPathNormalizer,
		protected readonly config: {
			readonly onCaseInsensitiveFileSystem: boolean;
		},
	) { }

	public get size() {
		return this._map.size;
	}

	public has(resource: ProX-Code.Uri): boolean {
		const file = this.toKey(resource);
		return !!file && this._map.has(file);
	}

	public get(resource: ProX-Code.Uri): T | undefined {
		const file = this.toKey(resource);
		if (!file) {
			return undefined;
		}
		const entry = this._map.get(file);
		return entry ? entry.value : undefined;
	}

	public set(resource: ProX-Code.Uri, value: T) {
		const file = this.toKey(resource);
		if (!file) {
			return;
		}
		const entry = this._map.get(file);
		if (entry) {
			entry.value = value;
		} else {
			this._map.set(file, { resource, value });
		}
	}

	public delete(resource: ProX-Code.Uri): void {
		const file = this.toKey(resource);
		if (file) {
			this._map.delete(file);
		}
	}

	public clear(): void {
		this._map.clear();
	}

	public values(): Iterable<T> {
		return Array.from(this._map.values(), x => x.value);
	}

	public entries(): Iterable<{ resource: ProX-Code.Uri; value: T }> {
		return this._map.values();
	}

	private toKey(resource: ProX-Code.Uri): string | undefined {
		const key = this._normalizePath(resource);
		if (!key) {
			return key;
		}
		return this.isCaseInsensitivePath(key) ? key.toLowerCase() : key;
	}

	private isCaseInsensitivePath(path: string) {
		if (looksLikeAbsoluteWindowsPath(path)) {
			return true;
		}
		return path[0] === '/' && this.config.onCaseInsensitiveFileSystem;
	}
}
