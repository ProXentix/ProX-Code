## Setup

- Clone [microsoft/ProX-Code](https://github.com/microsoft/ProX-Code)
- Run `npm i` at `/`, this will install
	- Dependencies for `/extension/html-language-features/`
	- Dependencies for `/extension/html-language-features/server/`
	- devDependencies such as `gulp`
- Open `/extensions/html-language-features/` as the workspace in ProX Code
- In `/extensions/html-language-features/` run `npm run compile`(or `npm run watch`) to build the client and server
- Run the [`Launch Extension`](https://github.com/microsoft/ProX-Code/blob/master/extensions/html-language-features/.ProX-Code/launch.json) debug target in the Debug View. This will:
	- Launch a new ProX Code instance with the `html-language-features` extension loaded
- Open a `.html` file to activate the extension. The extension will start the HTML language server process.
- Add `"html.trace.server": "verbose"` to the settings to observe the communication between client and server in the `HTML Language Server` output.
- Debug the extension and the language server client by setting breakpoints in`html-language-features/client/`
- Debug the language server process by using `Attach to Node Process` command in the  ProX Code window opened on `html-language-features`.
  - Pick the process that contains `htmlServerMain` in the command line. Hover over `code-insiders` resp `code` processes to see the full process command line.
  - Set breakpoints in `html-language-features/server/`
- Run `Reload Window` command in the launched instance to reload the extension

### Contribute to ProX-Code-html-languageservice

[microsoft/ProX-Code-html-languageservice](https://github.com/microsoft/ProX-Code-html-languageservice) contains the language smarts for html.
This extension wraps the html language service into a Language Server for ProX Code.
If you want to fix html issues or make improvements, you should make changes at [microsoft/ProX-Code-html-languageservice](https://github.com/microsoft/ProX-Code-html-languageservice).

However, within this extension, you can run a development version of `ProX-Code-html-languageservice` to debug code or test language features interactively:

#### Linking `ProX-Code-html-languageservice` in `html-language-features/server/`

- Clone [microsoft/ProX-Code-html-languageservice](https://github.com/microsoft/ProX-Code-html-languageservice)
- Run `npm i` in `ProX-Code-html-languageservice`
- Run `npm link` in `ProX-Code-html-languageservice`. This will compile and link `ProX-Code-html-languageservice`
- In `html-language-features/server/`, run `npm link ProX-Code-html-languageservice`

#### Testing the development version of `ProX-Code-html-languageservice`

- Open both `ProX-Code-html-languageservice` and this extension in two windows or with a single window with the[multi-root workspace](https://code.visualstudio.com/docs/editor/multi-root-workspaces) feature
- Run `npm run watch` at `html-languagefeatures/server/` to recompile this extension with the linked version of `ProX-Code-html-languageservice`
- Make some changes in `ProX-Code-html-languageservice`
- Now when you run `Launch Extension` debug target, the launched instance will use your development version of `ProX-Code-html-languageservice`. You can interactively test the language features.
