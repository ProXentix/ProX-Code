## Setup

- Clone [microsoft/ProX-Code](https://github.com/microsoft/ProX-Code)
- Run `npm i` at `/`, this will install
	- Dependencies for `/extension/json-language-features/`
	- Dependencies for `/extension/json-language-features/server/`
	- devDependencies such as `gulp`
- Open `/extensions/json-language-features/` as the workspace in ProX Code
- In `/extensions/json-language-features/` run `npm run compile`(or `npm run watch`) to build the client and server
- Run the [`Launch Extension`](https://github.com/microsoft/ProX-Code/blob/master/extensions/json-language-features/.ProX-Code/launch.json) debug target in the Debug View. This will:
	- Launch a new ProX Code instance with the `json-language-features` extension loaded
- Open a `.json` file to activate the extension. The extension will start the JSON language server process.
- Add `"json.trace.server": "verbose"` to the settings to observe the communication between client and server in the `JSON Language Server` output.
- Debug the extension and the language server client by setting breakpoints in`json-language-features/client/`
- Debug the language server process by using `Attach to Node Process` command in the  ProX Code window opened on `json-language-features`.
  - Pick the process that contains `jsonServerMain` in the command line. Hover over `code-insiders` resp `code` processes to see the full process command line.
  - Set breakpoints in `json-language-features/server/`
- Run `Reload Window` command in the launched instance to reload the extension


### Contribute to ProX-Code-json-languageservice

[microsoft/ProX-Code-json-languageservice](https://github.com/microsoft/ProX-Code-json-languageservice) is the library that implements the language smarts for JSON.
The JSON language server forwards most the of requests to the service library.
If you want to fix JSON issues or make improvements, you should make changes at [microsoft/ProX-Code-json-languageservice](https://github.com/microsoft/ProX-Code-json-languageservice).

However, within this extension, you can run a development version of `ProX-Code-json-languageservice` to debug code or test language features interactively:

#### Linking `ProX-Code-json-languageservice` in `json-language-features/server/`

- Clone [microsoft/ProX-Code-json-languageservice](https://github.com/microsoft/ProX-Code-json-languageservice)
- Run `npm i` in `ProX-Code-json-languageservice`
- Run `npm link` in `ProX-Code-json-languageservice`. This will compile and link `ProX-Code-json-languageservice`
- In `json-language-features/server/`, run `npm link ProX-Code-json-languageservice`

#### Testing the development version of `ProX-Code-json-languageservice`

- Open both `ProX-Code-json-languageservice` and this extension in two windows or with a single window with the[multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) feature.
- Run `npm run watch` at `json-languagefeatures/server/` to recompile this extension with the linked version of `ProX-Code-json-languageservice`
- Make some changes in `ProX-Code-json-languageservice`
- Now when you run `Launch Extension` debug target, the launched instance will use your development version of `ProX-Code-json-languageservice`. You can interactively test the language features.
