/*---------------------------------------------------------------------------------------------
 *  Copyright (c) ProXentix. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const completionSpec: Fig.Spec = {
	name: "dirname",
	description: "Return directory portion of pathname",
	args: {
		name: "string",
		description: "String to operate on (typically filenames)",
		isVariadic: true,
		template: "filepaths",
	},
};
export default completionSpec;
