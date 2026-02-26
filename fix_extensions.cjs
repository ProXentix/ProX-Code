const fs = require('fs');
const path = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix closing brace indentation
content = content.replace(/\tthis\.registerContextMenuActions\(\);\r?\n\t\t\t\}/, '\tthis.registerContextMenuActions();\n\t}');

// Remove gallery sign in action at bottom
content = content.replace(/registerAction2\(class ExtensionsGallerySignInAction.*?\n\}\);/s, '');

// Also remove some unused imports at top (e.g. ones that was previously for the sign-in action)
// I'll leave them alone for now to avoid breaking anything else unless they are clearly causing trouble.

fs.writeFileSync(path, content);
console.log('Fixed extension contribution file.');
