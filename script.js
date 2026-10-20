/* Shared behaviour: dark-mode toggle + graceful handling of missing media.
   The initial theme is set by a tiny inline script in each page <head>
   so there is no flash of the wrong theme. */
(function () {
    var root = document.documentElement;

    function setTheme(t) {
        root.setAttribute('data-theme', t);
        try { localStorage.setItem('theme', t); } catch (e) {}
        var btn = document.querySelector('.theme-toggle');
        if (btn) btn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', t === 'dark' ? '#0F1417' : '#F7F4EC');
        window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.querySelector('.theme-toggle');
        if (btn) {
            btn.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
            btn.addEventListener('click', function () {
                setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
            });
        }

        // follow the OS setting until the visitor picks a theme themselves
        var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
        if (mq && mq.addEventListener) {
            mq.addEventListener('change', function (e) {
                var stored = null;
                try { stored = localStorage.getItem('theme'); } catch (err) {}
                if (!stored) {
                    root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                    window.dispatchEvent(new CustomEvent('themechange'));
                }
            });
        }
    });

    // If an image / video file is missing, hide its figure instead of showing a broken icon.
    document.addEventListener('error', function (e) {
        var t = e.target;
        if (!t || !t.tagName) return;
        var tag = t.tagName;
        if (tag !== 'IMG' && tag !== 'VIDEO' && tag !== 'SOURCE') return;
        var el = tag === 'SOURCE' ? t.parentElement : t;
        if (!el) return;
        var fig = el.closest('figure, .hero-media');
        (fig || el).style.display = 'none';
    }, true);

    // images that already failed before this script ran
    function sweep() {
        document.querySelectorAll('img').forEach(function (img) {
            if (img.complete && img.naturalWidth === 0) {
                (img.closest('figure, .hero-media') || img).style.display = 'none';
            }
        });
    }
    document.addEventListener('DOMContentLoaded', sweep);
    window.addEventListener('load', sweep);
})();
