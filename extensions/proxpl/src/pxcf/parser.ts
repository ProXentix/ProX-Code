import * as vscode from 'vscode';

export interface PxcfNode {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    value: any;
    line: number;
    column: number;
}

export interface PxcfProject {
    [section: string]: {
        [key: string]: PxcfNode;
    };
}

export interface PxcfDiagnostic {
    message: string;
    line: number;
    severity: vscode.DiagnosticSeverity;
}

export class PxcfParser {
    public static parse(content: string): { project: PxcfProject, diagnostics: PxcfDiagnostic[] } {
        const project: PxcfProject = {};
        const diagnostics: PxcfDiagnostic[] = [];
        
        const lines = content.split(/\r?\n/);
        let currentSection: string | null = null;
        let inArray = false;
        let currentArrayKey: string | null = null;
        let currentArrayValues: any[] = [];
        let arrayStartLine = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) {
                continue;
            }

            // Strip inline comments if not inside string
            const commentIdx = line.indexOf('#');
            if (commentIdx !== -1) {
                // Extremely naive check: only strip if # isn't inside quotes (good enough for basic configs)
                const beforeComment = line.substring(0, commentIdx);
                const quotesCount = (beforeComment.match(/"/g) || []).length;
                if (quotesCount % 2 === 0) {
                    line = beforeComment.trim();
                }
            }
            if (!line) continue;

            if (inArray) {
                if (line.endsWith(']')) {
                    const val = line.substring(0, line.length - 1).trim();
                    if (val && val !== ',') {
                        try {
                            currentArrayValues.push(PxcfParser.parseValue(val.replace(/,$/, '')));
                        } catch (e: any) {
                            diagnostics.push({ message: e.message, line: i, severity: vscode.DiagnosticSeverity.Error });
                        }
                    }
                    if (currentSection && currentArrayKey) {
                        project[currentSection][currentArrayKey] = {
                            type: 'array',
                            value: currentArrayValues,
                            line: arrayStartLine,
                            column: 0
                        };
                    }
                    inArray = false;
                    currentArrayKey = null;
                    currentArrayValues = [];
                } else {
                    const val = line.replace(/,$/, '').trim();
                    if (val) {
                        try {
                            currentArrayValues.push(PxcfParser.parseValue(val));
                        } catch (e: any) {
                            diagnostics.push({ message: e.message, line: i, severity: vscode.DiagnosticSeverity.Error });
                        }
                    }
                }
                continue;
            }

            // Match end of section
            if (line === '}') {
                currentSection = null;
                continue;
            }

            // Match section start: identifier {
            const sectionMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*\{$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1];
                if (!project[currentSection]) {
                    project[currentSection] = {};
                }
                continue;
            }

            // Match key: value
            const kvMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/);
            if (kvMatch) {
                const key = kvMatch[1];
                const rawValue = kvMatch[2].trim();
                
                if (!currentSection) {
                    diagnostics.push({
                        message: `Key-value pair '${key}' must be inside a block (e.g. project { ... }).`,
                        line: i,
                        severity: vscode.DiagnosticSeverity.Error
                    });
                    continue;
                }

                if (rawValue === '[') {
                    inArray = true;
                    currentArrayKey = key;
                    arrayStartLine = i;
                    continue;
                }

                try {
                    const parsedValue = PxcfParser.parseValue(rawValue);
                    project[currentSection][key] = {
                        type: Array.isArray(parsedValue) ? 'array' : typeof parsedValue as any,
                        value: parsedValue,
                        line: i,
                        column: lines[i].indexOf(key)
                    };
                } catch (err: any) {
                    diagnostics.push({
                        message: `Invalid value for key '${key}': ${err.message}`,
                        line: i,
                        severity: vscode.DiagnosticSeverity.Error
                    });
                }
            } else {
                diagnostics.push({
                    message: `Invalid syntax. Expected 'block {' or 'key: value' or '}'.`,
                    line: i,
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
        }

        if (inArray) {
            diagnostics.push({ message: `Unclosed array starting at line ${arrayStartLine + 1}.`, line: lines.length - 1, severity: vscode.DiagnosticSeverity.Error });
        }
        if (currentSection) {
            diagnostics.push({ message: `Unclosed block '${currentSection}'.`, line: lines.length - 1, severity: vscode.DiagnosticSeverity.Error });
        }

        return { project, diagnostics };
    }

    private static parseValue(raw: string): any {
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === 'null') return null;
        if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
        if (raw.startsWith('"') && raw.endsWith('"')) {
            return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
        if (raw.startsWith('[') && raw.endsWith(']')) {
            const inner = raw.slice(1, -1).trim();
            if (!inner) return [];
            const items = inner.split(',').map(s => s.trim());
            return items.map(i => PxcfParser.parseValue(i));
        }
        throw new Error(`Unrecognized value format '${raw}'. Expected string, number, boolean, or array.`);
    }

    public static validate(project: PxcfProject, diagnostics: PxcfDiagnostic[]): void {
        if (!project['project']) {
            diagnostics.push({
                message: "Missing required block 'project { ... }'.",
                line: 0,
                severity: vscode.DiagnosticSeverity.Error
            });
            return;
        }

        const projSection = project['project'];
        if (!projSection['name']) {
            diagnostics.push({
                message: "Missing required field 'name' in 'project' block.",
                line: 0,
                severity: vscode.DiagnosticSeverity.Error
            });
        }
    }
}
