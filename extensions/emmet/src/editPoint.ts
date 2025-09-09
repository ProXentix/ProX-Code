/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { validate } from './util';

export function fetchEditPoint(direction: string): void {
	if (!validate() || !ProX-Code.window.activeTextEditor) {
		return;
	}
	const editor = ProX-Code.window.activeTextEditor;

	const newSelections: ProX-Code.Selection[] = [];
	editor.selections.forEach(selection => {
		const updatedSelection = direction === 'next' ? nextEditPoint(selection, editor) : prevEditPoint(selection, editor);
		newSelections.push(updatedSelection);
	});
	editor.selections = newSelections;
	editor.revealRange(editor.selections[editor.selections.length - 1]);
}

function nextEditPoint(selection: ProX-Code.Selection, editor: ProX-Code.TextEditor): ProX-Code.Selection {
	for (let lineNum = selection.anchor.line; lineNum < editor.document.lineCount; lineNum++) {
		const updatedSelection = findEditPoint(lineNum, editor, selection.anchor, 'next');
		if (updatedSelection) {
			return updatedSelection;
		}
	}
	return selection;
}

function prevEditPoint(selection: ProX-Code.Selection, editor: ProX-Code.TextEditor): ProX-Code.Selection {
	for (let lineNum = selection.anchor.line; lineNum >= 0; lineNum--) {
		const updatedSelection = findEditPoint(lineNum, editor, selection.anchor, 'prev');
		if (updatedSelection) {
			return updatedSelection;
		}
	}
	return selection;
}


function findEditPoint(lineNum: number, editor: ProX-Code.TextEditor, position: ProX-Code.Position, direction: string): ProX-Code.Selection | undefined {
	const line = editor.document.lineAt(lineNum);
	let lineContent = line.text;

	if (lineNum !== position.line && line.isEmptyOrWhitespace && lineContent.length) {
		return new ProX-Code.Selection(lineNum, lineContent.length, lineNum, lineContent.length);
	}

	if (lineNum === position.line && direction === 'prev') {
		lineContent = lineContent.substr(0, position.character);
	}
	const emptyAttrIndex = direction === 'next' ? lineContent.indexOf('""', lineNum === position.line ? position.character : 0) : lineContent.lastIndexOf('""');
	const emptyTagIndex = direction === 'next' ? lineContent.indexOf('><', lineNum === position.line ? position.character : 0) : lineContent.lastIndexOf('><');

	let winner = -1;

	if (emptyAttrIndex > -1 && emptyTagIndex > -1) {
		winner = direction === 'next' ? Math.min(emptyAttrIndex, emptyTagIndex) : Math.max(emptyAttrIndex, emptyTagIndex);
	} else if (emptyAttrIndex > -1) {
		winner = emptyAttrIndex;
	} else {
		winner = emptyTagIndex;
	}

	if (winner > -1) {
		return new ProX-Code.Selection(lineNum, winner + 1, lineNum, winner + 1);
	}
	return;
}
