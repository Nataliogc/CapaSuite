"""Genera los iconos PWA cuadrados requeridos (192x192 y 512x512) desde el logo de CapaSuite."""

from PIL import Image
import os

src = os.path.join('Imagen', 'Icono_CapaSuite.png')
out_dir = 'Imagen'

img = Image.open(src).convert('RGBA')

def make_square_icon(img, size, bg_color=(15, 23, 42, 255)):
    """Centra la imagen sobre un fondo cuadrado del color de la app."""
    canvas = Image.new('RGBA', (size, size), bg_color)
    
    # Escalar manteniendo proporción, dejando 10% de margen
    max_dim = int(size * 0.80)
    img_ratio = img.width / img.height
    if img_ratio > 1:
        new_w = max_dim
        new_h = int(max_dim / img_ratio)
    else:
        new_h = max_dim
        new_w = int(max_dim * img_ratio)
    
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    
    # Centrar
    x = (size - new_w) // 2
    y = (size - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas

# Color de fondo: --bg-deep de la app = #0f172a
bg = (15, 23, 42, 255)

for size in [192, 512]:
    icon = make_square_icon(img, size, bg)
    out_path = os.path.join(out_dir, f'icon-{size}.png')
    icon.save(out_path, 'PNG')
    print(f'Generado: {out_path} ({size}x{size})')

print('Listo.')
