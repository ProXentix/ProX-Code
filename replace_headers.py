import os

# CONFIGURATION
OLD_TEXT = "ProXentix"
NEW_TEXT = "ProXentix"
# Add directories to skip to avoid corrupting meta-data or libraries
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.vs', '.vscode'}

def replace_in_codebase(root_dir):
    print(f"Starting replacement: '{OLD_TEXT}' -> '{NEW_TEXT}'")
    count = 0
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip ignored directories
        if any(ignore in dirpath for ignore in IGNORE_DIRS):
            continue

        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            
            try:
                # Read the file content
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # Check if text exists
                if OLD_TEXT in content:
                    # Perform replacement
                    new_content = content.replace(OLD_TEXT, NEW_TEXT)
                    
                    # Write back to file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    print(f"Updated: {file_path}")
                    count += 1
            except Exception as e:
                print(f"Skipping file {file_path} due to error: {e}")

    print(f"\nDone. Updated {count} files.")

if __name__ == "__main__":
    # Run in current directory
    replace_in_codebase(".")
