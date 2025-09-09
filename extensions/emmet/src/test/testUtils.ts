/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as ProX-Code from 'ProX-Code';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';

export function rndName() {
	let name = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 10; i++) {
		name += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return name;
}

export function createRandomFile(contents = '', fileExtension = 'txt'): Thenable<ProX-Code.Uri> {
	return new Promise((resolve, reject) => {
		const tmpFile = join(os.tmpdir(), rndName() + '.' + fileExtension);
		fs.writeFile(tmpFile, contents, (error) => {
			if (error) {
				return reject(error);
			}

			resolve(ProX-Code.Uri.file(tmpFile));
		});
	});
}

export function pathEquals(path1: string, path2: string): boolean {
	if (process.platform !== 'linux') {
		path1 = path1.toLowerCase();
		path2 = path2.toLowerCase();
	}

	return path1 === path2;
}

export function deleteFile(file: ProX-Code.Uri): Thenable<boolean> {
	return new Promise((resolve, reject) => {
		fs.unlink(file.fsPath, (err) => {
			if (err) {
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
}

export function closeAllEditors(): Thenable<any> {
	return ProX-Code.commands.executeCommand('workbench.action.closeAllEditors');
}

export function withRandomFileEditor(initialContents: string, fileExtension: string = 'txt', run: (editor: ProX-Code.TextEditor, doc: ProX-Code.TextDocument) => Thenable<void>): Thenable<boolean> {
	return createRandomFile(initialContents, fileExtension).then(file => {
		return ProX-Code.workspace.openTextDocument(file).then(doc => {
			return ProX-Code.window.showTextDocument(doc).then((editor) => {
				return run(editor, doc).then(_ => {
					if (doc.isDirty) {
						return doc.save().then(() => {
							return deleteFile(file);
						});
					} else {
						return deleteFile(file);
					}
				});
			});
		});
	});
}
