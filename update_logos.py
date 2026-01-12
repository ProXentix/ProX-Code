import os
from PIL import Image

def update_logos():
    root_dir = os.path.abspath(os.path.dirname(__file__))
    source_img_path = r'C:/Users/INTEX/.gemini/antigravity/brain/16d22f18-f720-4bb6-85c5-768383ba9909/prox_code_logo_high_res_1768214541381.png'
    
    if not os.path.exists(source_img_path):
        print(f"Source image not found: {source_img_path}")
        return

    img = Image.open(source_img_path)

    # Define targets
    # Format: (relative_path, format, size_or_sizes)
    targets = [
        # Windows ICO
        ('resources/win32/code.ico', 'ICO', [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]),
        
        # Windows PNGs
        ('resources/win32/code_70x70.png', 'PNG', (70, 70)),
        ('resources/win32/code_150x150.png', 'PNG', (150, 150)),
        
        # Linux
        ('resources/linux/code.png', 'PNG', (512, 512)),
        
        # Server
        ('resources/server/code-192.png', 'PNG', (192, 192)),
        ('resources/server/code-512.png', 'PNG', (512, 512)),
        
        # Extensions (Standard icon.png)
        ('extensions/markdown-math/icon.png', 'PNG', (128, 128)),
        ('extensions/markdown-language-features/icon.png', 'PNG', (128, 128)),
        ('extensions/json-language-features/icons/json.png', 'PNG', (128, 128)),
        ('extensions/search-result/images/icon.png', 'PNG', (128, 128)),
        ('extensions/references-view/media/icon.png', 'PNG', (128, 128)),
        ('extensions/terminal-suggest/src/media/icon.png', 'PNG', (128, 128)),
        ('extensions/configuration-editing/images/icon.png', 'PNG', (128, 128)),
        ('extensions/theme-seti/icons/seti-circular-128x128.png', 'PNG', (128, 128)),
    ]

    print("Staring logo replacement...")

    for rel_path, fmt, size in targets:
        full_path = os.path.join(root_dir, rel_path.replace('/', os.sep))
        dir_name = os.path.dirname(full_path)
        
        # Even if the extension was pruned, some dirs might still exist or we skip gracefully
        if not os.path.exists(dir_name):
            # print(f"Skipping {rel_path} (directory does not exist)")
            continue

        try:
            if fmt == 'ICO':
                # Convert list of sizes for icon
                img.save(full_path, format='ICO', sizes=size)
            else:
                # Resize and save
                resized_img = img.resize(size, Image.Resampling.LANCZOS)
                resized_img.save(full_path, format=fmt)
            
            print(f"Updated {rel_path}")
        except Exception as e:
            print(f"Failed to update {rel_path}: {e}")

    # Aggressive search for other 'icon.png' or 'code.png' files we might have missed
    print("\nScanning for remaining icons...")
    target_names = {'icon.png', 'code.png', 'logo.png', 'code-192.png', 'code-512.png'}
    skip_dirs = {'.git', 'node_modules', '.build', 'out', 'build'}

    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for file in files:
            if file.lower() in target_names:
                file_path = os.path.join(root, file)
                try:
                    # Get existing size to match
                    with Image.open(file_path) as existing_img:
                        existing_size = existing_img.size
                    
                    # Override with new logo
                    resized_img = img.resize(existing_size, Image.Resampling.LANCZOS)
                    resized_img.save(file_path)
                    # print(f"Updated recursive: {file_path}")
                except:
                    pass

    print("\nLogo replacement complete!")

if __name__ == "__main__":
    update_logos()
