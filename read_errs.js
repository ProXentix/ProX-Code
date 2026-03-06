import fs from 'fs';

const txt = fs.readFileSync('compile_errors3.txt', 'utf16le');
if (!txt) {
    console.log("No text read.");
} else {
    const lines = txt.split('\n');
    console.log("Total lines:", lines.length);
    const errors = lines.filter(line => line.includes('error TS'));
    const files = {};
    for (const err of errors) {
        const parts = err.split('(');
        let f = "";
        if (parts.length > 1) {
            f = parts[0];
        } else {
            f = err.split(':')[0];
        }
        files[f] = (files[f] || 0) + 1;
    }
    console.log(files);
}
