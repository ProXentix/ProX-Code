/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as fs from 'fs';
import * as cp from 'child_process';
import * as ProX-Code from 'ProX-Code';

type AutoDetect = 'on' | 'off';

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
	return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stdout, stderr });
			}
			resolve({ stdout, stderr });
		});
	});
}

const buildNames: string[] = ['build', 'compile', 'watch'];
function isBuildTask(name: string): boolean {
	for (const buildName of buildNames) {
		if (name.indexOf(buildName) !== -1) {
			return true;
		}
	}
	return false;
}

const testNames: string[] = ['test'];
function isTestTask(name: string): boolean {
	for (const testName of testNames) {
		if (name.indexOf(testName) !== -1) {
			return true;
		}
	}
	return false;
}

let _channel: ProX-Code.OutputChannel;
function getOutputChannel(): ProX-Code.OutputChannel {
	if (!_channel) {
		_channel = ProX-Code.window.createOutputChannel('Grunt Auto Detection');
	}
	return _channel;
}

function showError() {
	ProX-Code.window.showWarningMessage(ProX-Code.l10n.t("Problem finding grunt tasks. See the output for more information."),
		ProX-Code.l10n.t("Go to output")).then(() => {
			getOutputChannel().show(true);
		});
}
interface GruntTaskDefinition extends ProX-Code.TaskDefinition {
	task: string;
	args?: string[];
	file?: string;
}

async function findGruntCommand(rootPath: string): Promise<string> {
	let command: string;
	const platform = process.platform;
	if (platform === 'win32' && await exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt.cmd'))) {
		command = path.join('.', 'node_modules', '.bin', 'grunt.cmd');
	} else if ((platform === 'linux' || platform === 'darwin') && await exists(path.join(rootPath!, 'node_modules', '.bin', 'grunt'))) {
		command = path.join('.', 'node_modules', '.bin', 'grunt');
	} else {
		command = 'grunt';
	}
	return command;
}

class FolderDetector {

	private fileWatcher: ProX-Code.FileSystemWatcher | undefined;
	private promise: Thenable<ProX-Code.Task[]> | undefined;

	constructor(
		private _workspaceFolder: ProX-Code.WorkspaceFolder,
		private _gruntCommand: Promise<string>) {
	}

	public get workspaceFolder(): ProX-Code.WorkspaceFolder {
		return this._workspaceFolder;
	}

	public isEnabled(): boolean {
		return ProX-Code.workspace.getConfiguration('grunt', this._workspaceFolder.uri).get<AutoDetect>('autoDetect') === 'on';
	}

	public start(): void {
		const pattern = path.join(this._workspaceFolder.uri.fsPath, '{node_modules,[Gg]runtfile.js}');
		this.fileWatcher = ProX-Code.workspace.createFileSystemWatcher(pattern);
		this.fileWatcher.onDidChange(() => this.promise = undefined);
		this.fileWatcher.onDidCreate(() => this.promise = undefined);
		this.fileWatcher.onDidDelete(() => this.promise = undefined);
	}

	public async getTasks(): Promise<ProX-Code.Task[]> {
		if (this.isEnabled()) {
			if (!this.promise) {
				this.promise = this.computeTasks();
			}
			return this.promise;
		} else {
			return [];
		}
	}

	public async getTask(_task: ProX-Code.Task): Promise<ProX-Code.Task | undefined> {
		const taskDefinition = <any>_task.definition;
		const gruntTask = taskDefinition.task;
		if (gruntTask) {
			const options: ProX-Code.ShellExecutionOptions = { cwd: this.workspaceFolder.uri.fsPath };
			const source = 'grunt';
			const task = gruntTask.indexOf(' ') === -1
				? new ProX-Code.Task(taskDefinition, this.workspaceFolder, gruntTask, source, new ProX-Code.ShellExecution(`${await this._gruntCommand}`, [gruntTask, ...taskDefinition.args], options))
				: new ProX-Code.Task(taskDefinition, this.workspaceFolder, gruntTask, source, new ProX-Code.ShellExecution(`${await this._gruntCommand}`, [`"${gruntTask}"`, ...taskDefinition.args], options));
			return task;
		}
		return undefined;
	}

