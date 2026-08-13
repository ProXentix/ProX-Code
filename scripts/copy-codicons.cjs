const fs = require('fs');
const path = require('path');

const srcFont = 'src/vs/base/browser/ui/codicons/codicon/codicon.ttf';

const targets = [
  'out/vs/base/browser/ui/codicons/codicon/codicon.ttf',
  'out/vs/workbench/codicon.ttf',
  'out/vs/code/electron-browser/workbench/codicon.ttf',
  'out/vs/workbench/browser/media/codicon.ttf',
  'src/vs/workbench/codicon.ttf',
  'src/vs/code/electron-browser/workbench/codicon.ttf'
];

targets.forEach(target => {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(srcFont, target);
  console.log('Copied codicon.ttf to:', target);
});
