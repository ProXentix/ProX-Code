/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand("proxpl.createProject", async () => {
		const options: vscode.OpenDialogOptions = {
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: "Select Project Folder"
		};

		const folderUri = await vscode.window.showOpenDialog(options);
		if (folderUri && folderUri[0]) {
			const projectPath = folderUri[0].fsPath;

			// Define file contents
			const mainProxContent = "// Hello World in ProXPL\nprint(\"Hello, ProX Code!\");\n";
			const proxConfigContent = JSON.stringify({
				"projectName": path.basename(projectPath),
				"version": "1.0.0",
				"main": "main.prox"
			}, null, "\t");

			// Write files
			fs.writeFileSync(path.join(projectPath, "main.prox"), mainProxContent);
			fs.writeFileSync(path.join(projectPath, "prox.config.json"), proxConfigContent);

			// Open the folder
			vscode.commands.executeCommand("vscode.openFolder", folderUri[0]);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }

