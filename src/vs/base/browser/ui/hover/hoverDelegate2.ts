/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../common/lifecycle.js';
import type { IHoverDelegate2, IHoverLifecycleOptions, IHoverOptions, IHoverWidget, IManagedHover, IManagedHoverContentOrFactory, IManagedHoverOptions } from './hover.js';
import type { IHoverDelegate } from './hoverDelegate.js';

let baseHoverDelegate: IHoverDelegate2 | undefined;

/**
 * Sets the hover delegate for use **only in the `base/` layer**.
 */
export function setBaseLayerHoverDelegate(hoverDelegate: IHoverDelegate2): void {
	baseHoverDelegate = hoverDelegate;
}

const baseLayerHoverDelegateProxy: IHoverDelegate2 = {
	showInstantHover: (options: IHoverOptions, focus?: boolean): IHoverWidget | undefined => {
		return baseHoverDelegate?.showInstantHover(options, focus);
	},
	showDelayedHover: (options: IHoverOptions, lifecycleOptions: Pick<IHoverLifecycleOptions, 'groupId'>): IHoverWidget | undefined => {
		return baseHoverDelegate?.showDelayedHover(options, lifecycleOptions);
	},
	setupDelayedHover: (target: HTMLElement, options: (() => Omit<IHoverOptions, 'target'>) | Omit<IHoverOptions, 'target'>, lifecycleOptions?: IHoverLifecycleOptions): IDisposable => {
		return baseHoverDelegate ? baseHoverDelegate.setupDelayedHover(target, options, lifecycleOptions) : Disposable.None;
	},
	setupDelayedHoverAtMouse: (target: HTMLElement, options: (() => Omit<IHoverOptions, 'target' | 'position'>) | Omit<IHoverOptions, 'target' | 'position'>, lifecycleOptions?: IHoverLifecycleOptions): IDisposable => {
		return baseHoverDelegate ? baseHoverDelegate.setupDelayedHoverAtMouse(target, options, lifecycleOptions) : Disposable.None;
	},
	hideHover: (force?: boolean): void => {
		baseHoverDelegate?.hideHover(force);
	},
	showAndFocusLastHover: (): void => {
		baseHoverDelegate?.showAndFocusLastHover();
	},
	setupManagedHover: (hoverDelegate: IHoverDelegate, targetElement: HTMLElement, content: IManagedHoverContentOrFactory, options?: IManagedHoverOptions): IManagedHover => {
		if (baseHoverDelegate) {
			return baseHoverDelegate.setupManagedHover(hoverDelegate, targetElement, content, options);
		}
		let currentHover: IManagedHover | undefined;
		let isDisposed = false;
		let currentContent = content;
		let currentOptions = options;

		const checkAndInit = () => {
			if (!currentHover && baseHoverDelegate && !isDisposed) {
				currentHover = baseHoverDelegate.setupManagedHover(hoverDelegate, targetElement, currentContent, currentOptions);
			}
			return currentHover;
		};

		return {
			show: (focus) => {
				checkAndInit()?.show(focus);
			},
			hide: () => {
				currentHover?.hide();
			},
			update: async (newContent, hoverOptions) => {
				currentContent = newContent;
				currentOptions = hoverOptions;
				if (currentHover) {
					await currentHover.update(newContent, hoverOptions);
				} else {
					checkAndInit();
				}
			},
			dispose: () => {
				isDisposed = true;
				currentHover?.dispose();
				currentHover = undefined;
			}
		};
	},
	showManagedHover: (target: HTMLElement): void => {
		baseHoverDelegate?.showManagedHover(target);
	}
};

/**
 * Gets the hover delegate for use **only in the `base/` layer**.
 *
 * Since the hover service depends on various platform services, this delegate essentially bypasses
 * the standard dependency injection mechanism by injecting a global hover service at start up. The
 * only reason this should be used is if `IHoverService` is not available.
 */
export function getBaseLayerHoverDelegate(): IHoverDelegate2 {
	return baseLayerHoverDelegateProxy;
}
