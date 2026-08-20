import * as vscode from 'vscode';
import * as path from 'path';
import { PxcfParser, PxcfProject } from '../pxcf/parser';

export class ProjectService {
    private activeProjectPath: string | undefined;
    private activeProjectConfig: PxcfProject | undefined;
    private diagnosticCollection: vscode.DiagnosticCollection;
    
    private readonly _onDidChangeProject = new vscode.EventEmitter<void>();
    public readonly onDidChangeProject = this._onDidChangeProject.event;

    constructor(context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('proxpl-pxcf');
        context.subscriptions.push(this.diagnosticCollection);
        
        // Watch for project.pxcf changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/project.pxcf');
        watcher.onDidChange(uri => this.handleFileChange(uri));
        watcher.onDidCreate(uri => this.handleFileChange(uri));
        watcher.onDidDelete(uri => this.handleFileDelete(uri));
        context.subscriptions.push(watcher);
    }

    public async initialize(): Promise<void> {
        await this.discoverProject();
    }

    public getActiveProjectPath(): string | undefined {
        return this.activeProjectPath;
    }

    public getActiveProjectConfig(): PxcfProject | undefined {
        return this.activeProjectConfig;
    }

    public async discoverProject(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        // Preferred order:
        // 1. Current workspace root
        for (const folder of workspaceFolders) {
            const candidate = vscode.Uri.joinPath(folder.uri, 'project.pxcf');
            try {
                await vscode.workspace.fs.stat(candidate);
                await this.loadProject(candidate);
                return;
            } catch (e) {
                // Not found
            }
        }
        
        // 2. Scan for any project.pxcf in the workspace if not in root
        const files = await vscode.workspace.findFiles('**/project.pxcf', '**/node_modules/**', 1);
        if (files.length > 0) {
            await this.loadProject(files[0]);
        }
    }

    private async handleFileChange(uri: vscode.Uri) {
        if (!this.activeProjectPath || uri.fsPath === this.activeProjectPath) {
            await this.loadProject(uri);
        }
    }

    private handleFileDelete(uri: vscode.Uri) {
        if (this.activeProjectPath === uri.fsPath) {
            this.activeProjectPath = undefined;
            this.activeProjectConfig = undefined;
            this.diagnosticCollection.delete(uri);
            this._onDidChangeProject.fire();
        }
    }

    private async loadProject(uri: vscode.Uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            
            const { project, diagnostics } = PxcfParser.parse(content);
            PxcfParser.validate(project, diagnostics);
            
            // Map diagnostics to vscode.Diagnostic
            const vscodeDiagnostics = diagnostics.map(d => {
                const range = new vscode.Range(d.line, 0, d.line, 1000); // Highlight whole line
                return new vscode.Diagnostic(range, d.message, d.severity);
            });
            
            this.diagnosticCollection.set(uri, vscodeDiagnostics);
            
            this.activeProjectPath = uri.fsPath;
            this.activeProjectConfig = project;
            this._onDidChangeProject.fire();
            
        } catch (error) {
            console.error("Failed to load project config", error);
        }
    }
}
