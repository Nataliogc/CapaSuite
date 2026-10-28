/**
 * CapaSuite - Herramienta de Incremento Automático de Versión
 * 
 * Uso:
 *   node tools/bump-version.js            (incrementa patch: 2.7.1 -> 2.7.2)
 *   node tools/bump-version.js --minor    (incrementa minor: 2.7.1 -> 2.8.0)
 *   node tools/bump-version.js --major    (incrementa major: 2.7.1 -> 3.0.0)
 *   node tools/bump-version.js --set 2.8  (fija versión manual)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'js', 'version.js');

function pad(num) {
    return String(num).padStart(2, '0');
}

function getNowFormatted() {
    const now = new Date();
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());

    return {
        buildDate: `${day}/${month}/${year}`,
        buildTimestamp: `${year}-${month}-${day} ${hours}:${minutes}`,
        queryTimestamp: `${year}${month}${day}-${hours}${minutes}`
    };
}

function bumpSemver(versionStr, type = 'patch') {
    const parts = versionStr.split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);

    if (type === 'major') {
        parts[0] += 1;
        parts[1] = 0;
        parts[2] = 0;
    } else if (type === 'minor') {
        parts[1] += 1;
        parts[2] = 0;
    } else {
        parts[2] += 1;
    }

    return parts.join('.');
}

function run() {
    if (!fs.existsSync(VERSION_FILE)) {
        console.error(`❌ Error: No se encontró el archivo de versión: ${VERSION_FILE}`);
        process.exit(1);
    }

    let versionContent = fs.readFileSync(VERSION_FILE, 'utf8');

    // Extraer versión actual
    const match = versionContent.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (!match) {
        console.error('❌ Error: No se pudo leer APP_VERSION en js/version.js');
        process.exit(1);
    }

    const currentVersion = match[1];
    let nextVersion = '';

    // Analizar argumentos CLI
    const args = process.argv.slice(2);
    if (args.includes('--minor')) {
        nextVersion = bumpSemver(currentVersion, 'minor');
    } else if (args.includes('--major')) {
        nextVersion = bumpSemver(currentVersion, 'major');
    } else if (args.includes('--set') && args[args.indexOf('--set') + 1]) {
        nextVersion = args[args.indexOf('--set') + 1];
    } else {
        nextVersion = bumpSemver(currentVersion, 'patch');
    }

    const { buildDate, buildTimestamp, queryTimestamp } = getNowFormatted();

    // Actualizar js/version.js
    versionContent = versionContent.replace(/const\s+APP_VERSION\s*=\s*['"][^'"]+['"]/, `const APP_VERSION = '${nextVersion}'`);
    versionContent = versionContent.replace(/const\s+BUILD_DATE\s*=\s*['"][^'"]+['"]/, `const BUILD_DATE = '${buildDate}'`);
    versionContent = versionContent.replace(/const\s+BUILD_TIMESTAMP\s*=\s*['"][^'"]+['"]/, `const BUILD_TIMESTAMP = '${buildTimestamp}'`);

    fs.writeFileSync(VERSION_FILE, versionContent, 'utf8');
    console.log(`🚀 CapaSuite Versión Actualizada: v${currentVersion} ➔ v${nextVersion}`);
    console.log(`📅 Fecha de Compilación: ${buildDate} (${buildTimestamp})`);

    // Actualizar query strings en ficheros HTML principales para forzar recarga de caché
    const htmlFiles = fs.readdirSync(ROOT_DIR).filter(f => f.endsWith('.html'));
    let updatedCount = 0;

    htmlFiles.forEach(file => {
        const filePath = path.join(ROOT_DIR, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Reemplazar ?v=... en scripts clave
        const scriptsToBust = ['version.js', 'pricing-intelligence.js', 'competencia-intelligence-ui.js'];
        scriptsToBust.forEach(script => {
            const regex = new RegExp(`(src=["'][^"']*${script}\\?v=)[^"']+`, 'g');
            if (regex.test(content)) {
                content = content.replace(regex, `$1${queryTimestamp}`);
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            updatedCount++;
        }
    });

    console.log(`✨ Cache-busting sincronizado en ${updatedCount} archivos HTML.`);
    console.log('✅ Incremento de versión completado con éxito.');
}

run();
