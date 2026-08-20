import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';
import { ProjectService } from './services/projectService';
import { ExecutionService } from './services/executionService';
import { RunPanelProvider } from './ui/RunPanelProvider';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('proxpl');
    context.subscriptions.push(diagnosticCollection);

    vscode.window.showInformationMessage('ProX Studio Alpha started.');

    // --- LSP Client Setup ---
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );
    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: debugOptions
        }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'proxpl' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };

    client = new LanguageClient(
        'proxplLanguageServer',
        'ProXPL Language Server',
        serverOptions,
        clientOptions
    );

    client.start();

    // --- PROXPL RUN Panel ---
    const projectService = new ProjectService(context);
    const executionService = new ExecutionService();
    projectService.initialize();

    const runPanelProvider = new RunPanelProvider(context.extensionUri, projectService, executionService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(RunPanelProvider.viewType, runPanelProvider)
    );

    // 1. Code Runner Command — proxpl.run
    //    Priority:
    //      a) If a prox.toml exists in the workspace root or active file's ancestor directories → prm run (project mode)
    //      b) If an active .prox / .pxpl file is open → prm run "<path>" (file mode)
    //      c) Otherwise → clear user-facing error
    const runCommand = vscode.commands.registerCommand('proxpl.run', async () => {
        const editor = vscode.window.activeTextEditor;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // --- Locate prox.toml (project-level run) ---
        let projecTomlPath: string | undefined;
        let projectDir: string | undefined;

        // Check workspace root(s) first
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const candidate = path.join(folder.uri.fsPath, 'prox.toml');
                if (require('fs').existsSync(candidate)) {
                    projecTomlPath = candidate;
                    projectDir = folder.uri.fsPath;
                    break;
                }
            }
        }

        // If no workspace prox.toml, check ancestor dirs of active file
        if (!projecTomlPath && editor) {
            let dir = path.dirname(editor.document.fileName);
            for (let i = 0; i < 10; i++) {
                const candidate = path.join(dir, 'prox.toml');
                if (require('fs').existsSync(candidate)) {
                    projecTomlPath = candidate;
                    projectDir = dir;
                    break;
                }
                const parent = path.dirname(dir);
                if (parent === dir) { break; }
                dir = parent;
            }
        }

        // --- Determine run mode ---
        const isProjectRun = !!projecTomlPath;
        let fileToRun: string | undefined;

        if (!isProjectRun) {
            if (!editor) {
                vscode.window.showErrorMessage(
                    'No active ProXPL file to run. Open a .prox file and try again.'
                );
                return;
            }
            const fileName = editor.document.fileName;
            if (!fileName.endsWith('.prox') && !fileName.endsWith('.pxpl')) {
                vscode.window.showErrorMessage(
                    'Not a ProXPL file. Open a .prox or .pxpl file and try again.'
                );
                return;
            }
            fileToRun = fileName;
        }

        // --- Check if prm is in PATH ---
        cp.exec('prm --version', async (err: Error | null) => {
            if (err) {
                const selection = await vscode.window.showInformationMessage(
                    'PRM (ProX Resource Manager) not found in PATH. Please install it to run ProXPL scripts.',
                    'View Installation Docs'
                );
                if (selection === 'View Installation Docs') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/ProgrammerKR/ProXPL#installation'));
                }
                return;
            }

            // Save active file before running
            if (editor) {
                await editor.document.save();
            }

            let terminal = vscode.window.terminals.find(t => t.name === 'ProXPL');
            if (!terminal) {
                terminal = vscode.window.createTerminal({
                    name: 'ProXPL',
                    cwd: projectDir || (fileToRun ? path.dirname(fileToRun) : undefined),
                });
            }
            terminal.show();

            if (isProjectRun) {
                // Project mode: cd to project dir, then prm run
                terminal.sendText(`cd "${projectDir}" && prm run`);
            } else {
                // File mode
                terminal.sendText(`prm run "${fileToRun}"`);
            }
        });
    });

    context.subscriptions.push(runCommand);

    // 1b. Build Command — proxpl.build
    const buildCommand = vscode.commands.registerCommand('proxpl.build', async () => {
        const editor = vscode.window.activeTextEditor;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        let projectDir: string | undefined;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const candidate = path.join(folder.uri.fsPath, 'prox.toml');
                if (require('fs').existsSync(candidate)) {
                    projectDir = folder.uri.fsPath;
                    break;
                }
            }
        }
        if (!projectDir && editor) {
            let dir = path.dirname(editor.document.fileName);
            for (let i = 0; i < 10; i++) {
                if (require('fs').existsSync(path.join(dir, 'prox.toml'))) {
                    projectDir = dir;
                    break;
                }
                const parent = path.dirname(dir);
                if (parent === dir) { break; }
                dir = parent;
            }
        }

        if (!editor && !projectDir) {
            vscode.window.showErrorMessage('No active ProXPL file or project to build.');
            return;
        }

        if (!projectDir && editor) {
            const fileName = editor.document.fileName;
            if (!fileName.endsWith('.prox') && !fileName.endsWith('.pxpl')) {
                vscode.window.showErrorMessage('Not a ProXPL file. Open a .prox or .pxpl file and try again.');
                return;
            }
        }

        cp.exec('prm --version', async (err: Error | null) => {
            if (err) {
                vscode.window.showInformationMessage(
                    'PRM (ProX Resource Manager) not found in PATH. Please install it.',
                    'View Installation Docs'
                ).then((sel: string | undefined) => {
                    if (sel === 'View Installation Docs') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ProgrammerKR/ProXPL#installation'));
                    }
                });
                return;
            }
            if (editor) { await editor.document.save(); }
            let terminal = vscode.window.terminals.find(t => t.name === 'ProXPL');
            if (!terminal) {
                terminal = vscode.window.createTerminal({ name: 'ProXPL', cwd: projectDir });
            }
            terminal.show();
            if (projectDir) {
                terminal.sendText(`cd "${projectDir}" && prm build`);
            } else if (editor) {
                terminal.sendText(`prm build "${editor.document.fileName}"`);
            }
        });
    });

    context.subscriptions.push(buildCommand);

    // 1c. Debug Command — proxpl.debug
    //     Starts a ProXPL debug session using the existing DAP integration.
    const debugCommand = vscode.commands.registerCommand('proxpl.debug', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active ProXPL file to debug. Open a .prox file and try again.');
            return;
        }
        const fileName = editor.document.fileName;
        if (!fileName.endsWith('.prox') && !fileName.endsWith('.pxpl')) {
            vscode.window.showErrorMessage('Not a ProXPL file. Open a .prox or .pxpl file and try again.');
            return;
        }
        await editor.document.save();
        vscode.debug.startDebugging(undefined, {
            type: 'proxpl',
            request: 'launch',
            name: 'ProXPL Debug',
            program: fileName,
        });
    });

    context.subscriptions.push(debugCommand);

    // 4. Hover Support
    const hoverProvider = vscode.languages.registerHoverProvider('proxpl', {
        provideHover(document: vscode.TextDocument, position: vscode.Position) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;
            const word = document.getText(range);

            const descriptions: { [key: string]: string } = {
                'func': 'Defines a new function in ProXPL. Syntax: `func name(params) { ... }`',
                'var': 'Declares a new variable.',
                'let': 'Declares a mutable variable.',
                'const': 'Declares an immutable constant.',
                'if': 'Conditional statement.',
                'else': 'Defines an alternative block for an `if` statement.',
                'while': 'Loop that continues as long as a condition is true.',
                'for': 'Loop with initializer, condition, and increment.',
                'return': 'Exits a function and optionally returns a value.',
                'print': 'Output values to the terminal.',
                'use': 'Incorporates external modules.',
                'from': 'Specifies the source module for an import.',
                'as': 'Aliases an imported member or type casts.',
                'class': 'Defines a new class.',
                'interface': 'Defines an interface contract.',
                'implements': 'Declares that a class implements an interface.',
                'extends': 'Declares that a class inherits from another class.',
                'public': 'Access modifier: Member is accessible from anywhere.',
                'private': 'Access modifier: Member is accessible only within the class.',
                'protected': 'Access modifier: Member is accessible within class and subclasses.',
                'static': 'Defines a static member belonging to the class itself.',
                'abstract': 'Defines a method signature without implementation.',
                'this': 'Refers to the current instance.',
                'super': 'Refers to the superclass.',
                'async': 'Defines an asynchronous function.',
                'await': 'Pauses execution until a promise resolves.',
                'true': 'Boolean true literal.',
                'false': 'Boolean false literal.',
                'null': 'Represents the absence of value.',
                'len': 'Returns the length of a string or list.',
                'type': 'Returns the type of a value.',
                'try': 'Starts a block of code to test for errors.',
                'catch': 'Handles errors thrown in the try block.',
                'throw': 'Throws an error/exception.',
                'context': 'Groups behavioral layers.',
                'layer': 'Defines a behavioral layer within a context.',
                'activate': 'Enables a context for the duration of a block.',
                'App': 'Defines a UI Application component.',
                'State': 'Declares reactive state inside a UI App.',
                'Action': 'Declares a state-mutating action inside a UI App.',
                'defer': 'Defers the execution of a statement until the surrounding function returns.',
                'tensor': 'Declarator for multi-dimensional array types.',
                'intent': 'Defines an Intent-Oriented goal.',
                'resolver': 'Fulfills a declared intent.',
                'model': 'Declares an AI/ML model structure.',
                'train': 'Initiates training sequence for a model.',
                'predict': 'Executes inference on a trained model.',
                'resilient': 'Marks a block or function as fault-tolerant.',
                'recovery': 'Defines fallback logic for resilient blocks.',
                'verify': 'Validates system state or cryptographic identities.',
                'identity': 'Represents an authenticated entity context.',
                'to_int': 'Type conversion to integer.',
                'to_float': 'Type conversion to floating-point number.',
                'to_string': 'Type conversion to string.',
                'to_bool': 'Type conversion to boolean.',
                'to_hex': 'Integer to Hexadecimal string string conversion.',
                'to_bin': 'Integer to Binary string conversion.',
                'char_at': 'Retrieves the character at a specific index from a string.',
                'std.core': 'Standard module: Core Utilities (assert, typeOf, id, hash).',
                'std.math': 'Standard module: Mathematics (abs, min, pow, random, sin).',
                'std.string': 'Standard module: String Manipulation (upper, split, replace).',
                'std.io': 'Standard module: Input/Output (read_file, write_file).',
                'std.sys': 'Standard module: System Interface (exit, env, exec).'
            };

            if (descriptions[word]) {
                return new vscode.Hover(new vscode.MarkdownString(descriptions[word]));
            }
            return null;
        }
    });
    context.subscriptions.push(hoverProvider);

    // 5. Definition Provider (Basic "Go to Definition")
    const definitionProvider = vscode.languages.registerDefinitionProvider('proxpl', {
        provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
            const range = document.getWordRangeAtPosition(position);
            if (!range) return null;
            const word = document.getText(range);

            const text = document.getText();
            // Regex to find 'func word' or 'class word'
            const funcRegex = new RegExp(`func\\s+${word}\\s*\\(`, 'g');
            const classRegex = new RegExp(`class\\s+${word}\\s*\\{`, 'g');

            const results: vscode.Location[] = [];

            let match;
            while ((match = funcRegex.exec(text)) !== null) {
                const pos = document.positionAt(match.index);
                results.push(new vscode.Location(document.uri, new vscode.Range(pos, pos)));
            }
            while ((match = classRegex.exec(text)) !== null) {
                const pos = document.positionAt(match.index);
                results.push(new vscode.Location(document.uri, new vscode.Range(pos, pos)));
            }

            return results;
        }
    });
    context.subscriptions.push(definitionProvider);

    // 6. Completion Item Provider (DEPRECATED: Now handled by LSP)
    /*
    const completionProvider = vscode.languages.registerCompletionItemProvider('proxpl', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
            // ... (old logic) ...
            return [];
        }
    });
    context.subscriptions.push(completionProvider);
    */

    // --- DAP Setup ---
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('proxpl', new ProXDebugAdapterDescriptorFactory()));
}

class ProXDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        // For now, use a simple inline implementation or rely on an executable
        // This is a placeholder for the future DAP implementation
        // return new vscode.DebugAdapterExecutable('proxpl', ['--debug-adapter']);
        return new vscode.DebugAdapterInlineImplementation(new ProXDebugAdapter());
    }
}

class ProXDebugAdapter implements vscode.DebugAdapter {
    private _sendMessage = new vscode.EventEmitter<vscode.DebugProtocolMessage>();
    readonly onDidSendMessage: vscode.Event<vscode.DebugProtocolMessage> = this._sendMessage.event;

    handleMessage(message: vscode.DebugProtocolMessage): void {
        // Minimal Mock Handler
        const msg = message as any;
        if (msg.type === 'request') {
            const request = msg;
            if (request.command === 'initialize') {
                this._sendMessage.fire({
                    type: 'response',
                    request_seq: request.seq,
                    success: true,
                    command: request.command,
                    body: {
                        supportsConfigurationDoneRequest: true
                    }
                } as any);
            } else {
                this._sendMessage.fire({
                    type: 'response',
                    request_seq: request.seq,
                    success: true,
                    command: request.command
                } as any);
            }
        }
    }

    dispose() {

    }
}

function mapLineNumber(lineStr: string): number {
    const num = parseInt(lineStr);
    return isNaN(num) ? 0 : num - 1;
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