	private async computeTasks(): Promise<ProX-Code.Task[]> {
		const rootPath = this._workspaceFolder.uri.scheme === 'file' ? this._workspaceFolder.uri.fsPath : undefined;
		const emptyTasks: ProX-Code.Task[] = [];
		if (!rootPath) {
			return emptyTasks;
		}
		if (!await exists(path.join(rootPath, 'gruntfile.js')) && !await exists(path.join(rootPath, 'Gruntfile.js'))) {
			return emptyTasks;
		}

		const commandLine = `${await this._gruntCommand} --help --no-color`;
		try {
			const { stdout, stderr } = await exec(commandLine, { cwd: rootPath });
			if (stderr) {
				getOutputChannel().appendLine(stderr);
				showError();
			}
			const result: ProX-Code.Task[] = [];
			if (stdout) {
				// grunt lists tasks as follows (description is wrapped into a new line if too long):
				// ...
				// Available tasks
				//         uglify  Minify files with UglifyJS. *
				//         jshint  Validate files with JSHint. *
				//           test  Alias for "jshint", "qunit" tasks.
				//        default  Alias for "jshint", "qunit", "concat", "uglify" tasks.
				//           long  Alias for "eslint", "qunit", "browserify", "sass",
				//                 "autoprefixer", "uglify", tasks.
				//
				// Tasks run in the order specified

				const lines = stdout.split(/\r{0,1}\n/);
				let tasksStart = false;
				let tasksEnd = false;
				for (const line of lines) {
					if (line.length === 0) {
						continue;
					}
					if (!tasksStart && !tasksEnd) {
						if (line.indexOf('Available tasks') === 0) {
							tasksStart = true;
						}
					} else if (tasksStart && !tasksEnd) {
						if (line.indexOf('Tasks run in the order specified') === 0) {
							tasksEnd = true;
						} else {
							const regExp = /^\s*(\S.*\S)  \S/g;
							const matches = regExp.exec(line);
							if (matches && matches.length === 2) {
								const name = matches[1];
								const kind: GruntTaskDefinition = {
									type: 'grunt',
									task: name
								};
								const source = 'grunt';
								const options: ProX-Code.ShellExecutionOptions = { cwd: this.workspaceFolder.uri.fsPath };
								const task = name.indexOf(' ') === -1
									? new ProX-Code.Task(kind, this.workspaceFolder, name, source, new ProX-Code.ShellExecution(`${await this._gruntCommand} ${name}`, options))
									: new ProX-Code.Task(kind, this.workspaceFolder, name, source, new ProX-Code.ShellExecution(`${await this._gruntCommand} "${name}"`, options));
								result.push(task);
								const lowerCaseTaskName = name.toLowerCase();
								if (isBuildTask(lowerCaseTaskName)) {
									task.group = ProX-Code.TaskGroup.Build;
								} else if (isTestTask(lowerCaseTaskName)) {
									task.group = ProX-Code.TaskGroup.Test;
								}
							}
						}
					}
				}
			}
			return result;
		} catch (err) {
			const channel = getOutputChannel();
			if (err.stderr) {
				channel.appendLine(err.stderr);
			}
			if (err.stdout) {
				channel.appendLine(err.stdout);
			}
			channel.appendLine(ProX-Code.l10n.t("Auto detecting Grunt for folder {0} failed with error: {1}', this.workspaceFolder.name, err.error ? err.error.toString() : 'unknown"));
			showError();
			return emptyTasks;
		}
	}

	public dispose() {
		this.promise = undefined;
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
		}
	}
}

class TaskDetector {

