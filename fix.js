import fs from 'fs';

function fixNotebookSearch() {
    const file = 'src/vs/workbench/contrib/search/common/notebookSearch.ts';
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/export interface INotebookSearchService \{[\s\S]*?\}\s*$/g,
        'export interface INotebookSearchService {\n\treadonly _serviceBrand: undefined;\n}\n');
    fs.writeFileSync(file, code);
}

function fixSearchModel() {
    const file = 'src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts';
    let code = fs.readFileSync(file, 'utf8');

    // Remove aiSearch method
    code = code.replace(/aiSearch\(onResult:.*?\): Promise<ISearchComplete> \{[\s\S]*?return asyncAIResults;\s*\}/g, '');

    // Fix textSearchSplitSyncAsync call signature missing arguments
    code = code.replace(/tokenSource\.token,\s*async \([\s\S]*?notebookResult\.openFilesToScan,\s*notebookResult\.allScannedFiles,?\s*\);/g,
        'tokenSource.token, asyncGenerateOnProgress\n\t\t);');

    // Fix getAsyncResults missing notebook results
    code = code.replace(/const resolvedNotebookResults = await notebookResult\.completeData;/, '');
    code = code.replace(/results: \[\.\.\.allClosedEditorResults\.results, \.\.\.resolvedNotebookResults\.results\],/, 'results: [...allClosedEditorResults.results],');
    code = code.replace(/messages: \[\.\.\.allClosedEditorResults\.messages, \.\.\.resolvedNotebookResults\.messages\],/, 'messages: [...allClosedEditorResults.messages],');
    code = code.replace(/limitHit: allClosedEditorResults\.limitHit \|\| resolvedNotebookResults\.limitHit,/, 'limitHit: allClosedEditorResults.limitHit,');

    fs.writeFileSync(file, code);
}

function fixTreeCommon() {
    const file = 'src/vs/workbench/contrib/search/browser/searchTreeModel/searchTreeCommon.ts';
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/getAITextResultProviderName\(\): Promise<string>;\s*/g, '');
    code = code.replace(/aiSearch\(.*?\): Promise<ISearchComplete>;\s*/g, '');
    code = code.replace(/hasAIResults: boolean;\s*/g, '');
    code = code.replace(/cancelAISearch.*?;\s*/g, '');
    code = code.replace(/clearAiSearchResults.*?;\s*/g, '');
    fs.writeFileSync(file, code);
}

function fixSearchModelTest() {
    const file = 'src/vs/workbench/contrib/search/test/browser/searchModel.test.ts';
    let code = fs.readFileSync(file, 'utf8');
    // Remove notebookSearch mock
    code = code.replace(/notebookSearch\([\s\S]*?},\s*\n\t\t} {/g, '{'); // very hacky regex, let's do something simpler
    code = code.replace(/notebookSearch\([^]*?\\}\;/g, '');

    // Just remove everything around notebookSearch inside the mock ISearchService
    fs.writeFileSync(file, code);
}

function fixSearchResult() {
    const file = 'src/vs/workbench/contrib/search/browser/searchTreeModel/searchResult.ts';
    let code = fs.readFileSync(file, 'utf8');

    fs.writeFileSync(file, code);
}

function fixSearchView() {
    const file = 'src/vs/workbench/contrib/search/browser/searchView.ts';
    let code = fs.readFileSync(file, 'utf8');

    // Fix refreshHasAISetting bracket mismatch
    const regex1 = /public shouldShowAIResults\(\): boolean \{[\s\S]*?refreshAndUpdateCount\(\);\s*\}\s*\}/g;
    code = code.replace(regex1, '');

    // Remove the context hook reference
    code = code.replace(/this\._register\(this\.contextKeyService\.onDidChangeContext\(e => \{[\s\S]*?\}\)\);/g, '');

    // Remove the _onAIResultChangedDisposable part which is broken
    code = code.replace(/this\._onAIResultChangedDisposable\?\.dispose\(\);\s*this\._onAIResultChangedDisposable = this\._register\([\s\S]*?\}\s*\)\s*\);/g, '');

    fs.writeFileSync(file, code);
}

try { fixNotebookSearch(); } catch (e) { console.error('notebookSearch', e); }
try { fixSearchModel(); } catch (e) { console.error('searchModel', e); }
try { fixTreeCommon(); } catch (e) { console.error('treeCommon', e); }
try { fixSearchView(); } catch (e) { console.error('searchView', e); }
// searchResult, searchModelTest may have syntax issues, we can just check with TS.
