import * as vscode from 'vscode';
import { ProjectService } from '../services/projectService';
import { ExecutionService } from '../services/executionService';
import * as path from 'path';

export class RunPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'proxpl.runView.main';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly projectService: ProjectService,
        private readonly executionService: ExecutionService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.command) {
                case 'run':
                    this.runProject(data.args, data.env);
                    break;
                case 'stop':
                    this.executionService.stop();
                    break;
                case 'restart':
                    this.executionService.stop();
                    setTimeout(() => this.runProject(data.args, data.env), 500); // Give it time to die
                    break;
                case 'openFile':
                    if (data.file) {
                        vscode.workspace.openTextDocument(vscode.Uri.file(data.file)).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                    break;
            }
        });

        // Listen to Execution state
        this.executionService.onDidStateChange(state => {
            this._view?.webview.postMessage({ command: 'state', state });
        });

        this.executionService.onDidOutput(output => {
            this._view?.webview.postMessage({ command: 'output', type: output.type, data: output.data });
        });

        // Listen to Project state
        this.projectService.onDidChangeProject(() => {
            this.updateWebviewProjectState();
        });

        // Initialize state
        this.updateWebviewProjectState();
    }

    private updateWebviewProjectState() {
        const config = this.projectService.getActiveProjectConfig();
        const projectPath = this.projectService.getActiveProjectPath();
        
        let entryPoint = '';
        let name = 'No Project Configured';
        
        if (config && config['project']) {
            name = config['project']['name']?.value || name;
            entryPoint = config['project']['entry']?.value || '';
        } else if (vscode.window.activeTextEditor) {
            // Fallback to active file if no project.pxcf is found
            const fileName = vscode.window.activeTextEditor.document.fileName;
            if (fileName.endsWith('.prox') || fileName.endsWith('.pxpl')) {
                name = 'Active File';
                entryPoint = fileName;
            }
        }

        this._view?.webview.postMessage({
            command: 'project',
            name,
            entryPoint,
            projectPath
        });
    }

    private runProject(args: string, envString: string) {
        let cwd = '';
        let entryFile: string | undefined = undefined;

        const projectPath = this.projectService.getActiveProjectPath();
        const config = this.projectService.getActiveProjectConfig();

        if (projectPath) {
            cwd = path.dirname(projectPath);
            if (config && config['project'] && config['project']['entry']) {
                entryFile = config['project']['entry'].value;
            }
        } else if (vscode.window.activeTextEditor) {
            const fileName = vscode.window.activeTextEditor.document.fileName;
            if (fileName.endsWith('.prox') || fileName.endsWith('.pxpl')) {
                cwd = path.dirname(fileName);
                entryFile = path.basename(fileName);
            }
        }

        if (!cwd) {
            vscode.window.showErrorMessage('No ProXPL project or file found to run.');
            return;
        }

        const argsArray = args.split(' ').filter(a => a.trim().length > 0);
        
        const env: any = {};
        if (envString) {
            envString.split(',').forEach(pair => {
                const [k, v] = pair.split('=');
                if (k && v) {
                    env[k.trim()] = v.trim();
                }
            });
        }

        this.executionService.run(cwd, entryFile, argsArray, env);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ProXPL Run</title>
            <style>
                body {
                    padding: 10px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    box-sizing: border-box;
                }
                .header {
                    margin-bottom: 15px;
                }
                .project-name {
                    font-weight: bold;
                    font-size: 1.1em;
                    margin-bottom: 5px;
                }
                .entry-point {
                    color: var(--vscode-descriptionForeground);
                    font-size: 0.9em;
                    margin-bottom: 10px;
                    word-wrap: break-word;
                }
                .controls {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 15px;
                }
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    cursor: pointer;
                    border-radius: 2px;
                    flex: 1;
                    font-weight: 500;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                button.stop {
                    background: var(--vscode-errorForeground);
                }
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .form-group {
                    margin-bottom: 10px;
                }
                label {
                    display: block;
                    font-size: 0.9em;
                    margin-bottom: 4px;
                }
                input {
                    width: 100%;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 4px;
                    box-sizing: border-box;
                }
                input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                }
                .console-container {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    margin-top: 10px;
                    min-height: 150px;
                }
                .console-header {
                    font-size: 0.9em;
                    font-weight: bold;
                    margin-bottom: 5px;
                    display: flex;
                    justify-content: space-between;
                }
                .status-badge {
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 0.8em;
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                }
                .status-Running { background: var(--vscode-charts-blue); }
                .status-Success { background: var(--vscode-charts-green); }
                .status-Failed { background: var(--vscode-charts-red); }
                .status-Stopped { background: var(--vscode-charts-orange); }
                
                #console-output {
                    flex-grow: 1;
                    background: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    padding: 8px;
                    overflow-y: auto;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.9em;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .out-stdout { color: var(--vscode-terminal-foreground); }
                .out-stderr { color: var(--vscode-terminal-ansiRed); }
                .out-system { color: var(--vscode-terminal-ansiBlue); }
                
                .clear-btn {
                    background: transparent;
                    color: var(--vscode-textLink-foreground);
                    padding: 0;
                    width: auto;
                    flex: none;
                }
                .clear-btn:hover {
                    background: transparent;
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="project-name" id="projectName">Loading...</div>
                <div class="entry-point" id="entryPoint"></div>
            </div>

            <div class="controls">
                <button id="btnRun">Run ▶</button>
                <button id="btnStop" class="stop" disabled>Stop ■</button>
                <button id="btnRestart" disabled>Restart ↻</button>
            </div>

            <div class="form-group">
                <label for="inputArgs">Arguments</label>
                <input type="text" id="inputArgs" placeholder="e.g. --verbose -p 8080">
            </div>

            <div class="form-group">
                <label for="inputEnv">Environment Variables</label>
                <input type="text" id="inputEnv" placeholder="e.g. PORT=8080, DEBUG=1">
            </div>

            <div class="console-container">
                <div class="console-header">
                    <span>Output <span id="statusBadge" class="status-badge">Ready</span></span>
                    <button class="clear-btn" id="btnClear">Clear</button>
                </div>
                <div id="console-output"></div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                const btnRun = document.getElementById('btnRun');
                const btnStop = document.getElementById('btnStop');
                const btnRestart = document.getElementById('btnRestart');
                const btnClear = document.getElementById('btnClear');
                
                const projectNameEl = document.getElementById('projectName');
                const entryPointEl = document.getElementById('entryPoint');
                const consoleEl = document.getElementById('console-output');
                const statusBadge = document.getElementById('statusBadge');
                
                const inputArgs = document.getElementById('inputArgs');
                const inputEnv = document.getElementById('inputEnv');

                let currentState = 'Ready';

                btnRun.addEventListener('click', () => {
                    consoleEl.innerHTML = '';
                    vscode.postMessage({
                        command: 'run',
                        args: inputArgs.value,
                        env: inputEnv.value
                    });
                });

                btnStop.addEventListener('click', () => {
                    vscode.postMessage({ command: 'stop' });
                });

                btnRestart.addEventListener('click', () => {
                    consoleEl.innerHTML = '';
                    vscode.postMessage({
                        command: 'restart',
                        args: inputArgs.value,
                        env: inputEnv.value
                    });
                });

                btnClear.addEventListener('click', () => {
                    consoleEl.innerHTML = '';
                });

                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'project':
                            projectNameEl.textContent = message.name;
                            if (message.entryPoint) {
                                entryPointEl.innerHTML = 'Entry: <a href="#" id="openEntry">' + message.entryPoint + '</a>';
                                document.getElementById('openEntry').addEventListener('click', () => {
                                    vscode.postMessage({ command: 'openFile', file: message.projectPath ? message.projectPath.replace('project.pxcf', message.entryPoint) : message.entryPoint });
                                });
                            } else {
                                entryPointEl.textContent = 'No entry point configured';
                            }
                            break;
                        case 'state':
                            currentState = message.state;
                            statusBadge.textContent = currentState;
                            statusBadge.className = 'status-badge status-' + currentState;
                            
                            const isRunning = currentState === 'Running';
                            btnRun.disabled = isRunning;
                            btnStop.disabled = !isRunning;
                            btnRestart.disabled = !isRunning;
                            break;
                        case 'output':
                            const span = document.createElement('span');
                            span.className = 'out-' + message.type;
                            span.textContent = message.data;
                            consoleEl.appendChild(span);
                            consoleEl.scrollTop = consoleEl.scrollHeight;
                            break;
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
