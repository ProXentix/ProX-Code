/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import { validate, getHtmlFlatNode, offsetRangeToSelection } from './util';
import { getRootNode } from './parseDocument';
import { HtmlNode as HtmlFlatNode } from 'EmmetFlatNode';

export function matchTag() {
	if (!validate(false) || !ProX-Code.window.activeTextEditor) {
		return;
	}

	const editor = ProX-Code.window.activeTextEditor;
	const document = editor.document;
	const rootNode = <HtmlFlatNode>getRootNode(document, true);
	if (!rootNode) {
		return;
	}

	const updatedSelections: ProX-Code.Selection[] = [];
	editor.selections.forEach(selection => {
		const updatedSelection = getUpdatedSelections(document, rootNode, selection.start);
		if (updatedSelection) {
			updatedSelections.push(updatedSelection);
		}
	});
	if (updatedSelections.length) {
		editor.selections = updatedSelections;
		editor.revealRange(editor.selections[updatedSelections.length - 1]);
	}
}

function getUpdatedSelections(document: ProX-Code.TextDocument, rootNode: HtmlFlatNode, position: ProX-Code.Position): ProX-Code.Selection | undefined {
	const offset = document.offsetAt(position);
	const currentNode = getHtmlFlatNode(document.getText(), rootNode, offset, true);
	if (!currentNode) {
		return;
	}

	// If no opening/closing tag or cursor is between open and close tag, then no-op
	if (!currentNode.open
		|| !currentNode.close
		|| (offset > currentNode.open.end && offset < currentNode.close.start)) {
		return;
	}

	// Place cursor inside the close tag if cursor is inside the open tag, else place it inside the open tag
	const finalOffset = (offset <= currentNode.open.end) ? currentNode.close.start + 2 : currentNode.start + 1;
	return offsetRangeToSelection(document, finalOffset, finalOffset);
}
