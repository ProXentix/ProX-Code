/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyChord, KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputButton, IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

const category: ILocalizedString = localize2('Project', 'Project');

export interface IProjectTemplate {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly detail: string;
	readonly iconClass?: string;
	readonly defaultProjectName: string;
	readonly generate: (projectName: string) => { path: string; content: string }[];
}

export const projectTemplates: IProjectTemplate[] = [
	{
		id: 'proxpl-app',
		label: localize('template.proxplApp.label', "$(play) ProXPL Application"),
		description: localize('template.proxplApp.desc', "ProXPL executable project with prox.toml and src/main.prox"),
		detail: localize('template.proxplApp.detail', "Configured for ProXPL runtime, build tools, and runner."),
		defaultProjectName: 'my-proxpl-app',
		generate: (projectName: string) => [
			{
				path: 'prox.toml',
				content: `[project]\nname = "${projectName}"\nversion = "0.1.0"\ndescription = "A ProXPL application created in ProX-Code"\nauthor = "ProXentix Developer"\n\n[build]\nmain = "src/main.prox"\n`
			},
			{
				path: 'src/main.prox',
				content: `// ${projectName}\n// Entry point for your ProXPL program\n\nfn main() {\n    println("Hello, ProXPL from ${projectName}!");\n}\n`
			},
			{
				path: 'README.md',
				content: `# ${projectName}\n\nA ProXPL project created with **ProX-Code**.\n\n## Running the Project\n\n- Press \`Ctrl+F5\` to run with ProXPL Run\n- Or execute from the terminal using PRM:\n  \`\`\`sh\n  prm run\n  \`\`\`\n`
			},
			{
				path: '.gitignore',
				content: `# Build outputs & artifacts\nbin/\ndist/\n*.out\n*.exe\n.prm/\n.prox/\n`
			}
		]
	},
	{
		id: 'proxpl-lib',
		label: localize('template.proxplLib.label', "$(package) ProXPL Library"),
		description: localize('template.proxplLib.desc', "ProXPL reusable module package"),
		detail: localize('template.proxplLib.detail', "Configured with library exports and structure."),
		defaultProjectName: 'my-proxpl-lib',
		generate: (projectName: string) => [
			{
				path: 'prox.toml',
				content: `[package]\nname = "${projectName}"\nversion = "0.1.0"\ntype = "library"\ndescription = "A ProXPL library package created in ProX-Code"\nauthor = "ProXentix Developer"\n\n[build]\nlib = "src/lib.prox"\n`
			},
			{
				path: 'src/lib.prox',
				content: `// ${projectName} library definitions\n\npub fn add(a: int, b: int): int {\n    return a + b;\n}\n\npub fn greet(name: string): string {\n    return "Hello, " + name + "!";\n}\n`
			},
			{
				path: 'README.md',
				content: `# ${projectName}\n\nA reusable ProXPL library module.\n\n## Usage\n\nImport into other ProXPL packages or applications:\n\`\`\`prox\nimport ${projectName};\n\`\`\`\n`
			},
			{
				path: '.gitignore',
				content: `bin/\ndist/\n*.out\n.prm/\n`
			}
		]
	},
	{
		id: 'ts-app',
		label: localize('template.tsApp.label', "$(file-code) TypeScript / JavaScript Project"),
		description: localize('template.tsApp.desc', "Node.js application with TypeScript configuration"),
		detail: localize('template.tsApp.detail', "Includes package.json, tsconfig.json, and src/index.ts."),
		defaultProjectName: 'my-ts-project',
		generate: (projectName: string) => [
			{
				path: 'package.json',
				content: `{\n  "name": "${projectName}",\n  "version": "1.0.0",\n  "description": "TypeScript application created in ProX-Code",\n  "main": "dist/index.js",\n  "scripts": {\n    "build": "tsc",\n    "start": "node dist/index.js"\n  },\n  "devDependencies": {\n    "typescript": "^5.0.0"\n  }\n}\n`
			},
			{
				path: 'tsconfig.json',
				content: `{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "NodeNext",\n    "moduleResolution": "NodeNext",\n    "outDir": "./dist",\n    "rootDir": "./src",\n    "strict": true,\n    "esModuleInterop": true,\n    "skipLibCheck": true\n  },\n  "include": ["src/**/*"]\n}\n`
			},
			{
				path: 'src/index.ts',
				content: `// Entry point for ${projectName}\nconsole.log('Hello from ${projectName}!');\n`
			},
			{
				path: 'README.md',
				content: `# ${projectName}\n\nA TypeScript project created in ProX-Code.\n\n## Getting Started\n\n\`\`\`sh\nnpm install\nnpm run build\nnpm start\n\`\`\`\n`
			},
			{
				path: '.gitignore',
				content: `node_modules/\ndist/\n*.log\n`
			}
		]
	},
	{
		id: 'python-app',
		label: localize('template.pyApp.label', "$(terminal) Python Project"),
		description: localize('template.pyApp.desc', "Python application with main entry point and requirements"),
		detail: localize('template.pyApp.detail', "Includes main.py, requirements.txt, and .gitignore."),
		defaultProjectName: 'my-python-project',
		generate: (projectName: string) => [
			{
				path: 'main.py',
				content: `def main():\n    print("Hello from ${projectName}!")\n\nif __name__ == "__main__":\n    main()\n`
			},
			{
				path: 'requirements.txt',
				content: `# Add project dependencies here\n`
			},
			{
				path: 'README.md',
				content: `# ${projectName}\n\nA Python project created in ProX-Code.\n\n## Run\n\`\`\`sh\npython main.py\n\`\`\`\n`
			},
			{
				path: '.gitignore',
				content: `__pycache__/\n*.pyc\n.venv/\nvenv/\n`
			}
		]
	},
	{
		id: 'empty-project',
		label: localize('template.empty.label', "$(folder) Empty / Custom Project"),
		description: localize('template.empty.desc', "Clean workspace folder with README and .gitignore"),
		detail: localize('template.empty.detail', "Minimal starting point for any language or toolchain."),
		defaultProjectName: 'my-new-project',
		generate: (projectName: string) => [
			{
				path: 'README.md',
				content: `# ${projectName}\n\nCreated in ProX-Code.\n`
			},
			{
				path: '.gitignore',
				content: `# Add ignored files and directories\n.DS_Store\nThumbs.db\n`
			}
		]
	}
];

