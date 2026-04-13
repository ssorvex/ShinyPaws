// ==================== EXTENDED ADMIN: Images, Content, Pricing ====================
// All saves commit directly to GitHub → Netlify auto-deploys

// ==================== TOKEN ====================
function getToken() {
    const field = document.getElementById('githubToken');
    if (!field || !field.value.trim()) {
        showNotification('Enter your GitHub token at the top of the page first.', 'error');
        document.getElementById('githubToken').focus();
        throw new Error('GitHub token required');
    }
    return field.value.trim();
}

// ==================== TABS ====================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    if (tabName === 'images')  loadSectionImages();
    if (tabName === 'content') loadContentEditor();
    if (tabName === 'pricing') loadPricingEditor();
}

// ==================== NOTIFICATIONS ====================
function showNotification(msg, type) {
    let el = document.getElementById('extNotif');
    if (!el) {
        el = document.createElement('div');
        el.id = 'extNotif';
        el.style.cssText = [
            'position:fixed', 'top:20px', 'right:20px', 'z-index:9999',
            'padding:14px 20px', 'border-radius:12px', 'font-weight:700',
            'font-size:14px', 'max-width:360px',
            'box-shadow:0 8px 24px rgba(0,0,0,.15)', 'transition:opacity .3s'
        ].join(';');
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'error' ? '#d32f2f' : type === 'loading' ? '#5B3090' : '#2e7d32';
    el.style.color = '#fff';
    el.style.opacity = '1';
    clearTimeout(el._t);
    if (type !== 'loading') {
        el._t = setTimeout(() => { el.style.opacity = '0'; }, 4000);
    }
}

// ==================== CONTENT EDITOR ====================
async function loadContentEditor() {
    const container = document.getElementById('contentSections');
    if (!container) return;

    let token;
    try { token = getToken(); } catch(e) {
        container.innerHTML = '<div style="background:#fff3e0;border-radius:10px;padding:16px;color:#e65100"><strong>Enter your GitHub token above</strong> to load content for editing.</div>';
        return;
    }

    container.innerHTML = '<p style="color:#7B5EA7;padding:20px;text-align:center">Loading content from GitHub...</p>';

    let html;
    try {
        html = await getFileFromGitHub('studio.html', token);
    } catch(e) {
        container.innerHTML = '<div style="background:#fdecea;border-radius:10px;padding:16px;color:#d32f2f">Failed to load: ' + e.message + '</div>';
        return;
    }

    var fields = [
        { id: 'chip',     label: 'Top Badge Text',  rx: /<div class="chip">([\s\S]*?)<\/div>/ },
        { id: 'hero_h1',  label: 'Hero Headline',   rx: /<h1>([\s\S]*?)<\/h1>/ },
        { id: 'hero_sub', label: 'Hero Subtitle',   rx: /<p class="hero-sub">([\s\S]*?)<\/p>/ },
    ];

    container.innerHTML = fields.map(function(f) {
        var m = html.match(f.rx);
        var v = m ? m[1].trim() : '';
        return '<div style="margin-bottom:18px">' +
            '<label style="display:block;font-weight:800;font-size:12px;color:#3D2060;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">' + f.label + '</label>' +
            '<textarea id="cf_' + f.id + '" rows="2" style="width:100%;padding:10px;border:2px solid #E8D5FF;border-radius:8px;font-family:inherit;font-size:14px;resize:vertical">' + v + '</textarea>' +
            '</div>';
    }).join('');

    container.dataset.orig = html;
}

async function updateContentOnWebsiteViaGitHub() {
    var container = document.getElementById('contentSections');
    if (!container || !container.dataset.orig) {
        showNotification('Click the Content tab first to load content.', 'error');
        return;
    }
    var token;
    try { token = getToken(); } catch(e) { return; }

    showNotification('Saving content to GitHub...', 'loading');

    try {
        var html = container.dataset.orig;

        var patches = [
            { id: 'cf_chip',     open: '<div class="chip">',       close: '</div>' },
            { id: 'cf_hero_h1',  open: '<h1>',                     close: '</h1>' },
            { id: 'cf_hero_sub', open: '<p class="hero-sub">',      close: '</p>' },
        ];

        patches.forEach(function(p) {
            var el = document.getElementById(p.id);
            if (!el || !el.value.trim()) return;
            var escaped_open  = p.open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var escaped_close = p.close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var rx = new RegExp(escaped_open + '[\\s\\S]*?' + escaped_close);
            html = html.replace(rx, p.open + el.value.trim() + p.close);
        });

        await uploadFileToGitHub('studio.html', html, 'Admin: update site content', token);
        container.dataset.orig = html;
        showNotification('Content saved! Site updates in ~1 min.', 'success');
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

function saveAllContent() {
    showNotification('Click "Update Website" to push changes to the live site.', 'success');
}

// ==================== PRICING EDITOR ====================
var PRICING_KEYS   = ['bath_brush', 'bath_trim', 'full_groom', 'daycare'];
var PRICING_LABELS = ['Bath & Brush', 'Bath & Trim', 'Full Grooming', 'Daycare'];

async function loadPricingEditor() {
    var tbody = document.getElementById('pricingTable');
    if (!tbody) return;

    var html = '';
    var token;
    try {
        token = getToken();
        html = await getFileFromGitHub('studio.html', token);
    } catch(e) {}

    var prices = [];
    var rx = /<div class="pc-amt">\$([^<]+)<\/div>/g;
    var m;
    while ((m = rx.exec(html)) !== null) prices.push(m[1].trim());

    tbody.innerHTML = PRICING_KEYS.map(function(key, i) {
        return '<tr>' +
            '<td style="padding:10px;font-weight:700;color:#3D2060">' + PRICING_LABELS[i] + '</td>' +
            '<td style="padding:10px"><div style="display:flex;align-items:center;gap:6px">' +
            '<span style="font-size:18px;font-weight:700;color:#3D2060">$</span>' +
            '<input type="number" id="price_' + key + '" value="' + (prices[i] || '') + '" ' +
            'style="width:90px;padding:8px;border:2px solid #E8D5FF;border-radius:8px;font-size:16px;font-weight:700;color:#3D2060">' +
            '</div></td></tr>';
    }).join('');

    if (html) tbody.dataset.orig = html;
}

async function updatePricingOnWebsiteViaGitHub() {
    var tbody = document.getElementById('pricingTable');
    if (!tbody || !tbody.dataset.orig) {
        showNotification('Click the Pricing tab first to load prices.', 'error');
        return;
    }
    var token;
    try { token = getToken(); } catch(e) { return; }

    showNotification('Saving pricing to GitHub...', 'loading');

    try {
        var html = tbody.dataset.orig;
        var i = 0;
        html = html.replace(/<div class="pc-amt">\$([^<]+)<\/div>/g, function(match) {
            var input = document.getElementById('price_' + PRICING_KEYS[i++]);
            if (input && input.value.trim()) {
                return '<div class="pc-amt">$' + input.value.trim() + '</div>';
            }
            return match;
        });

        await uploadFileToGitHub('studio.html', html, 'Admin: update pricing', token);
        tbody.dataset.orig = html;
        showNotification('Pricing saved! Site updates in ~1 min.', 'success');
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

function savePricing() {
    showNotification('Click "Update Website" to push changes to the live site.', 'success');
}

// ==================== IMAGE MANAGER ====================
function uploadImage() {
    var file = document.getElementById('imageUpload').files[0];
    var section = document.getElementById('imageSection').value;
    if (!file) { showNotification('Select an image file first.', 'error'); return; }

    var reader = new FileReader();
    reader.onload = async function(e) {
        var dataUrl  = e.target.result;
        var ts       = Date.now();
        var ext      = file.name.split('.').pop().toLowerCase();
        var name     = section + '-' + ts + '.' + ext;
        var path     = 'images/' + name;

        // Save to local list
        var imgs = JSON.parse(localStorage.getItem('imgs_' + section) || '[]');
        imgs.unshift({ id: ts, name: name, data: dataUrl, path: path, at: new Date().toLocaleString() });
        localStorage.setItem('imgs_' + section, JSON.stringify(imgs));

        // Upload to GitHub
        var token;
        try { token = getToken(); } catch(e) { loadSectionImages(); return; }

        showNotification('Uploading image to GitHub...', 'loading');
        try {
            await uploadRawBase64(path, dataUrl.split(',')[1], 'Admin: add image ' + name, token);
            showNotification('Image uploaded! Click "Apply to Site" to use it.', 'success');
        } catch(e) {
            showNotification('Upload error: ' + e.message, 'error');
        }
        document.getElementById('imageUpload').value = '';
        loadSectionImages();
    };
    reader.readAsDataURL(file);
}

async function uploadRawBase64(filePath, b64, message, token) {
    var sha = null;
    try { sha = await getFileSHA(filePath, token); } catch(e) {}
    var url = 'https://api.github.com/repos/' + GITHUB_CONFIG.owner + '/' + GITHUB_CONFIG.repo + '/contents/' + filePath;
    var body = { message: message, content: b64, branch: GITHUB_CONFIG.branch };
    if (sha) body.sha = sha;
    var r = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': 'token ' + token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        var err = await r.json();
        throw new Error(err.message || r.statusText);
    }
    return r.json();
}

function loadSectionImages() {
    var section = document.getElementById('imageSection') && document.getElementById('imageSection').value;
    var grid = document.getElementById('imageGrid');
    if (!section || !grid) return;

    var imgs = JSON.parse(localStorage.getItem('imgs_' + section) || '[]');
    if (!imgs.length) {
        grid.innerHTML = '<p style="color:#7B5EA7;padding:20px;text-align:center">No images uploaded yet for this section.</p>';
        return;
    }

    grid.innerHTML = imgs.map(function(img) {
        return '<div data-id="' + img.id + '" data-section="' + section + '" draggable="true" ' +
            'ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dropImage(event)" ondragend="dragEnd(event)" ' +
            'style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(61,32,96,.1);border:2px solid #E8D5FF">' +
            '<img src="' + img.data + '" style="width:100%;height:140px;object-fit:cover;display:block">' +
            '<div style="padding:10px">' +
            '<div style="font-size:11px;font-weight:700;color:#3D2060;margin-bottom:4px;word-break:break-all">' + img.name + '</div>' +
            '<div style="font-size:10px;color:#7B5EA7;margin-bottom:8px">' + img.at + '</div>' +
            '<button onclick="applyImageToSite(' + img.id + ')" ' +
            'style="width:100%;padding:8px;background:linear-gradient(135deg,#3D2060,#5B3090);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;margin-bottom:4px">' +
            'Apply to Site</button>' +
            '<button onclick="deleteImage(' + img.id + ')" ' +
            'style="width:100%;padding:6px;background:#ffeaea;color:#d32f2f;border:1px solid #ffcdd2;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700">' +
            'Delete</button>' +
            '</div></div>';
    }).join('');
}

async function applyImageToSite(imageId) {
    var section = document.getElementById('imageSection').value;
    var token;
    try { token = getToken(); } catch(e) { return; }

    var imgs = JSON.parse(localStorage.getItem('imgs_' + section) || '[]');
    var img = imgs.find(function(i) { return i.id === imageId; });
    if (!img) { showNotification('Image not found', 'error'); return; }

    showNotification('Applying image to site...', 'loading');

    try {
        var imgUrl = '/' + img.path;

        if (section === 'hero') {
            var html = await getFileFromGitHub('studio.html', token);
            html = html.replace(/(<img class="orb-img" src=")[^"]*(")/,  '$1' + imgUrl + '$2');
            await uploadFileToGitHub('studio.html', html, 'Admin: update hero image', token);

        } else if (section === 'gallery') {
            var html = await getFileFromGitHub('studio.html', token);
            // Replace first gallery slot (gi ga)
            html = html.replace(/(<div class="gi ga"><img src=")[^"]*(")/,  '$1' + imgUrl + '$2');
            await uploadFileToGitHub('studio.html', html, 'Admin: update gallery image', token);

        } else if (section === 'room') {
            // Replace room.png directly
            await uploadRawBase64('room.png', img.data.split(',')[1], 'Admin: update room image', token);
        }

        showNotification('Image applied! Site updates in ~1 min.', 'success');
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

function deleteImage(imageId) {
    var section = document.getElementById('imageSection').value;
    if (!confirm('Delete this image from the local list?')) return;
    var imgs = JSON.parse(localStorage.getItem('imgs_' + section) || '[]');
    localStorage.setItem('imgs_' + section, JSON.stringify(imgs.filter(function(i) { return i.id !== imageId; })));
    loadSectionImages();
}

// ==================== DRAG & DROP ====================
var _dragSrc = null;

function dragStart(e) {
    _dragSrc = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
}
function dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}
function dragEnd() { _dragSrc = null; }
function dropImage(e) {
    e.preventDefault();
    if (!_dragSrc || _dragSrc === e.currentTarget) return;
    var section = _dragSrc.dataset.section;
    var imgs = JSON.parse(localStorage.getItem('imgs_' + section) || '[]');
    var fi = imgs.findIndex(function(i) { return i.id === parseInt(_dragSrc.dataset.id); });
    var ti = imgs.findIndex(function(i) { return i.id === parseInt(e.currentTarget.dataset.id); });
    if (fi > -1 && ti > -1) {
        var moved = imgs.splice(fi, 1)[0];
        imgs.splice(ti, 0, moved);
        localStorage.setItem('imgs_' + section, JSON.stringify(imgs));
        loadSectionImages();
    }
}