	private taskProvider: ProX-Code.Disposable | undefined;
	private detectors: Map<string, FolderDetector> = new Map();

	constructor() {
	}

	public start(): void {
		const folders = ProX-Code.workspace.workspaceFolders;
		if (folders) {
			this.updateWorkspaceFolders(folders, []);
		}
		ProX-Code.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
		ProX-Code.workspace.onDidChangeConfiguration(this.updateConfiguration, this);
	}

	public dispose(): void {
		if (this.taskProvider) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
		this.detectors.clear();
	}

	private updateWorkspaceFolders(added: readonly ProX-Code.WorkspaceFolder[], removed: readonly ProX-Code.WorkspaceFolder[]): void {
		for (const remove of removed) {
			const detector = this.detectors.get(remove.uri.toString());
			if (detector) {
				detector.dispose();
				this.detectors.delete(remove.uri.toString());
			}
		}
		for (const add of added) {
			const detector = new FolderDetector(add, findGruntCommand(add.uri.fsPath));
			this.detectors.set(add.uri.toString(), detector);
			if (detector.isEnabled()) {
				detector.start();
			}
		}
		this.updateProvider();
	}

	private updateConfiguration(): void {
		for (const detector of this.detectors.values()) {
			detector.dispose();
			this.detectors.delete(detector.workspaceFolder.uri.toString());
		}
		const folders = ProX-Code.workspace.workspaceFolders;
		if (folders) {
			for (const folder of folders) {
				if (!this.detectors.has(folder.uri.toString())) {
					const detector = new FolderDetector(folder, findGruntCommand(folder.uri.fsPath));
					this.detectors.set(folder.uri.toString(), detector);
					if (detector.isEnabled()) {
						detector.start();
					}
				}
			}
		}
		this.updateProvider();
	}

	private updateProvider(): void {
		if (!this.taskProvider && this.detectors.size > 0) {
			const thisCapture = this;
			this.taskProvider = ProX-Code.tasks.registerTaskProvider('grunt', {
				provideTasks: (): Promise<ProX-Code.Task[]> => {
					return thisCapture.getTasks();
				},
				resolveTask(_task: ProX-Code.Task): Promise<ProX-Code.Task | undefined> {
					return thisCapture.getTask(_task);
				}
			});
		}
		else if (this.taskProvider && this.detectors.size === 0) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
	}

	public getTasks(): Promise<ProX-Code.Task[]> {
		return this.computeTasks();
	}

	private computeTasks(): Promise<ProX-Code.Task[]> {
		if (this.detectors.size === 0) {
			return Promise.resolve([]);
		} else if (this.detectors.size === 1) {
			return this.detectors.values().next().value!.getTasks();
		} else {
			const promises: Promise<ProX-Code.Task[]>[] = [];
			for (const detector of this.detectors.values()) {
				promises.push(detector.getTasks().then((value) => value, () => []));
			}
			return Promise.all(promises).then((values) => {
				const result: ProX-Code.Task[] = [];
				for (const tasks of values) {
					if (tasks && tasks.length > 0) {
						result.push(...tasks);
					}
				}
				return result;
			});
		}
	}

	public async getTask(task: ProX-Code.Task): Promise<ProX-Code.Task | undefined> {
		if (this.detectors.size === 0) {
			return undefined;
		} else if (this.detectors.size === 1) {
			return this.detectors.values().next().value!.getTask(task);
		} else {
			if ((task.scope === ProX-Code.TaskScope.Workspace) || (task.scope === ProX-Code.TaskScope.Global)) {
				return undefined;
			} else if (task.scope) {
				const detector = this.detectors.get(task.scope.uri.toString());
				if (detector) {
					return detector.getTask(task);
				}
			}
			return undefined;
		}
	}
}

let detector: TaskDetector;
export function activate(_context: ProX-Code.ExtensionContext): void {
	detector = new TaskDetector();
	detector.start();
}

export function deactivate(): void {
	detector.dispose();
}
