with open('CargarDatos.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

keywords = ['CONFIG_KEY', 'upload_config', 'lastLoad', 'processed', 'saveConfig',
            'loadConfig', 'db_state', 'getItem', 'setItem', 'fileName', 'file_name',
            'timestamp', 'lastUpdate', 'status-ok', 'status-done', 'Cargado']

seen = set()
for i, line in enumerate(lines, 1):
    for kw in keywords:
        if kw in line and i not in seen:
            seen.add(i)
            try:
                print(f'L{i}: {line.rstrip()}')
            except Exception:
                print(f'L{i}: [unicode error]')
            break
