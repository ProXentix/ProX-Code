/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { DocumentSelector } from '../configuration/documentSelector';
import type * as Proto from '../tsServer/protocol/protocol';
import * as typeConverters from '../typeConverters';
import { ITypeScriptServiceClient } from '../typescriptService';
import { coalesce } from '../utils/arrays';

class TypeScriptFoldingProvider implements ProX-Code.FoldingRangeProvider {

	public constructor(
		private readonly client: ITypeScriptServiceClient
	) { }

	async provideFoldingRanges(
		document: ProX-Code.TextDocument,
		_context: ProX-Code.FoldingContext,
		token: ProX-Code.CancellationToken
	): Promise<ProX-Code.FoldingRange[] | undefined> {
		const file = this.client.toOpenTsFilePath(document);
		if (!file) {
			return;
		}

		const args: Proto.FileRequestArgs = { file };
		const response = await this.client.execute('getOutliningSpans', args, token);
		if (response.type !== 'response' || !response.body) {
			return;
		}

		return coalesce(response.body.map(span => this.convertOutliningSpan(span, document)));
	}

	private convertOutliningSpan(
		span: Proto.OutliningSpan,
		document: ProX-Code.TextDocument
	): ProX-Code.FoldingRange | undefined {
		const range = typeConverters.Range.fromTextSpan(span.textSpan);
		const kind = TypeScriptFoldingProvider.getFoldingRangeKind(span);

		// Workaround for #49904
		if (span.kind === 'comment') {
			const line = document.lineAt(range.start.line).text;
			if (/\/\/\s*#endregion/gi.test(line)) {
				return undefined;
			}
		}

		const start = range.start.line;
		const end = this.adjustFoldingEnd(range, document);
		return new ProX-Code.FoldingRange(start, end, kind);
	}

	private static readonly foldEndPairCharacters = ['}', ']', ')', '`', '>'];

	private adjustFoldingEnd(range: ProX-Code.Range, document: ProX-Code.TextDocument) {
		// workaround for #47240
		if (range.end.character > 0) {
			const foldEndCharacter = document.getText(new ProX-Code.Range(range.end.translate(0, -1), range.end));
			if (TypeScriptFoldingProvider.foldEndPairCharacters.includes(foldEndCharacter)) {
				return Math.max(range.end.line - 1, range.start.line);
			}
		}

		return range.end.line;
	}

	private static getFoldingRangeKind(span: Proto.OutliningSpan): ProX-Code.FoldingRangeKind | undefined {
		switch (span.kind) {
			case 'comment': return ProX-Code.FoldingRangeKind.Comment;
			case 'region': return ProX-Code.FoldingRangeKind.Region;
			case 'imports': return ProX-Code.FoldingRangeKind.Imports;
			case 'code':
			default: return undefined;
		}
	}
}

export function register(
	selector: DocumentSelector,
	client: ITypeScriptServiceClient,
): ProX-Code.Disposable {
	return ProX-Code.languages.registerFoldingRangeProvider(selector.syntax,
		new TypeScriptFoldingProvider(client));
}
