const fs = require('fs');
const path = require('path');

const fontPath = 'src/vs/base/browser/ui/codicons/codicon/codicon.ttf';
const cssPath = 'src/vs/base/browser/ui/codicons/codicon/codicon.css';

const fontBuffer = fs.readFileSync(fontPath);
const base64Font = fontBuffer.toString('base64');

const cssContent = `/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

@font-face {
	font-family: "codicon";
	font-display: block;
	src: url("data:font/truetype;charset=utf-8;base64,${base64Font}") format("truetype"),
	     url("./codicon.ttf?5d4d76ab2ce5108968ad644d591a16a6") format("truetype");
}

.codicon[class*='codicon-'] {
	font: normal normal normal 16px/1 codicon;
	display: inline-block;
	text-decoration: none;
	text-rendering: auto;
	text-align: center;
	text-transform: none;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	user-select: none;
	-webkit-user-select: none;
}

/* icon rules are dynamically created by the platform theme service (see iconsStyleSheet.ts) */
`;

fs.writeFileSync(cssPath, cssContent, 'utf8');
console.log('Successfully embedded base64 font in codicon.css!');
