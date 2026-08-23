import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';

MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: MenuId.MenubarCodeMenu,
	title: {
		value: 'Code',
		original: 'Code',
		mnemonicTitle: localize({ key: 'mCode', comment: ['&& denotes a mnemonic'] }, "&&Code")
	},
	order: 5
});

// Code Menu items
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.revealDefinition', title: localize('miGoToDefinition', "Go to Definition") },
	group: '1_code',
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'workbench.action.gotoSymbol', title: localize('miGoToSymbol', "Go to Symbol...") },
	group: '1_code',
	order: 2,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.referenceSearch.trigger', title: localize('miFindAllReferences', "Find All References") },
	group: '1_code',
	order: 3,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.rename', title: localize('miRenameSymbol', "Rename Symbol") },
	group: '1_code',
	order: 4,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	submenu: MenuId.MenubarCodeRefactorSubmenu,
	title: localize('miRefactor', "Refactor"),
	group: '1_code',
	order: 5,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.quickFix', title: localize('miQuickFix', "Quick Fix...") },
	group: '1_code',
	order: 6,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.formatDocument', title: localize('miFormatDocument', "Format Document") },
	group: '1_code',
	order: 7,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	command: { id: 'editor.action.organizeImports', title: localize('miOrganizeImports', "Organize Imports") },
	group: '1_code',
	order: 8,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	submenu: MenuId.MenubarCodeSourceActionSubmenu,
	title: localize('miSourceAction', "Source Action"),
	group: '1_code',
	order: 9,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	submenu: MenuId.MenubarCodeFoldingSubmenu,
	title: localize('miFolding', "Folding"),
	group: '2_extra',
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	submenu: MenuId.MenubarCodeCommentsSubmenu,
	title: localize('miComments', "Comments"),
	group: '2_extra',
	order: 2,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeMenu, {
	submenu: MenuId.MenubarCodeProXPLSubmenu,
	title: localize('miProXPL', "ProXPL"),
	group: '2_extra',
	order: 3,
});

// Refactor Submenu
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor', title: localize('miRefactorMenu', "Refactor") },
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.rename', title: localize('miRenameSymbolRefactor', "Rename Symbol") },
	order: 2,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor.extract.function', title: localize('miExtractFunction', "Extract Function") },
	order: 3,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor.extract.variable', title: localize('miExtractVariable', "Extract Variable") },
	order: 4,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor.inline.variable', title: localize('miInlineVariable', "Inline Variable") },
	order: 5,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor.move', title: localize('miMoveSymbol', "Move Symbol") },
	order: 6,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeRefactorSubmenu, {
	command: { id: 'editor.action.refactor.convert', title: localize('miConvertExpression', "Convert Expression") },
	order: 7,
});

// ProXPL Submenu
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.format', title: localize('miFormatProXPL', "Format ProXPL") },
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.checkSyntax', title: localize('miCheckSyntax', "Check Syntax") },
	order: 2,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.analyzeCode', title: localize('miAnalyzeCode', "Analyze Code") },
	order: 3,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.compile', title: localize('miCompileCurrentFile', "Compile Current File") },
	order: 4,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.generateBytecode', title: localize('miGenerateBytecode', "Generate Bytecode") },
	order: 5,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.inspectAST', title: localize('miInspectAST', "Inspect AST") },
	order: 6,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.inspectBytecode', title: localize('miInspectBytecode', "Inspect Bytecode") },
	order: 7,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.generateDocs', title: localize('miGenerateDocumentation', "Generate Documentation") },
	order: 8,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeProXPLSubmenu, {
	command: { id: 'proxpl.lsStatus', title: localize('miLanguageServerStatus', "Language Server Status") },
	order: 9,
});

// Source Action Submenu
MenuRegistry.appendMenuItem(MenuId.MenubarCodeSourceActionSubmenu, {
	command: { id: 'editor.action.sourceAction', title: localize('miSourceActionMenu', "Source Action...") },
	order: 1,
});

// Folding Submenu
MenuRegistry.appendMenuItem(MenuId.MenubarCodeFoldingSubmenu, {
	command: { id: 'editor.foldAll', title: localize('miFoldAll', "Fold All") },
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeFoldingSubmenu, {
	command: { id: 'editor.unfoldAll', title: localize('miUnfoldAll', "Unfold All") },
	order: 2,
});

// Comments Submenu
MenuRegistry.appendMenuItem(MenuId.MenubarCodeCommentsSubmenu, {
	command: { id: 'editor.action.commentLine', title: localize('miToggleLineComment', "Toggle Line Comment") },
	order: 1,
});
MenuRegistry.appendMenuItem(MenuId.MenubarCodeCommentsSubmenu, {
	command: { id: 'editor.action.blockComment', title: localize('miToggleBlockComment', "Toggle Block Comment") },
	order: 2,
});
