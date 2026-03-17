/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { CancellationToken, CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import * as errors from '../../../../../base/common/errors.js';
import { Emitter, Event, PauseableEmitter } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../../base/common/network.js';
import { URI } from '../../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';

import { ReplacePattern } from '../../../../services/search/common/replace.js';
import { IFileMatch, IPatternInfo, ISearchComplete, ISearchConfigurationProperties, ISearchProgressItem, ISearchService, ITextQuery, ITextSearchStats, SearchCompletionExitCode } from '../../../../services/search/common/search.js';
import { IChangeEvent, mergeSearchResultEvents, SearchModelLocation, ISearchModel, ISearchResult, SEARCH_MODEL_PREFIX } from './searchTreeCommon.js';
import { SearchResultImpl } from './searchResult.js';
import { ISearchViewModelWorkbenchService } from './searchViewModelWorkbenchService.js';

export class SearchModelImpl extends Disposable implements ISearchModel {

	private _searchResult: ISearchResult;
	private _searchQuery: ITextQuery | null = null;
	private _replaceActive: boolean = false;
	private _replaceString: string | null = null;
	private _replacePattern: ReplacePattern | null = null;
	private _preserveCase: boolean = false;
	private _startStreamDelay: Promise<void> = Promise.resolve();
	private readonly _resultQueue: IFileMatch[] = [];

	private readonly _onReplaceTermChanged: Emitter<void> = this._register(new Emitter<void>());
	readonly onReplaceTermChanged: Event<void> = this._onReplaceTermChanged.event;

	private readonly _onSearchResultChanged = this._register(new PauseableEmitter<IChangeEvent>({
		merge: mergeSearchResultEvents
	}));
	readonly onSearchResultChanged: Event<IChangeEvent> = this._onSearchResultChanged.event;

	private currentCancelTokenSource: CancellationTokenSource | null = null;
	private searchCancelledForNewSearch: boolean = false;
	public location: SearchModelLocation = SearchModelLocation.PANEL;

	private readonly _id: string;

	constructor(
		@ISearchService private readonly searchService: ISearchService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this._searchResult = this.instantiationService.createInstance(SearchResultImpl, this);
		this._register(this._searchResult.onChange((e) => this._onSearchResultChanged.fire(e)));

		this._id = SEARCH_MODEL_PREFIX + Date.now().toString();
	}

	id(): string {
		return this._id;
	}

	isReplaceActive(): boolean {
		return this._replaceActive;
	}

	set replaceActive(replaceActive: boolean) {
		this._replaceActive = replaceActive;
	}

	get replacePattern(): ReplacePattern | null {
		return this._replacePattern;
	}

	get replaceString(): string {
		return this._replaceString || '';
	}

	set preserveCase(value: boolean) {
		this._preserveCase = value;
	}

	get preserveCase(): boolean {
		return this._preserveCase;
	}

	set replaceString(replaceString: string) {
		this._replaceString = replaceString;
		if (this._replaceString) {
			this._replacePattern = new ReplacePattern(this._replaceString, this._searchQuery?.contentPattern!);
		}
		this._onReplaceTermChanged.fire();
	}

	get searchResult(): ISearchResult {
		return this._searchResult;
	}

	private doSearch(query: ITextQuery, progressEmitter: Emitter<void>, searchQuery: ITextQuery, searchInstanceID: string, onProgress?: (result: ISearchProgressItem) => void, callerToken?: CancellationToken): {
		asyncResults: Promise<ISearchComplete>;
		syncResults: IFileMatch<URI>[];
	} {
		this.currentCancelTokenSource = new CancellationTokenSource(callerToken);
		this.searchCancelledForNewSearch = false;


		const start = Date.now();
		const { syncResults: syncComplete, asyncResults: asyncCompletePromise } = this.searchService.textSearchSplitSyncAsync(query, this.currentCancelTokenSource?.token, (p) => {
			this.onSearchProgress(p, searchInstanceID, false);
			onProgress?.(p);
		});

		const syncResults = syncComplete.results;
		this._resultQueue.push(...syncResults);

		const getAsyncResults = (): Promise<ISearchComplete> => {
			return asyncCompletePromise
				.then((complete) => {
					this.currentCancelTokenSource = null;
					return this.onSearchCompleted(complete, Date.now() - start, searchInstanceID);
				}, (e) => {
					this.currentCancelTokenSource = null;
					this.onSearchError(e, Date.now() - start);
					throw e;
				});
		};

		return {
			asyncResults: getAsyncResults(),
			syncResults
		};
	}

	search(query: ITextQuery, onProgress?: (result: ISearchProgressItem) => void, callerToken?: CancellationToken): {
		asyncResults: Promise<ISearchComplete>;
		syncResults: IFileMatch<URI>[];
	} {
		this.cancelSearch(true);
		this._searchQuery = query;

		this.searchResult.clear();
		this._resultQueue.length = 0;

		this.searchResult.query = this._searchQuery;
		if (this._replaceString) {
			this._replacePattern = new ReplacePattern(this._replaceString, this._searchQuery.contentPattern);
		}

		const progressEmitter = this._register(new Emitter<void>());

		return this.doSearch(query, progressEmitter, this._searchQuery, this.id(), onProgress, callerToken);
	}

	private onSearchCompleted(completed: ISearchComplete | undefined, duration: number, searchInstanceID: string): ISearchComplete {
		if (!this._searchQuery) {
			throw new Error('onSearchCompleted must be called after a search is started');
		}

		this._searchResult.add(this._resultQueue, searchInstanceID);
		this._resultQueue.length = 0;

		this.searchResult.setCachedSearchComplete(completed);

		const options: IPatternInfo = Object.assign({}, this._searchQuery.contentPattern);
		// eslint-disable-next-line local/code-no-any-casts
		delete (options as any).pattern;

		const stats = completed && completed.stats as ITextSearchStats;

		const fileSchemeOnly = this._searchQuery.folderQueries.every(fq => fq.folder.scheme === Schemas.file);
		const otherSchemeOnly = this._searchQuery.folderQueries.every(fq => fq.folder.scheme !== Schemas.file);
		const scheme = fileSchemeOnly ? Schemas.file :
			otherSchemeOnly ? 'other' :
				'mixed';

		this.telemetryService.publicLog('searchResultsShown', {
			count: this._searchResult.count(),
			fileCount: this._searchResult.fileCount(),
			options,
			duration,
			type: stats && stats.type,
			scheme,
			searchOnTypeEnabled: this.searchConfig.searchOnType
		});
		return completed || { results: [], messages: [] };
	}

	private onSearchError(e: any, duration: number): void {
		if (errors.isCancellationError(e)) {
			this.onSearchCompleted(
				this.searchCancelledForNewSearch
					? { exit: SearchCompletionExitCode.NewSearchStarted, results: [], messages: [] }
					: undefined,
				duration, '');
			this.searchCancelledForNewSearch = false;
		}
	}

	private onSearchProgress(p: ISearchProgressItem, searchInstanceID: string, sync = true) {
		const targetQueue = this._resultQueue;
		if ((<IFileMatch>p).resource) {
			targetQueue.push(<IFileMatch>p);
			if (sync) {
				if (targetQueue.length) {
					this._searchResult.add(targetQueue, searchInstanceID, true);
					targetQueue.length = 0;
				}
			} else {
				this._startStreamDelay.then(() => {
					if (targetQueue.length) {
						this._searchResult.add(targetQueue, searchInstanceID, true);
						targetQueue.length = 0;
					}
				});
			}

		}
	}

	private get searchConfig() {
		return this.configurationService.getValue<ISearchConfigurationProperties>('search');
	}

	cancelSearch(cancelledForNewSearch = false): boolean {
		if (this.currentCancelTokenSource) {
			this.searchCancelledForNewSearch = cancelledForNewSearch;
			this.currentCancelTokenSource.cancel();
			return true;
		}
		return false;
	}

	override dispose(): void {
		this.cancelSearch();
		this.searchResult.dispose();
		super.dispose();
	}

}


export class SearchViewModelWorkbenchService implements ISearchViewModelWorkbenchService {

	declare readonly _serviceBrand: undefined;
	private _searchModel: SearchModelImpl | null = null;

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) {
	}

	get searchModel(): SearchModelImpl {
		if (!this._searchModel) {
			this._searchModel = this.instantiationService.createInstance(SearchModelImpl);
		}
		return this._searchModel;
	}

	set searchModel(searchModel: SearchModelImpl) {
		this._searchModel?.dispose();
		this._searchModel = searchModel;
	}
}
