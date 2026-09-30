import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('CargarDatos.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('js/segment-analysis.js', 'r', encoding='utf-8') as f:
    js = f.read()

checks = [
    ('filename: file.name' in html,        'Fix 1: filename guardado en log'),
    ('isSilentIgnore' in html,             'Fix 2: PAX ignorado silenciosamente'),
    ('uniqueYears.length >= 1' in js,      'Fix 3: multi-ano usa ano menor como hintYear'),
]

for ok, label in checks:
    status = 'OK' if ok else 'FAIL'
    print(f'[{status}] {label}')
