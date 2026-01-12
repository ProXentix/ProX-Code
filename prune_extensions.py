import os
import shutil

def prune_extensions():
    root_dir = os.path.abspath(os.path.dirname(__file__))
    extensions_dir = os.path.join(root_dir, 'extensions')
    
    if not os.path.exists(extensions_dir):
        print("Extensions directory not found!")
        return

    # Extensions to REMOVE
    to_remove = [
        # Tests and Tools
        'vscode-api-tests',
        'vscode-colorize-perf-tests',
        'vscode-colorize-tests',
        'vscode-test-resolver',
        'types',
        
        # Branding / Service Specific (Microsoft/GitHub)
        'microsoft-authentication',
        'github',
        'github-authentication',
        
        # Auxiliary Themes (Keep defaults and seti)
        'theme-abyss',
        'theme-kimbie-dark',
        'theme-monokai',
        'theme-monokai-dimmed',
        'theme-quietlight',
        'theme-red',
        'theme-solarized-dark',
        'theme-solarized-light',
        'theme-tomorrow-night-blue',
        
        # Specialized/Unwanted tools
        'debug-auto-launch',
        'debug-server-ready',
        'npm',
        'media-preview',
        'merge-conflict',
    ]

    print(f"Pruning {len(to_remove)} extensions...")
    
    for ext in to_remove:
        ext_path = os.path.join(extensions_dir, ext)
        if os.path.exists(ext_path):
            print(f"Removing {ext}...")
            if os.path.isdir(ext_path):
                shutil.rmtree(ext_path)
            else:
                os.remove(ext_path)
        else:
            print(f"Skipping {ext} (not found)")

    print("\nPruning complete!")

if __name__ == "__main__":
    prune_extensions()