export class NewProjectManager extends Disposable {
	static Instance: NewProjectManager | undefined;

	constructor(
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IDialogService private readonly dialogService: IDialogService,
		@IFileService private readonly fileService: IFileService,
		@IHostService private readonly hostService: IHostService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		NewProjectManager.Instance = this;
		this._register({
			dispose() {
				if (NewProjectManager.Instance === this) {
					NewProjectManager.Instance = undefined;
				}
			}
		});
	}

	async run(): Promise<boolean> {
		try {
			return await this.startNewProjectWorkflow();
		} catch (error) {
			this.notificationService.error(
				localize('newProjectError', "Failed to create project: {0}", (error as Error)?.message || String(error))
			);
			return false;
		}
	}

	private validateProjectName(name: string): string | undefined {
		const trimmed = name.trim();
		if (!trimmed) {
			return localize('nameRequired', "Project name is required.");
		}
		// Invalid characters for folder names across OS
		const invalidChars = /[\\/:\*\?"<>\|]/;
		if (invalidChars.test(trimmed)) {
			return localize('invalidNameChars', "Project name cannot contain any of the following characters: \\ / : * ? \" < > |");
		}
		if (trimmed === '.' || trimmed === '..') {
			return localize('invalidNameDot', "Project name cannot be '.' or '..'");
		}
		// Windows reserved names
		const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
		if (reserved.test(trimmed)) {
			return localize('reservedName', "Project name is a reserved device name on Windows.");
		}
		return undefined;
	}

	private async startNewProjectWorkflow(): Promise<boolean> {
		// --- Step 1: Select Template ---
		const selectedTemplate = await this.promptTemplate();
		if (!selectedTemplate) {
			return false;
		}

		// --- Step 2: Enter Project Name ---
		const projectName = await this.promptProjectName(selectedTemplate);
		if (!projectName) {
			return false;
		}

		// --- Step 3: Select Parent Location ---
		const parentLocation = await this.promptParentLocation(projectName);
		if (!parentLocation) {
			return false;
		}

		// --- Step 4: Validate Destination & Confirmation ---
		const targetProjectUri = joinPath(parentLocation, projectName);

		const exists = await this.fileService.exists(targetProjectUri);
		if (exists) {
			try {
				const stat = await this.fileService.resolve(targetProjectUri);
				if (stat.children && stat.children.length > 0) {
					const confirmation = await this.dialogService.confirm({
						type: 'warning',
						message: localize('folderNotEmpty', "Directory '{0}' already exists and contains files.", projectName),
						detail: localize('folderNotEmptyDetail', "Creating the project in this folder may overwrite existing configuration. Do you wish to continue?"),
						primaryButton: localize('continueBtn', "Continue"),
						cancelButton: localize('cancelBtn', "Cancel")
					});
					if (!confirmation.confirmed) {
						return false;
					}
				}
			} catch (e) {
				// Ignore resolve failure and proceed
			}
		}

		// --- Step 5: Generate Files & Create Folder ---
		await this.fileService.createFolder(targetProjectUri);

		const filesToCreate = selectedTemplate.generate(projectName);
		for (const file of filesToCreate) {
			const fileUri = joinPath(targetProjectUri, file.path);
			const dirUri = joinPath(targetProjectUri, ...file.path.split('/').slice(0, -1));
			if (file.path.includes('/')) {
				await this.fileService.createFolder(dirUri);
			}
			await this.fileService.writeFile(fileUri, VSBuffer.fromString(file.content));
		}

		// --- Step 6: Notify & Open Project ---
		this.notificationService.notify({
			severity: Severity.Info,
			message: localize('projectCreatedSuccess', "Project '{0}' created successfully.", projectName)
		});

		const currentWorkspaceFolders = this.workspaceContextService.getWorkspace().folders;
		const reuseWindow = currentWorkspaceFolders.length === 0;

		await this.hostService.openWindow([{ folderUri: targetProjectUri }], {
			forceReuseWindow: reuseWindow,
			forceNewWindow: !reuseWindow
		});

		return true;
	}

	private async promptTemplate(): Promise<IProjectTemplate | undefined> {
		return new Promise((resolve) => {
			const disposables = new DisposableStore();
			const qp = this.quickInputService.createQuickPick<IQuickPickItem & { template?: IProjectTemplate }>();

			qp.title = localize('newProjectWizardTitle', "Create New Project (1/3)");
			qp.step = 1;
			qp.totalSteps = 3;
			qp.placeholder = localize('selectTemplatePlaceholder', "Select Project Type / Template...");
			qp.matchOnDescription = true;
			qp.matchOnDetail = true;
			qp.ignoreFocusOut = true;

			qp.items = projectTemplates.map(t => ({
				label: t.label,
				description: t.description,
				detail: t.detail,
				template: t
			}));

			disposables.add(qp.onDidAccept(() => {
				const selected = qp.selectedItems[0];
				qp.hide();
				resolve(selected?.template);
			}));

			disposables.add(qp.onDidHide(() => {
				disposables.dispose();
				resolve(undefined);
			}));

			qp.show();
		});
	}

	private async promptProjectName(template: IProjectTemplate): Promise<string | undefined> {
		return new Promise((resolve) => {
			const disposables = new DisposableStore();
			const input = this.quickInputService.createInputBox();

			input.title = localize('newProjectWizardTitle2', "Create New Project (2/3)");
			input.step = 2;
			input.totalSteps = 3;
			input.prompt = localize('enterProjectNamePrompt', "Enter the name for your new project");
			input.placeholder = localize('enterProjectNamePlaceholder', "e.g. {0}", template.defaultProjectName);
			input.value = template.defaultProjectName;
			input.valueSelection = [0, template.defaultProjectName.length];
			input.ignoreFocusOut = true;

			const browseButton: IQuickInputButton = {
				iconClass: 'codicon codicon-arrow-left',
				tooltip: localize('backTooltip', "Back to Template Selection")
			};
			input.buttons = [browseButton];

			disposables.add(input.onDidTriggerButton(() => {
				input.hide();
				resolve(undefined);
			}));

			disposables.add(input.onDidChangeValue((val) => {
				const errorMsg = this.validateProjectName(val);
				if (errorMsg) {
					input.validationMessage = errorMsg;
				} else {
					input.validationMessage = undefined;
				}
			}));

			disposables.add(input.onDidAccept(() => {
				const val = input.value.trim();
				const errorMsg = this.validateProjectName(val);
				if (errorMsg) {
					input.validationMessage = errorMsg;
					return;
				}
				input.hide();
				resolve(val);
			}));

			disposables.add(input.onDidHide(() => {
				disposables.dispose();
				resolve(undefined);
			}));

			input.show();
		});
	}

	private async promptParentLocation(projectName: string): Promise<URI | undefined> {
		const defaultHome = await this.fileDialogService.defaultFilePath();

		return new Promise((resolve) => {
			const disposables = new DisposableStore();
			const qp = this.quickInputService.createQuickPick<IQuickPickItem & { uri?: URI; isBrowse?: boolean }>();

			qp.title = localize('newProjectWizardTitle3', "Create New Project (3/3)");
			qp.step = 3;
			qp.totalSteps = 3;
			qp.placeholder = localize('selectLocationPlaceholder', "Select Parent Folder for '{0}' (Final path: .../{0})", projectName);
			qp.ignoreFocusOut = true;

			const browseItem: IQuickPickItem & { isBrowse: boolean } = {
				label: localize('browseFolderLabel', "$(folder-opened) Browse / Select Folder Locally..."),
				description: localize('browseFolderDesc', "Open native folder picker dialog"),
				detail: localize('browseFolderDetail', "Choose any location on your local filesystem"),
				isBrowse: true
			};

			const homeItem: IQuickPickItem & { uri: URI } = {
				label: localize('homeFolderLabel', "$(home) User Home Folder"),
				description: defaultHome.fsPath,
				detail: localize('homeFolderDetail', "Project will be created in {0}/{1}", defaultHome.fsPath, projectName),
				uri: defaultHome
			};

			const items: (IQuickPickItem & { uri?: URI; isBrowse?: boolean })[] = [
				browseItem,
				homeItem
			];

			// If there's an active workspace folder, add its parent as a convenient suggested option
			const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
			if (workspaceFolders.length > 0) {
				const parentOfCurrent = joinPath(workspaceFolders[0].uri, '..');
				items.splice(1, 0, {
					label: localize('workspaceParentLabel', "$(root-folder) Workspace Directory Parent"),
					description: parentOfCurrent.fsPath,
					detail: localize('workspaceParentDetail', "Project will be created in {0}/{1}", parentOfCurrent.fsPath, projectName),
					uri: parentOfCurrent
				});
			}

			qp.items = items;

			disposables.add(qp.onDidAccept(async () => {
				const selected = qp.selectedItems[0];
				if (!selected) {
					return;
				}

				if (selected.isBrowse) {
					qp.hide();
					const chosen = await this.fileDialogService.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						title: localize('selectParentFolderDialog', "Select Location for New Project '{0}'", projectName),
						defaultUri: defaultHome
					});
					if (chosen && chosen.length > 0) {
						resolve(chosen[0]);
					} else {
						resolve(undefined);
					}
				} else if (selected.uri) {
					qp.hide();
					resolve(selected.uri);
				}
			}));

			disposables.add(qp.onDidHide(() => {
				disposables.dispose();
				resolve(undefined);
			}));

			qp.show();
		});
	}
}

registerAction2(class CreateNewProjectAction extends Action2 {
	constructor() {
		super({
			id: 'welcome.createNewProject',
			title: localize2('welcome.newProject', 'Create New Project...'),
			category,
			f1: true,
			icon: Codicon.newFolder,
			keybinding: {
				primary: KeyChord(KeyMod.CtrlCmd | KeyMod.Alt, KeyCode.KeyN),
				weight: KeybindingWeight.WorkbenchContrib,
			},
			menu: {
				id: MenuId.MenubarFileMenu,
				group: '1_new',
				order: 1
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<boolean> {
		const manager = accessor.get(IQuickInputService);
		if (!NewProjectManager.Instance) {
			// Instant initialization fallback
			const inst = accessor.get(IFileDialogService);
			const dial = accessor.get(IDialogService);
			const file = accessor.get(IFileService);
			const host = accessor.get(IHostService);
			const ws = accessor.get(IWorkspaceContextService);
			const notif = accessor.get(INotificationService);
			new NewProjectManager(manager, inst, dial, file, host, ws, notif);
		}
		return NewProjectManager.Instance!.run();
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(NewProjectManager, LifecyclePhase.Restored);
