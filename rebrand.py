import os
import json
import re

def rebrand():
    root_dir = os.path.abspath(os.path.dirname(__file__))
    
    # 1. Update product.json
    product_path = os.path.join(root_dir, 'product.json')
    if os.path.exists(product_path):
        print(f"Updating {product_path}...")
        with open(product_path, 'r', encoding='utf-8') as f:
            product = json.load(f)
        
        product['nameShort'] = "ProX-Code"
        product['nameLong'] = "ProX-Code"
        product['applicationName'] = "prox-code"
        product['dataFolderName'] = ".prox-code"
        product['win32MutexName'] = "proxcode"
        product['win32DirName'] = "ProXentix ProX-Code"
        product['win32NameVersion'] = "ProXentix ProX-Code"
        product['win32RegValueName'] = "ProXCode"
        product['win32AppUserModelId'] = "ProXentix.ProXCode"
        product['win32ShellNameShort'] = "Pr&oX-Code"
        product['urlProtocol'] = "prox-code"
        product['linuxIconName'] = "prox-code"
        product['darwinBundleIdentifier'] = "com.proxentix.prox-code"
        product['reportIssueUrl'] = "https://github.com/ProXentix/ProX-Code/issues/new" # Example
        
        with open(product_path, 'w', encoding='utf-8') as f:
            json.dump(product, f, indent='\t', ensure_ascii=False)
            f.write('\n')

    # 2. Update package.json
    package_path = os.path.join(root_dir, 'package.json')
    if os.path.exists(package_path):
        print(f"Updating {package_path}...")
        with open(package_path, 'r', encoding='utf-8') as f:
            package = json.load(f)
        
        package['name'] = "prox-code"
        if isinstance(package.get('author'), dict):
            package['author']['name'] = "ProXentix"
        else:
            package['author'] = "ProXentix"
            
        with open(package_path, 'w', encoding='utf-8') as f:
            json.dump(package, f, indent='  ', ensure_ascii=False)
            f.write('\n')

    # 3. Update hardcoded fallbacks in product.ts
    product_ts_path = os.path.join(root_dir, 'src', 'vs', 'platform', 'product', 'common', 'product.ts')
    if os.path.exists(product_ts_path):
        print(f"Updating {product_ts_path}...")
        with open(product_ts_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = re.sub(r"nameShort:\s*'Code - OSS Dev'", "nameShort: 'ProX-Code Dev'", content)
        content = re.sub(r"nameLong:\s*'Code - OSS Dev'", "nameLong: 'ProX-Code Dev'", content)
        content = re.sub(r"applicationName:\s*'code-oss'", "applicationName: 'prox-code'", content)
        content = re.sub(r"dataFolderName:\s*'\.vscode-oss'", "dataFolderName: '.prox-code'", content)
        content = re.sub(r"urlProtocol:\s*'code-oss'", "urlProtocol: 'prox-code'", content)
        
        with open(product_ts_path, 'w', encoding='utf-8') as f:
            f.write(content)

    # 4. Update Scripts and Resources
    targets = [
        ('scripts/code.sh', [
            (r'Code - OSS.exe', 'ProX-Code.exe'),
            (r'vscode.vscode-api-tests', 'prox-code.api-tests')
        ]),
        ('scripts/code.bat', [
            (r'title VSCode Dev', 'title ProX-Code Dev')
        ]),
        ('scripts/code-cli.bat', [
            (r'title VSCode Dev', 'title ProX-Code Dev')
        ]),
        ('resources/win32/VisualElementsManifest.xml', [
            (r'ShortDisplayName="Code - OSS"', 'ShortDisplayName="ProX-Code"')
        ]),
        ('resources/server/manifest.json', [
            (r'"name": "Code - OSS"', '"name": "ProX-Code"'),
            (r'"short_name": "Code- OSS"', '"short_name": "ProX-Code"')
        ]),
        ('resources/linux/code.appdata.xml', [
            (r'Visual Studio Code', 'ProX-Code'),
            (r'Code - OSS', 'ProX-Code')
        ]),
        ('resources/linux/debian/control.template', [
            (r'Visual Studio Code', 'ProX-Code')
        ]),
        ('resources/linux/rpm/code.spec.template', [
            (r'Visual Studio Code', 'ProX-Code')
        ]),
        ('resources/linux/snap/snapcraft.yaml', [
            (r'Visual Studio Code', 'ProX-Code')
        ])
    ]

    for rel_path, replacements in targets:
        full_path = os.path.join(root_dir, rel_path.replace('/', os.sep))
        if os.path.exists(full_path):
            print(f"Updating {full_path}...")
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()
            for pattern, replacement in replacements:
                content = re.sub(pattern, replacement, content)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

    print("\nRebranding complete!")
    print("Next steps:")
    print("1. Replace icons in resources/ directory.")
    print("2. Run 'npm run compile' to verify the build.")

if __name__ == "__main__":
    rebrand()
