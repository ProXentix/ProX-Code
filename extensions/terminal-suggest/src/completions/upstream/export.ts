/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const completionSpec: Fig.Spec = {
	name: "export",
	description: "Export variables",
	hidden: true,
	args: {
		isVariadic: true,
	},
};

export default completionSpec;
