with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('rel="manifest"', 'manifest link'),
    ('service-worker.js', 'SW registration'),
    ('pwa-install-banner', 'install banner'),
    ('beforeinstallprompt', 'install prompt event'),
    ('appinstalled', 'appinstalled event'),
    ('theme-color', 'theme-color meta'),
]
for needle, label in checks:
    status = 'OK' if needle in content else 'MISSING'
    print(f'[{status}] {label}')
print(f'Total chars: {len(content)}')
