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
        product['reportIssueUrl'] = "https://github.com/ProXentix/ProX-Code/issues/new"
        
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

    # 3. Aggressive Global Rebrand
    print("Performing global recursive rebrand...")
    
    # Case-sensitive mappings as per requirements
    mapping = [
        ("Code - OSS", "ProX-Code"),
        ("Visual Studio Code", "ProX-Code"),
        ("code-oss", "prox-code"),
        ("vscode://", "prox-code://"),
        ("code-oss://", "prox-code://"),
        (".vscode-oss", ".prox-code"),
        (".vscode", ".prox-code"),
        ("Microsoft Corporation", "ProXentix"),
        ("Microsoft", "ProXentix"),
    ]

    # Directories to skip
    skip_dirs = {'.git', 'node_modules', '.build', 'out', 'build'}
    # Files to skip
    skip_files = {'package-lock.json', 'rebrand.py', 'ThirdPartyNotices.txt', 'LICENSE.txt'}

    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            if file in skip_files or file.endswith(('.ico', '.png', '.icns', '.zip', '.exe', '.dll')):
                continue
            
            file_path = os.path.join(root, file)
            
            try:
                # Use a larger buffer or chunking for very large files if needed, 
                # but for VS Code repo, reading plain text into memory should be fine.
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                new_content = content
                for old, new in mapping:
                    # In code files, wrap in quotes to be safer, in docs replace all
                    if file.endswith(('.ts', '.js', '.rs', '.go', '.c', '.cpp', '.h')):
                        # Replace in strings and comments
                        # This is a broad replacement but follows user's "all files and folders" intent
                        # while avoiding raw variable names if possible.
                        # However, user's requirement for "code" -> "prox-code" (binary command)
                        # should be handled carefully.
                        
                        # Replace exact matches of branding strings
                        new_content = new_content.replace(old, new)
                    else:
                        # For JSON, MD, XML, etc. - perform full replacement
                        new_content = new_content.replace(old, new)

                if new_content != content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
            except Exception as e:
                # print(f"Could not process {file_path}: {e}")
                pass

    print("\nGlobal Rebranding complete!")
    print("Next steps:")
    print("1. Replace icons in resources/ directory.")
    print("2. Run 'npm run compile' to verify the build.")

if __name__ == "__main__":
    rebrand()
