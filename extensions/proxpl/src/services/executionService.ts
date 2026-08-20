import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';

export type ProcessState = 'Ready' | 'Running' | 'Success' | 'Failed' | 'Stopped' | 'Configuration Error';

export class ExecutionService {
    private currentProcess: cp.ChildProcess | undefined;
    private state: ProcessState = 'Ready';
    private startTime: number = 0;

    private readonly _onDidStateChange = new vscode.EventEmitter<ProcessState>();
    public readonly onDidStateChange = this._onDidStateChange.event;

    private readonly _onDidOutput = new vscode.EventEmitter<{ type: 'stdout' | 'stderr' | 'system', data: string }>();
    public readonly onDidOutput = this._onDidOutput.event;

    public getState(): ProcessState {
        return this.state;
    }

    private setState(state: ProcessState) {
        this.state = state;
        this._onDidStateChange.fire(state);
    }

    public async run(cwd: string, entryFile: string | undefined, extraArgs: string[] = [], envOverrides: NodeJS.ProcessEnv = {}): Promise<void> {
        if (this.currentProcess) {
            this.stop();
        }

        const prmPath = 'prm'; // Assume PRM is in PATH for now; in production we could resolve via config
        const args = ['run'];
        if (entryFile) {
            args.push(entryFile);
        }
        if (extraArgs.length > 0) {
            args.push(...extraArgs);
        }

        this.setState('Running');
        this.startTime = Date.now();
        this._onDidOutput.fire({ type: 'system', data: `> Executing: ${prmPath} ${args.join(' ')}\n> Working Directory: ${cwd}\n\n` });

        const env = { ...process.env, ...envOverrides };

        try {
            this.currentProcess = cp.spawn(prmPath, args, {
                cwd,
                env,
                shell: process.platform === 'win32' // Use shell on Windows to find PRM if it's a cmd/bat wrapper
            });

            this.currentProcess.stdout?.on('data', (data) => {
                this._onDidOutput.fire({ type: 'stdout', data: data.toString() });
            });

            this.currentProcess.stderr?.on('data', (data) => {
                this._onDidOutput.fire({ type: 'stderr', data: data.toString() });
            });

            this.currentProcess.on('error', (err) => {
                this._onDidOutput.fire({ type: 'system', data: `\n[Process Error] ${err.message}\n` });
                this.setState('Failed');
                this.currentProcess = undefined;
            });

            this.currentProcess.on('close', (code) => {
                const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
                if (this.state !== 'Stopped') {
                    this._onDidOutput.fire({ type: 'system', data: `\n[Process Exited] Code: ${code}, Duration: ${duration}s\n` });
                    if (code === 0) {
                        this.setState('Success');
                    } else {
                        this.setState('Failed');
                    }
                }
                this.currentProcess = undefined;
            });

        } catch (error: any) {
            this._onDidOutput.fire({ type: 'system', data: `\n[Failed to launch] ${error.message}\n` });
            this.setState('Configuration Error');
        }
    }

    public stop() {
        if (this.currentProcess) {
            this.setState('Stopped');
            
            // On Windows, killing the parent process doesn't kill children spawned by `shell: true`.
            // We use taskkill to kill the process tree.
            if (process.platform === 'win32' && this.currentProcess.pid) {
                cp.exec(`taskkill /pid ${this.currentProcess.pid} /T /F`, (err) => {
                    if (err) {
                        this._onDidOutput.fire({ type: 'system', data: `\n[System] Failed to kill process tree: ${err.message}\n` });
                    } else {
                        this._onDidOutput.fire({ type: 'system', data: `\n[System] Process tree stopped.\n` });
                    }
                });
            } else {
                this.currentProcess.kill('SIGKILL');
                this._onDidOutput.fire({ type: 'system', data: `\n[System] Process stopped.\n` });
            }
            
            this.currentProcess = undefined;
        }
    }
}
