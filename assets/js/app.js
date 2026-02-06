/* ========================================
   Wing9897 Tools Hub - App
   ======================================== */

var currentCategory = 'all';

function filterTools(tools, category, term) {
    return tools.filter(function(t) {
        var catOk = category === 'all' || t.category === category;
        var searchOk = true;
        if (term && term.trim()) {
            var s = term.toLowerCase().trim();
            searchOk = t.title.toLowerCase().includes(s) ||
                t.description.toLowerCase().includes(s) ||
                t.tags.some(function(tag) { return tag.toLowerCase().includes(s); });
        }
        return catOk && searchOk;
    });
}

function countByCategory(tools, cat) {
    if (cat === 'all') return tools.length;
    return tools.filter(function(t) { return t.category === cat; }).length;
}

function createCard(tool) {
    var badge = tool.isNew ? '<span class="new-badge">NEW</span>' : '';
    var tags = tool.tags.map(function(t) {
        return '<span class="tool-tag">' + t + '</span>';
    }).join('');

    return '<div class="tool-card" data-category="' + tool.category + '">' +
        badge +
        '<div class="tool-card-inner">' +
        '<div class="tool-card-top">' +
            '<div class="tool-icon"><i class="bi ' + tool.icon + '"></i></div>' +
            '<div class="tool-info">' +
                '<div class="tool-title">' + tool.title + '</div>' +
                '<div class="tool-category">' + tool.categoryLabel + '</div>' +
            '</div>' +
        '</div>' +
        '<p class="tool-desc">' + tool.description + '</p>' +
        '<div class="tool-tags">' + tags + '</div>' +
        '<a href="' + tool.href + '" class="tool-action">開啟工具</a>' +
        '</div>' +
    '</div>';
}

function renderTools(tools) {
    var grid = document.getElementById('tool-grid');
    if (!grid) return;
    if (tools.length === 0) {
        grid.innerHTML = '<div class="no-results"><i class="bi bi-inbox"></i>找不到匹配的工具</div>';
        return;
    }
    grid.innerHTML = tools.map(createCard).join('');
}

function renderCategories() {
    var el = document.getElementById('category-filter');
    if (!el) return;
    el.innerHTML = '';
    CATEGORIES.forEach(function(cat) {
        var count = countByCategory(TOOLS, cat.key);
        var btn = document.createElement('button');
        btn.className = 'cat-btn' + (cat.key === 'all' ? ' active' : '');
        btn.setAttribute('data-category', cat.key);
        btn.textContent = cat.label + ' (' + count + ')';
        el.appendChild(btn);
    });
}

function doFilter() {
    var input = document.getElementById('search-input');
    var term = input ? input.value : '';
    renderTools(filterTools(TOOLS, currentCategory, term));
}

function toggleTheme() {
    var html = document.documentElement;
    var next = (html.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch(e) {}
    var icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = next === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
}

function applyTheme() {
    try {
        var s = localStorage.getItem('theme');
        if (s === 'dark' || s === 'light') {
            document.documentElement.setAttribute('data-theme', s);
            var icon = document.querySelector('#theme-toggle i');
            if (icon) icon.className = s === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
        }
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', function() {
    applyTheme();
    renderCategories();
    renderTools(TOOLS);

    var yearEl = document.getElementById('copyright-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var toggle = document.getElementById('theme-toggle');
    if (toggle) toggle.addEventListener('click', toggleTheme);

    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', doFilter);

    var catFilter = document.getElementById('category-filter');
    if (catFilter) {
        catFilter.addEventListener('click', function(e) {
            var btn = e.target.closest('.cat-btn');
            if (!btn) return;
            catFilter.querySelectorAll('.cat-btn').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentCategory = btn.getAttribute('data-category');
            doFilter();
        });
    }

    var backBtn = document.getElementById('back-to-top');
    if (backBtn) backBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function() {
        if (backBtn) {
            if (window.scrollY > 300) backBtn.classList.add('visible');
            else backBtn.classList.remove('visible');
        }
    });
});
