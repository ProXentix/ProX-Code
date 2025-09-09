# Visual Studio Code - Open Source ("Code - OSS")

[![Feature Requests](https://img.shields.io/github/issues/microsoft/ProX-Code/feature-request.svg)](https://github.com/microsoft/ProX-Code/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/microsoft/ProX-Code/bug.svg)](https://github.com/microsoft/ProX-Code/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-yellow.svg)](https://gitter.im/Microsoft/ProX-Code)

## The Repository

This repository ("`Code - OSS`") is where we (Microsoft) develop the [Visual Studio Code](https://code.visualstudio.com) product together with the community. Not only do we work on code and issues here, we also publish our [roadmap](https://github.com/microsoft/ProX-Code/wiki/Roadmap), [monthly iteration plans](https://github.com/microsoft/ProX-Code/wiki/Iteration-Plans), and our [endgame plans](https://github.com/microsoft/ProX-Code/wiki/Running-the-Endgame). This source code is available to everyone under the standard [MIT license](https://github.com/microsoft/ProX-Code/blob/main/LICENSE.txt).

## Visual Studio Code

<p align="center">
  <img alt="VS Code in action" src="https://user-images.githubusercontent.com/35271042/118224532-3842c400-b438-11eb-923d-a5f66fa6785a.png">
</p>

[Visual Studio Code](https://code.visualstudio.com) is a distribution of the `Code - OSS` repository with Microsoft-specific customizations released under a traditional [Microsoft product license](https://code.visualstudio.com/License/).

[Visual Studio Code](https://code.visualstudio.com) combines the simplicity of a code editor with what developers need for their core edit-build-debug cycle. It provides comprehensive code editing, navigation, and understanding support along with lightweight debugging, a rich extensibility model, and lightweight integration with existing tools.

Visual Studio Code is updated monthly with new features and bug fixes. You can download it for Windows, macOS, and Linux on [Visual Studio Code's website](https://code.visualstudio.com/Download). To get the latest releases every day, install the [Insiders build](https://code.visualstudio.com/insiders).

## Contributing

There are many ways in which you can participate in this project, for example:

* [Submit bugs and feature requests](https://github.com/microsoft/ProX-Code/issues), and help us verify as they are checked in
* Review [source code changes](https://github.com/microsoft/ProX-Code/pulls)
* Review the [documentation](https://github.com/microsoft/ProX-Code-docs) and make pull requests for anything from typos to additional and new content

If you are interested in fixing issues and contributing directly to the code base,
please see the document [How to Contribute](https://github.com/microsoft/ProX-Code/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/microsoft/ProX-Code/wiki/How-to-Contribute)
* [The development workflow, including debugging and running tests](https://github.com/microsoft/ProX-Code/wiki/How-to-Contribute#debugging)
* [Coding guidelines](https://github.com/microsoft/ProX-Code/wiki/Coding-Guidelines)
* [Submitting pull requests](https://github.com/microsoft/ProX-Code/wiki/How-to-Contribute#pull-requests)
* [Finding an issue to work on](https://github.com/microsoft/ProX-Code/wiki/How-to-Contribute#where-to-contribute)
* [Contributing to translations](https://aka.ms/ProX-Codeloc)

## Feedback

* Ask a question on [Stack Overflow](https://stackoverflow.com/questions/tagged/ProX-Code)
* [Request a new feature](CONTRIBUTING.md)
* Upvote [popular feature requests](https://github.com/microsoft/ProX-Code/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
* [File an issue](https://github.com/microsoft/ProX-Code/issues)
* Connect with the extension author community on [GitHub Discussions](https://github.com/microsoft/ProX-Code-discussions/discussions) or [Slack](https://aka.ms/ProX-Code-dev-community)
* Follow [@code](https://twitter.com/code) and let us know what you think!

See our [wiki](https://github.com/microsoft/ProX-Code/wiki/Feedback-Channels) for a description of each of these channels and information on some other available community-driven channels.

## Related Projects

Many of the core components and extensions to VS Code live in their own repositories on GitHub. For example, the [node debug adapter](https://github.com/microsoft/ProX-Code-node-debug) and the [mono debug adapter](https://github.com/microsoft/ProX-Code-mono-debug) repositories are separate from each other. For a complete list, please visit the [Related Projects](https://github.com/microsoft/ProX-Code/wiki/Related-Projects) page on our [wiki](https://github.com/microsoft/ProX-Code/wiki).

## Bundled Extensions

VS Code includes a set of built-in extensions located in the [extensions](extensions) folder, including grammars and snippets for many languages. Extensions that provide rich language support (code completion, Go to Definition) for a language have the suffix `language-features`. For example, the `json` extension provides coloring for `JSON` and the `json-language-features` extension provides rich language support for `JSON`.

## Development Container

This repository includes a Visual Studio Code Dev Containers / GitHub Codespaces development container.

* For [Dev Containers](https://aka.ms/ProX-Code-remote/download/containers), use the **Dev Containers: Clone Repository in Container Volume...** command which creates a Docker volume for better disk I/O on macOS and Windows.
  * If you already have VS Code and Docker installed, you can also click [here](https://ProX-Code.dev/redirect?url=ProX-Code://ms-ProX-Code-remote.remote-containers/cloneInVolume?url=https://github.com/microsoft/ProX-Code) to get started. This will cause VS Code to automatically install the Dev Containers extension if needed, clone the source code into a container volume, and spin up a dev container for use.

* For Codespaces, install the [GitHub Codespaces](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces) extension in VS Code, and use the **Codespaces: Create New Codespace** command.

Docker / the Codespace should have at least **4 Cores and 6 GB of RAM (8 GB recommended)** to run full build. See the [development container README](.devcontainer/README.md) for more information.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [MIT](LICENSE.txt) license.
