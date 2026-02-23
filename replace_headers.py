import os
import re

# CONFIGURATION
STANDARD_HEADER = [
    '/*---------------------------------------------------------------------------------------------',
    ' *  Copyright (c) ProXentix. All rights reserved.',
    ' *  Licensed under the MIT License. See License.txt in the project root for license information.',
    ' *--------------------------------------------------------------------------------------------*/'
]
HEADER_TEXT = "\n".join(STANDARD_HEADER) + "\n"

# Add directories to skip to avoid corrupting meta-data or libraries
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.vs', '.vscode', 'out', 'out-build', 'out-editor-src', 'out-monaco-editor-core'}
EXTENSIONS = {'.ts', '.js', '.mjs', '.cjs', '.css'}

# Regex to find existing headers (Microsoft or ProXentix variations)
# Matches the start of the file if it looks like a copyright block
HEADER_REGEX = re.compile(
    r'^\s*/\*---------------------------------------------------------------------------------------------\r?\n'
    r' \*\s+Copyright \(c\) .*rights reserved\.\r?\n'
    r' \*\s+Licensed under the MIT License.*\r?\n'
    r' \*--------------------------------------------------------------------------------------------\*/\r?\n?',
    re.MULTILINE | re.IGNORECASE
)

def process_file(file_path):
    try:
        # Read the file content
        with open(file_path, 'rb') as f:
            raw_content = f.read()
        
        # Detect encoding? Usually utf-8 for source files
        try:
            content = raw_content.decode('utf-8')
        except UnicodeDecodeError:
            print(f"Skipping binary/non-UTF8 file: {file_path}")
            return False

        # Check if it already has the EXACT correct header
        if content.startswith(HEADER_TEXT):
            return False

        # Check if it has an incorrect header we can replace
        match = HEADER_REGEX.match(content)
        if match:
            new_content = HEADER_TEXT + content[match.end():]
            with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(new_content)
            print(f"Updated header: {file_path}")
            return True
        else:
            # No header found, prepend it
            # But only for files that look like source code
            if content.strip() == "":
                return False
                
            # Check for shebang
            if content.startswith('#!'):
                lines = content.split('\n', 1)
                if len(lines) > 1:
                    new_content = lines[0] + '\n' + HEADER_TEXT + lines[1]
                else:
                    new_content = lines[0] + '\n' + HEADER_TEXT
            else:
                new_content = HEADER_TEXT + content
            
            with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(new_content)
            print(f"Added header:   {file_path}")
            return True

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
    return False

def main():
    root_dir = "."
    print(f"Applying watermark to files in {os.path.abspath(root_dir)}")
    count = 0
    
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Skip ignored directories
        parts = dirpath.split(os.sep)
        if any(ignore in parts for ignore in IGNORE_DIRS):
            continue

        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in EXTENSIONS:
                file_path = os.path.join(dirpath, filename)
                if process_file(file_path):
                    count += 1

    print(f"\nDone. Updated/Added headers in {count} files.")

if __name__ == "__main__":
    main()
