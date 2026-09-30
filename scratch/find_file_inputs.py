with open('CargarDatos.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

keywords = ['input', 'file', 'choose', 'seleccionar', 'directorio', 'folder', 'path',
            'showOpenFilePicker', 'showDirectoryPicker', 'drag', 'drop', 'localStorage',
            'upload', 'FileReader', 'click()']

results = []
for i, line in enumerate(lines, 1):
    for kw in keywords:
        if kw.lower() in line.lower():
            results.append(f'L{i}: {line.rstrip()}')
            break

for r in results[:80]:
    print(r)
