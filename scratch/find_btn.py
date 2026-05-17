import os
import re

# Mendeteksi path index.html secara dinamis (satu tingkat di atas folder scratch)
base_dir = os.path.dirname(os.path.abspath(__file__))
index_path = os.path.abspath(os.path.join(base_dir, "..", "index.html"))

if os.path.exists(index_path):
    with open(index_path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Cari kelas CSS tombol/border di index.html
    classes = re.findall(r'class="([^"]*)"', text)
    btn_classes = [c for c in classes if 'btn' in c or 'border' in c]
    print("=== Ditemukan Kelas Tombol & Border ===")
    for c in list(set(btn_classes))[:25]:
        print(f"- {c}")
else:
    print(f"ERROR: index.html tidak ditemukan di path: {index_path}")
