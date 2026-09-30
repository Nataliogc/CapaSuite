with open('AnalisisSegmentos.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

keywords = ['lastUpdate', 'lastSegDate', 'lastProdDate', 'CONFIG_KEY', 'upload_config',
            'hotel_manager_db', 'top-nav', 'nav-user', 'userEmailNav', 'hotelSelector',
            'nav-links', 'getItem', 'segmentUpdatedAt', 'lastOtbDate']

seen = set()
for i, line in enumerate(lines, 1):
    for kw in keywords:
        if kw in line and i not in seen:
            seen.add(i)
            try:
                print(f'L{i}: {line.rstrip()}')
            except Exception:
                print(f'L{i}: [error]')
            break
