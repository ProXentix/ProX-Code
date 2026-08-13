const chokidar = require('chokidar');
const path = require('path');

const root = process.argv[2];
if (!root) {
    console.error('Usage: node watcher.js <root>');
    process.exit(1);
}

const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    cwd: root,
});

watcher.on('all', (event, filePath) => {
    let type = '';
    if (event === 'add' || event === 'addDir') {
        type = '1';
    } else if (event === 'change') {
        type = '0';
    } else if (event === 'unlink' || event === 'unlinkDir') {
        type = '2';
    } else {
        return;
    }
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
    console.log(`${type} ${absolutePath}`);
});
