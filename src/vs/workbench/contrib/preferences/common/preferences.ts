/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { raceTimeout } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
Object.keys(productService.extensionRecommendations).forEach(extensionId => {
	const extensionInfo = productService.extensionRecommendations![extensionId];
	if (extensionInfo.onSettingsEditorOpen) {
		settingsEditorRecommendedExtensions[extensionId] = extensionInfo;
	}
});

const recommendedExtensionsGalleryInfo: IStringDictionary<IGalleryExtension> = {};
for (const key in settingsEditorRecommendedExtensions) {
	const extensionId = key;
	// Recommend prerelease if not on Stable.
	const isStable = productService.quality === 'stable';
	try {
		const extensions = await raceTimeout(
			extensionGalleryService.getExtensions([{ id: extensionId, preRelease: !isStable }], CancellationToken.None),
			EXTENSION_FETCH_TIMEOUT_MS);
		if (extensions?.length === 1) {
			recommendedExtensionsGalleryInfo[key] = extensions[0];
		} else {
			// same as network connection fail. we do not want a blank settings page: https://github.com/ProXentix/ProX-Code/issues/195722
			// so instead of returning partial data we return undefined here
			return undefined;
		}
	} catch (e) {
		// Network connection fail. Return nothing rather than partial data.
		return undefined;
	}
}

cachedExtensionToggleData = {
	settingsEditorRecommendedExtensions,
	recommendedExtensionsGalleryInfo,
	commonlyUsed: productService.commonlyUsedSettings
};
return cachedExtensionToggleData;
	}
return undefined;
}

/**
 * Compares two nullable numbers such that null values always come after defined ones.
 */
export function compareTwoNullableNumbers(a: number | undefined, b: number | undefined): number {
	const aOrMax = a ?? Number.MAX_SAFE_INTEGER;
	const bOrMax = b ?? Number.MAX_SAFE_INTEGER;
	if (aOrMax < bOrMax) {
		return -1;
	} else if (aOrMax > bOrMax) {
		return 1;
	} else {
		return 0;
	}
}

export const PREVIEW_INDICATOR_DESCRIPTION = localize('previewIndicatorDescription', "Preview setting: this setting controls a new feature that is still under refinement yet ready to use. Feedback is welcome.");
export const EXPERIMENTAL_INDICATOR_DESCRIPTION = localize('experimentalIndicatorDescription', "Experimental setting: this setting controls a new feature that is actively being developed and may be unstable. It is subject to change or removal.");
export const ADVANCED_INDICATOR_DESCRIPTION = localize('advancedIndicatorDescription', "Advanced setting: this setting is intended for advanced scenarios and configurations. Only modify this if you know what it does.");

export const knownAcronyms = new Set<string>();
[
	'css',
	'html',
	'scss',
	'less',
	'json',
	'js',
	'ts',
	'ie',
	'id',
	'php',
	'scm',
].forEach(str => knownAcronyms.add(str));

export const knownTermMappings = new Map<string, string>();
knownTermMappings.set('power shell', 'PowerShell');
knownTermMappings.set('powershell', 'PowerShell');
knownTermMappings.set('javascript', 'JavaScript');
knownTermMappings.set('typescript', 'TypeScript');
knownTermMappings.set('github', 'GitHub');
knownTermMappings.set('jet brains', 'JetBrains');
knownTermMappings.set('jetbrains', 'JetBrains');
knownTermMappings.set('re sharper', 'ReSharper');
knownTermMappings.set('resharper', 'ReSharper');

export function wordifyKey(key: string): string {
	key = key
		.replace(/\.([a-z0-9])/g, (_, p1) => ` \u203A ${p1.toUpperCase()}`) // Replace dot with spaced '>'
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2') // Camel case to spacing, fooBar => foo Bar
		.replace(/([A-Z]{1,})([A-Z][a-z])/g, '$1 $2') // Split consecutive capitals letters, AISearch => AI Search
		.replace(/^[a-z]/g, match => match.toUpperCase()) // Upper casing all first letters, foo => Foo
		.replace(/\b\w+\b/g, match => { // Upper casing known acronyms
			return knownAcronyms.has(match.toLowerCase()) ?
				match.toUpperCase() :
				match;
		});

	for (const [k, v] of knownTermMappings) {
		key = key.replace(new RegExp(`\\b${k}\\b`, 'gi'), v);
	}

	return key;
}
