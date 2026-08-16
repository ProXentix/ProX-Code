/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IHoverDelegate, IScopedHoverDelegate, IHoverDelegateOptions } from './hoverDelegate.js';
import type { IHoverWidget, IManagedHoverContentOrFactory } from './hover.js';

const nullHoverDelegateFactory = () => ({
	get delay(): number { return -1; },
	dispose: () => { },
	showHover: () => { return undefined; },
});

let hoverDelegateFactory: (placement: 'mouse' | 'element', enableInstantHover: boolean) => IScopedHoverDelegate = nullHoverDelegateFactory;
let defaultHoverDelegateMouse: IHoverDelegate | undefined;
let defaultHoverDelegateElement: IHoverDelegate | undefined;

// TODO: Remove when getDefaultHoverDelegate is no longer used
export function setHoverDelegateFactory(hoverDelegateProvider: ((placement: 'mouse' | 'element', enableInstantHover: boolean) => IScopedHoverDelegate)): void {
	hoverDelegateFactory = hoverDelegateProvider;
	defaultHoverDelegateMouse = undefined;
	defaultHoverDelegateElement = undefined;
}

const defaultHoverDelegateMouseProxy: IHoverDelegate = {
	get delay(): number | ((content: IManagedHoverContentOrFactory) => number) {
		const delegate = (defaultHoverDelegateMouse ??= hoverDelegateFactory('mouse', false));
		return delegate.delay;
	},
	get placement(): 'mouse' {
		return 'mouse';
	},
	showHover(options: IHoverDelegateOptions, focus?: boolean): IHoverWidget | undefined {
		const delegate = (defaultHoverDelegateMouse ??= hoverDelegateFactory('mouse', false));
		return delegate.showHover(options, focus);
	},
	onDidHideHover(): void {
		const delegate = (defaultHoverDelegateMouse ??= hoverDelegateFactory('mouse', false));
		delegate.onDidHideHover?.();
	}
};

const defaultHoverDelegateElementProxy: IHoverDelegate = {
	get delay(): number | ((content: IManagedHoverContentOrFactory) => number) {
		const delegate = (defaultHoverDelegateElement ??= hoverDelegateFactory('element', false));
		return delegate.delay;
	},
	get placement(): 'element' {
		return 'element';
	},
	showHover(options: IHoverDelegateOptions, focus?: boolean): IHoverWidget | undefined {
		const delegate = (defaultHoverDelegateElement ??= hoverDelegateFactory('element', false));
		return delegate.showHover(options, focus);
	},
	onDidHideHover(): void {
		const delegate = (defaultHoverDelegateElement ??= hoverDelegateFactory('element', false));
		delegate.onDidHideHover?.();
	}
};

// TODO: Refine type for use in new IHoverService interface
export function getDefaultHoverDelegate(placement: 'mouse' | 'element'): IHoverDelegate {
	if (placement === 'element') {
		return defaultHoverDelegateElementProxy;
	}
	return defaultHoverDelegateMouseProxy;
}

// TODO: Create equivalent in IHoverService
export function createInstantHoverDelegate(): IScopedHoverDelegate {
	// Creates a hover delegate with instant hover enabled.
	// This hover belongs to the consumer and requires the them to dispose it.
	// Instant hover only makes sense for 'element' placement.
	return hoverDelegateFactory('element', true);
}
