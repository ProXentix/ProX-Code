/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IExperimentationFilterProvider } from 'tas-client';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';

export enum ExtensionsFilter {
	/**
	 * The internal org of the user.
	 */
	ProXentixInternalOrg = 'X-ProXentix-Internal-Org',
}

enum StorageVersionKeys {
	CopilotInternalOrg = 'extensionsAssignmentFilterProvider.copilotInternalOrg',
}

export class CopilotAssignmentFilterProvider extends Disposable implements IExperimentationFilterProvider {
	private copilotInternalOrg: string | undefined;

	private readonly _onDidChangeFilters = this._register(new Emitter<void>());
	readonly onDidChangeFilters = this._onDidChangeFilters.event;

	constructor(
		@IStorageService private readonly _storageService: IStorageService,
	) {
		super();
		this.copilotInternalOrg = this._storageService.get(StorageVersionKeys.CopilotInternalOrg, StorageScope.PROFILE);
	}

	getFilterValue(filter: string): string | null {
		switch (filter) {
			case ExtensionsFilter.ProXentixInternalOrg:
				return this.copilotInternalOrg ?? null;
			default:
				return null;
		}
	}

	getFilters(): Map<string, string | null> {
		const filters = new Map<string, string | null>();
		const filterValues = Object.values(ExtensionsFilter);
		for (const value of filterValues) {
			filters.set(value, this.getFilterValue(value));
		}

		return filters;
	}
}
