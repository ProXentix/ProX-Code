# ProX-Code

ProX-Code is a high-performance, professional-grade code editor built for efficiency and deep customization. Developed by ProXentix, it leverages the core of modern editor technology while providing a specialized, proprietary environment for advanced developers.

## Key Features

- **ProXplore**: A revolutionary file exploration experience integrated directly into your workflow.
- **PRM (ProX Resource Manager)**: Powerful resource management and package control at your fingertips.
- **Browser-integrated UI**: Tabs, navigation, and web integration for a seamless development experience.
- **Optimized Performance**: Expertly tuned for speed and stability on Windows, Linux, and macOS.
- **Rich Extensibility**: Support for a vast ecosystem of tools and languages.

## Getting Started

### Setup

Clone the repository to your local machine:

```bash
git clone https://github.com/ProXentix/ProX-Code.git
cd ProX-Code
```

Install dependencies:

```bash
npm install
```

### Development

To start the development server and watch for changes:

```bash
npm run watch
```

To compile the project:

```bash
npm run compile
```

To run the application locally (Electron):

```bash
npm run electron
```

## Build and Package

ProX-Code uses Gulp for its build pipeline. To create a production-ready build for Windows:

```bash
npm run gulp vscode-win32-x64-min
```

For other platforms and advanced build options, refer to the `gulpfile.ts` in the `build` directory.

## Internal Links

- [Documentation](resources/docs)
- [Product Configuration](product.json)
- [Build Scripts](build/)

## Contact

For support or internal inquiries, please visit [proxpl.in](https://proxpl.in) or contact the development team directly.

---

Copyright (c) ProXentix. All rights reserved.
