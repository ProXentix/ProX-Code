const fs = require('fs');
const path = require('path');

const errorsFilePath = path.join(__dirname, 'ts_errors.txt');
const errorsText = fs.readFileSync(errorsFilePath, 'utf16le');

const fileLines = {}; 

const errorLines = errorsText.split('\n');
for (let line of errorLines) {
    line = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim(); // strip ANSI
    const idx = line.indexOf(': error TS');
    if (idx === -1) continue;
    const pathPart = line.substring(0, idx);
    const msgPart = line.substring(idx + 2);
    const parenIdx = pathPart.lastIndexOf('(');
    if (parenIdx === -1) continue;
    
    const filePathRel = pathPart.substring(0, parenIdx);
    const commaIdx = pathPart.indexOf(',', parenIdx);
    const lineNum = parseInt(pathPart.substring(parenIdx + 1, commaIdx), 10);
    
    const errCodeObj = msgPart.match(/^(error TS\d+):\s+(.*)$/);
    if (!errCodeObj) continue;
    
    const errCode = errCodeObj[1];
    const errMsg = errCodeObj[2];
    
    const filePath = path.resolve(__dirname, filePathRel);

    if (!fileLines[filePath]) fileLines[filePath] = {};
    if (!fileLines[filePath][lineNum]) fileLines[filePath][lineNum] = [];
    fileLines[filePath][lineNum].push({ errCode, errMsg });
}

let modifiedFiles = 0;

for (const filePath of Object.keys(fileLines)) {
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;

    for (const lineStr in fileLines[filePath]) {
        const lineNum = parseInt(lineStr, 10);
        const idx = lineNum - 1;
        let line = lines[idx];
        const errors = fileLines[filePath][lineStr];

        for (const err of errors) {
            const errCode = err.errCode;
            const errMsg = err.errMsg;
            
            if (['error TS2307', 'error TS2305', 'error TS2552', 'error TS2304', 'error TS2339'].includes(errCode)) {
                if (line.toLowerCase().includes('mcp') || line.toLowerCase().includes('telemetry') || errMsg.toLowerCase().includes('mcp')) {
                    if (line.trim().startsWith('import ') && line.includes('}')) {
                        const memberMatch = errMsg.match(/has no exported member '([^']+)'/);
                        if (memberMatch) {
                            const member = memberMatch[1];
                            const regex = new RegExp(`\\b${member}\\b\\s*,?`, 'g');
                            line = line.replace(regex, '');
                            if (/import\s*\{\s*\}\s*from/.test(line)) {
                                line = `// ${line}`;
                            }
                        } else {
                            line = `// ${line}`;
                        }
                    } else if (line.trim().startsWith('import ')) {
                        line = `// ${line}`;
                    } else {
                        line = line.replace(/@\w*Mcp\w*\s+(?:(?:readonly|protected|private)\s+)?\w+\s*:\s*\w*Mcp\w*\s*,?/ig, '/* $& */');
                        line = line.replace(/\b\w*Mcp\w*\s*:\s*\w*Mcp\w*\s*,?/ig, '/* $& */');
                        line = line.replace(/\b\w*\s*:\s*IMcp\w*\s*,?/ig, '/* $& */');
                        line = line.replace(/@IMcp\w*\s+[\w]+\s*:\s*I?Mcp\w+\s*,?/ig, '/* $& */');
                    }
                    modified = true;
                }
            }
            
            if (errCode === 'error TS6133' || errCode === 'error TS6138') {
                const unusedMatch = errMsg.match(/'([^']+)' is declared but its value is never read/);
                if (unusedMatch) {
                    const unusedVar = unusedMatch[1];
                    if (line.trim().startsWith('import ')) {
                        const regex = new RegExp(`\\b${unusedVar}\\b\\s*,?`, 'g');
                        line = line.replace(regex, '');
                        if (/import\s*\{\s*\}\s*from/.test(line)) {
                            line = `// ${line}`;
                        }
                        modified = true;
                    } 
                    else if (line.includes(`${unusedVar}:`)) {
                        const regex = new RegExp(`(\\b(?<!_))${unusedVar}\\b\\s*:`, 'g');
                        if (regex.test(line)) {
                            line = line.replace(regex, `_${unusedVar}:`);
                            modified = true;
                        }
                    }
                }
            }
        }
        lines[idx] = line;
    }

    if (modified) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        modifiedFiles++;
    }
}
console.log(`Modified ${modifiedFiles} files.`);
