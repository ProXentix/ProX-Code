/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
declare namespace NodeJS {
	type ComposeFnParam = (source: any) => void;
	interface ReadWriteStream {
		compose<T extends NodeJS.ReadableStream>(
			stream: T | ComposeFnParam | Iterable<T> | AsyncIterable<T>,
			options?: { signal: AbortSignal },
		): T;
	}
}
