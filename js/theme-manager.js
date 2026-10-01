
/**
 * CapaSuite Theme Manager
 * Maneja el cambio entre Modo Claro y Modo Noche de forma global
 */

(function() {
    // 1. Cargar preferencia guardada o usar noche por defecto
    let savedTheme = 'dark';
    try {
        if (localStorage.getItem('capasuite_theme') === 'light') savedTheme = 'light';
    } catch (_) { /* El cambio visual funciona aunque el almacenamiento no esté disponible. */ }
    document.documentElement.setAttribute('data-theme', savedTheme);

    // 2. Función para cambiar el tema
    window.toggleTheme = function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('capasuite_theme', newTheme); } catch (_) {}
        
        // Actualizar icono del botón si existe
        updateThemeIcon(newTheme);
        
        // Disparar evento para que otros componentes (gráficos) se actualicen si es necesario
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: newTheme }));
    };

    // 3. Insertar el botón en la navegación cuando el DOM esté listo (solo si no existe ya)
    function initializeThemeButton() {
        if (document.getElementById('themeToggleBtn')) {
            updateThemeIcon(document.documentElement.getAttribute('data-theme'));
            return;
        }

        const navUser = document.querySelector('.nav-user');
        if (navUser) {
            const themeBtn = document.createElement('div');
            themeBtn.className = 'theme-toggle';
            themeBtn.style.cursor = 'pointer';
            themeBtn.style.fontSize = '1.2rem';
            themeBtn.style.marginRight = '15px';
            themeBtn.style.display = 'flex';
            themeBtn.style.alignItems = 'center';
            themeBtn.onclick = window.toggleTheme;
            themeBtn.id = 'themeToggleBtn';
            
            navUser.insertBefore(themeBtn, navUser.firstChild);
            updateThemeIcon(document.documentElement.getAttribute('data-theme'));
        }
    }
    document.addEventListener('DOMContentLoaded', () => {
        initializeThemeButton();
        if (window.CapaNavReady) window.CapaNavReady.then(initializeThemeButton);
    });

    function updateThemeIcon(theme) {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
            btn.title = theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Noche';
        }
    }
})();
