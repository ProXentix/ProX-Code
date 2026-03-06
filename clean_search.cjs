const fs = require('fs');
const path = require('path');

function removeNotebooks(file) {
    let content = fs.readFileSync(file, 'utf8');
    let mod = false;

    // Replace lines with notebook
    const lines = content.split('\r\n').join('\n').split('\n');
    const newLines = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (
            l.includes('notebookSearch') ||
            l.includes('notebookEditorService') ||
            l.includes('notebookCommon') ||
            l.includes('notebookBrowser') ||
            l.includes('searchNotebookHelpers') ||
            (l.includes('import ') && l.includes('notebook'))
        ) {
            mod = true;
        } else {
            newLines.push(l);
        }
    }

    if (mod) {
        fs.writeFileSync(file, newLines.join('\r\n'));
        console.log('Cleaned ' + file);
    }
}

function processDir(dir) {
    const list = fs.readdirSync(dir);
    for (let i = 0; i < list.length; i++) {
        const full = path.join(dir, list[i]);
        if (fs.statSync(full).isDirectory()) processDir(full);
        else if (full.endsWith('.ts')) removeNotebooks(full);
    }
}
processDir('c:/Users/INTEX/Desktop/Kanishk Raj/Coding/ProX-Code/src/vs/workbench/contrib/search');
