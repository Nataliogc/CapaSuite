"""
Mueve la barra 'Carpeta de trabajo' de su posición actual
a una segunda barra sticky justo debajo del <nav>.
"""

with open('CargarDatos.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 1. Extraer y eliminar el bloque actual ────────────────────────────────
START_MARKER = '        <!-- ===== CARPETA FAVORITA (File System Access API) ===== -->'
END_MARKER   = '        <!-- ===== FIN CARPETA FAVORITA ===== -->\n'

start_idx = content.find(START_MARKER)
end_idx   = content.find(END_MARKER)

if start_idx == -1 or end_idx == -1:
    print('ERROR: markers not found')
    exit(1)

end_idx += len(END_MARKER)
fav_block = content[start_idx:end_idx]

# Eliminar del sitio original (incluye el \n que queda detrás)
content = content[:start_idx] + content[end_idx:]

# ── 2. Construir la nueva barra sticky (sin el script inline, lo ponemos aparte) ──
# El script JS ya está dentro del bloque extraído — lo reusamos tal cual
# Solo cambiamos el estilo del contenedor para que sea sticky top-bar

# Reemplazar el estilo inline del div#fav-folder-bar para hacerlo sticky
OLD_STYLE = '''        <!-- ===== CARPETA FAVORITA (File System Access API) ===== -->
        <div id="fav-folder-bar" style="
            margin-bottom: 16px;
            padding: 10px 18px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.85rem;
        ">'''

NEW_STYLE = '''        <!-- ===== CARPETA FAVORITA (File System Access API) ===== -->
        <div id="fav-folder-bar" style="
            position: sticky;
            top: 60px;
            z-index: 9000;
            padding: 8px 24px;
            background: var(--bg-surface);
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.85rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        ">'''

fav_block = fav_block.replace(OLD_STYLE, NEW_STYLE, 1)

# ── 3. Insertar justo después de </nav> ───────────────────────────────────
NAV_END = '    </nav>'
nav_idx = content.find(NAV_END)
if nav_idx == -1:
    print('ERROR: </nav> not found')
    exit(1)

insert_pos = nav_idx + len(NAV_END)
content = content[:insert_pos] + '\n' + fav_block + content[insert_pos:]

with open('CargarDatos.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('OK: barra movida a posición sticky debajo del nav')
