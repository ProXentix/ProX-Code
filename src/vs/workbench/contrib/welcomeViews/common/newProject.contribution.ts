/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyChord, KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isWindows } from '../../../../base/common/platform.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from '../../../common/contributions.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import './media/newProject.css';

const category: ILocalizedString = localize2('Project', 'Project');
const $ = dom.$;

export class NewProjectManager extends Disposable {
	static Instance: NewProjectManager | undefined;

	private isModalOpen = false;

	constructor(
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IDialogService private readonly dialogService: IDialogService,
		@IFileService private readonly fileService: IFileService,
		@IHostService private readonly hostService: IHostService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@ILayoutService private readonly layoutService: ILayoutService,
		@IPathService private readonly pathService: IPathService,
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
		if (this.isModalOpen) {
			return false;
		}

		try {
			return await this.showNewProjectDialog();
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
		const invalidChars = /[\\/:\*\?"<>\|]/;
		if (invalidChars.test(trimmed)) {
			return localize('invalidNameChars', "Project name cannot contain any of the following characters: \\ / : * ? \" < > |");
		}
		if (trimmed === '.' || trimmed === '..') {
			return localize('invalidNameDot', "Project name cannot be '.' or '..'");
		}
		const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
		if (reserved.test(trimmed)) {
			return localize('reservedName', "Project name is a reserved device name on Windows.");
		}
		return undefined;
	}

	private async getDefaultParentPath(): Promise<string> {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		if (workspaceFolders.length > 0) {
			const parent = dirname(workspaceFolders[0].uri);
			return parent.fsPath;
		}

		try {
			const userHome = await this.pathService.userHome();
			if (userHome) {
				const sep = isWindows ? '\\' : '/';
				return isWindows ? `${userHome.fsPath}${sep}ProXProjects` : `${userHome.fsPath}${sep}ProXProjects`;
			}
		} catch (e) {
			// fallback
		}

		return isWindows ? 'C:\\ProXProjects' : '/home/proxprojects';
	}

	private async showNewProjectDialog(): Promise<boolean> {
		this.isModalOpen = true;

		return new Promise<boolean>(async (resolve) => {
			const disposables = new DisposableStore();
			const parentContainer = this.layoutService.mainContainer || document.body;

			let defaultName = 'My Application';
			let parentDirectory = await this.getDefaultParentPath();
			const sep = isWindows ? '\\' : '/';

			// Overlay
			const overlay = dom.append(parentContainer, $('.new-project-modal-overlay'));

			// Dialog
			const dialog = dom.append(overlay, $('.new-project-dialog'));

			// Header
			const header = dom.append(dialog, $('.new-project-header'));
			const headerTitle = dom.append(header, $('.new-project-header-title'));
			dom.append(headerTitle, $('.codicon' + ThemeIcon.asCSSSelector(Codicon.project)));
			headerTitle.appendChild(document.createTextNode(localize('newProjectTitle', "New Project")));

			const closeBtn = dom.append(header, $('.new-project-close-btn'));
			closeBtn.appendChild($('.codicon' + ThemeIcon.asCSSSelector(Codicon.close)));
			closeBtn.setAttribute('title', localize('close', "Close"));

			// Banner
			const banner = dom.append(dialog, $('.new-project-banner'));
			const bannerTitle = dom.append(banner, $('.new-project-banner-title'));
			bannerTitle.textContent = localize('proxplAppTitle', "ProXPL Application");
			const bannerDesc = dom.append(banner, $('.new-project-banner-desc'));
			bannerDesc.textContent = localize('proxplAppDesc', "Create a new ProXPL application with ProX Configuration File (PXCF).");

			// Form
			const form = dom.append(dialog, $('.new-project-form'));

			// Row 1: Name
			const nameRow = dom.append(form, $('.new-project-row'));
			const nameLabel = dom.append(nameRow, $('.new-project-label'));
			nameLabel.textContent = localize('nameLabel', "Name");
			const nameControl = dom.append(nameRow, $('.new-project-control'));
			const nameInput = new InputBox(nameControl, this.contextViewService, {
				placeholder: 'My Application',
				inputBoxStyles: defaultInputBoxStyles
			});
			disposables.add(nameInput);
			nameInput.value = defaultName;

			const nameError = dom.append(nameControl, $('.new-project-error'));
			nameError.style.display = 'none';

			// Row 2: Save location
			const locationRow = dom.append(form, $('.new-project-row'));
			const locationLabel = dom.append(locationRow, $('.new-project-label'));
			locationLabel.textContent = localize('saveLocationLabel', "Save location");
			const locationControl = dom.append(locationRow, $('.new-project-control'));
			const locationGroup = dom.append(locationControl, $('.new-project-input-group'));

			const locationInput = new InputBox(locationGroup, this.contextViewService, {
				placeholder: parentDirectory,
				inputBoxStyles: defaultInputBoxStyles
			});
			disposables.add(locationInput);
			locationInput.value = `${parentDirectory}${sep}${defaultName}`;

			const browseBtn = dom.append(locationGroup, $('button.new-project-browse-btn'));
			browseBtn.appendChild($('.codicon' + ThemeIcon.asCSSSelector(Codicon.folderOpened)));
			browseBtn.setAttribute('title', localize('browseFolder', "Browse folder..."));

			const locationError = dom.append(locationControl, $('.new-project-error'));
			locationError.style.display = 'none';

			// Row 3: Build configuration language / file
			const configRow = dom.append(form, $('.new-project-row'));
			const configLabel = dom.append(configRow, $('.new-project-label'));
			configLabel.textContent = localize('buildConfigLabel', "Build configuration language");
			const configControl = dom.append(configRow, $('.new-project-control'));
			const configSelect = dom.append(configControl, $('select.new-project-select')) as HTMLSelectElement;
			const option = dom.append(configSelect, $('option')) as HTMLOptionElement;
			option.value = 'pxcf';
			option.text = 'ProX Configuration File (PXCF)';
			option.selected = true;

			// Info Note
			const infoNote = dom.append(form, $('.new-project-info-note'));
			infoNote.appendChild($('.codicon' + ThemeIcon.asCSSSelector(Codicon.info)));
			infoNote.appendChild(document.createTextNode(localize('infoNote', "Configured for ProXPL runtime, build tools, and runner.")));

			// Footer
			const footer = dom.append(dialog, $('.new-project-footer'));
			const cancelBtn = dom.append(footer, $('button.new-project-btn.new-project-btn-cancel')) as HTMLButtonElement;
			cancelBtn.textContent = localize('cancel', "Cancel");

			const finishBtn = dom.append(footer, $('button.new-project-btn.new-project-btn-finish')) as HTMLButtonElement;
			finishBtn.textContent = localize('finish', "Finish");

			const closeModal = (result: boolean) => {
				this.isModalOpen = false;
				disposables.dispose();
				overlay.remove();
				resolve(result);
			};

			// Sync Name with Location
			let isAutoSyncLocation = true;
			disposables.add(nameInput.onDidChange(val => {
				const error = this.validateProjectName(val);
				if (error) {
					nameError.textContent = error;
					nameError.style.display = 'block';
					finishBtn.disabled = true;
				} else {
					nameError.style.display = 'none';
					finishBtn.disabled = false;
				}

				if (isAutoSyncLocation) {
					const sanitized = val.trim() || 'My Application';
					locationInput.value = `${parentDirectory}${sep}${sanitized}`;
				}
			}));

			disposables.add(locationInput.onDidChange(val => {
				isAutoSyncLocation = false;
				if (!val.trim()) {
					locationError.textContent = localize('locationRequired', "Save location is required.");
					locationError.style.display = 'block';
					finishBtn.disabled = true;
				} else {
					locationError.style.display = 'none';
					finishBtn.disabled = false;
				}
			}));

			// Browse folder handler
			disposables.add(dom.addDisposableListener(browseBtn, dom.EventType.CLICK, async (e) => {
				dom.EventHelper.stop(e);
				try {
					const result = await this.fileDialogService.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						title: localize('selectParentFolder', "Select Parent Directory"),
						defaultUri: URI.file(parentDirectory)
					});

					if (result && result.length > 0) {
						parentDirectory = result[0].fsPath;
						const currentName = nameInput.value.trim() || defaultName;
						locationInput.value = `${parentDirectory}${sep}${currentName}`;
						isAutoSyncLocation = true;
					}
				} catch (err) {
					// user cancelled
				}
			}));

			// Finish Handler
			const handleFinish = async () => {
				const projectName = nameInput.value.trim();
				const nameValidation = this.validateProjectName(projectName);
				if (nameValidation) {
					nameError.textContent = nameValidation;
					nameError.style.display = 'block';
					nameInput.focus();
					return;
				}

				const targetPath = locationInput.value.trim();
				if (!targetPath) {
					locationError.textContent = localize('locationRequired', "Save location is required.");
					locationError.style.display = 'block';
					locationInput.focus();
					return;
				}

				finishBtn.disabled = true;
				finishBtn.textContent = localize('creating', "Creating...");

				const targetProjectUri = URI.file(targetPath);

				try {
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
									finishBtn.disabled = false;
									finishBtn.textContent = localize('finish', "Finish");
									return;
								}
							}
						} catch (e) {
							// proceed
						}
					}

					// Create project folder
					await this.fileService.createFolder(targetProjectUri);

					// Generate project files
					const filesToCreate = [
						{
							path: 'project.pxcf',
							content: `[project]\nname = "${projectName}"\nversion = "0.1.0"\ndescription = "A ProXPL application created in ProX-Code"\nauthor = "ProXentix Developer"\n\n[build]\nmain = "src/main.prox"\nconfig = "PXCF"\n`
						},
						{
							path: 'src/main.prox',
							content: `// ${projectName}\n// Entry point for your ProXPL program\n\nfunc main() {\n    print("Welcome to ProXPL!");\n}\n\nmain();\n`
						},
						{
							path: 'README.md',
							content: `# ${projectName}\n\nA ProXPL project created with **ProX-Code**.\n\n## Running the Project\n\n- Press \`Ctrl+F5\` or click **Run ProXPL**\n- Build configuration: ProX Configuration File (PXCF)\n`
						},
						{
							path: '.gitignore',
							content: `# Build outputs & artifacts\nbin/\ndist/\n*.out\n*.exe\n.prm/\n.prox/\n`
						}
					];

					for (const file of filesToCreate) {
						const fileUri = joinPath(targetProjectUri, file.path);
						if (file.path.includes('/')) {
							const dirUri = joinPath(targetProjectUri, ...file.path.split('/').slice(0, -1));
							await this.fileService.createFolder(dirUri);
						}
						await this.fileService.writeFile(fileUri, VSBuffer.fromString(file.content));
					}

					this.notificationService.notify({
						severity: Severity.Info,
						message: localize('projectCreatedSuccess', "Project '{0}' created successfully.", projectName)
					});

					closeModal(true);

					const currentWorkspaceFolders = this.workspaceContextService.getWorkspace().folders;
					const reuseWindow = currentWorkspaceFolders.length === 0;

					await this.hostService.openWindow([{ folderUri: targetProjectUri }], {
						forceReuseWindow: reuseWindow,
						forceNewWindow: !reuseWindow
					});

				} catch (err) {
					finishBtn.disabled = false;
					finishBtn.textContent = localize('finish', "Finish");
					this.notificationService.error(
						localize('createProjectFailed', "Could not create project: {0}", (err as Error)?.message || String(err))
					);
				}
			};

			// Event listeners
			disposables.add(dom.addDisposableListener(closeBtn, dom.EventType.CLICK, () => closeModal(false)));
			disposables.add(dom.addDisposableListener(cancelBtn, dom.EventType.CLICK, () => closeModal(false)));
			disposables.add(dom.addDisposableListener(finishBtn, dom.EventType.CLICK, () => handleFinish()));

			// Key listener: ESC to close, Enter to finish
			disposables.add(dom.addDisposableListener(overlay, dom.EventType.KEY_DOWN, (e: KeyboardEvent) => {
				const event = new StandardKeyboardEvent(e);
				if (event.equals(KeyCode.Escape)) {
					dom.EventHelper.stop(e, true);
					closeModal(false);
				} else if (event.equals(KeyCode.Enter)) {
					if (document.activeElement === browseBtn || document.activeElement === cancelBtn) {
						return;
					}
					dom.EventHelper.stop(e, true);
					handleFinish();
				}
			}));

			// Close on clicking backdrop
			disposables.add(dom.addDisposableListener(overlay, dom.EventType.CLICK, (e) => {
				if (e.target === overlay) {
					closeModal(false);
				}
			}));

			// Initial focus
			setTimeout(() => {
				nameInput.focus();
				nameInput.select();
			}, 50);
		});
	}
}

// ---------------------------------------------------------------------------
// Action & Registration
// ---------------------------------------------------------------------------

registerAction2(class CreateNewProjectAction extends Action2 {
	constructor() {
		super({
			id: 'welcome.createNewProject',
			title: localize2('welcome.newProject', 'Create New Project...'),
			category,
			f1: true,
			keybinding: {
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyN),
				weight: KeybindingWeight.WorkbenchContrib
			},
			menu: [
				{
					id: MenuId.MenubarFileMenu,
					group: '1_new',
					order: 1.5
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<boolean> {
		const file = accessor.get(IFileService);
		const dial = accessor.get(IDialogService);
		const host = accessor.get(IHostService);
		const ws = accessor.get(IWorkspaceContextService);
		const notif = accessor.get(INotificationService);
		const fileDialog = accessor.get(IFileDialogService);
		const contextView = accessor.get(IContextViewService);
		const layout = accessor.get(ILayoutService);
		const path = accessor.get(IPathService);

		if (!NewProjectManager.Instance) {
			new NewProjectManager(fileDialog, dial, file, host, ws, notif, contextView, layout, path);
		}

		return NewProjectManager.Instance!.run();
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(NewProjectManager, LifecyclePhase.Restored);
