import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace font-size: 14px with font-size: calc(14px * var(--font-scale, 1))
    # It must handle spaces carefully.
    new_content = re.sub(r'font-size:\s*(\d+)px', r'font-size: calc(\1px * var(--font-scale, 1))', content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.html') or file.endswith('.css'):
            process_file(os.path.join(root, file))
