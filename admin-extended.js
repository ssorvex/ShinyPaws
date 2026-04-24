// ============================================================
// admin-extended.js — Full Content & Image Editor
// ============================================================

// SESSION PASSWORD
function getAdminPassword() {
    var pw = sessionStorage.getItem('adminPassword');
    if (!pw) { showNotification('Session expired — please log in again.', 'error'); throw new Error('No session'); }
    return pw;
}

// READ FILE from GitHub (public repo, no auth needed)
async function readFileFromGitHub(fp) {
    var r = await fetch('https://api.github.com/repos/ssorvex/ShinyPaws/contents/' + fp, {
        headers: { 'Accept': 'application/vnd.github.v3.raw' }
    });
    if (!r.ok) throw new Error('Load failed: ' + r.statusText);
    return r.text();
}

// COMMIT via Netlify Function
async function commitToGitHub(filePath, content, message, isBase64) {
    var r = await fetch('/.netlify/functions/github-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: getAdminPassword(), filePath: filePath, content: content, message: message, isBase64: !!isBase64 })
    });
    var d = await r.json();
    if (!r.ok) throw new Error(d.error || r.statusText);
    return d;
}

// TABS
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    if (tabName === 'images')    loadImagesTab();
    if (tabName === 'content')   loadContentTab();
    if (tabName === 'pricing')   loadPricingEditor();
    if (tabName === 'analytics') loadAnalyticsTab();
}

// NOTIFICATIONS
function showNotification(msg, type) {
    var el = document.getElementById('extNotif');
    if (!el) {
        el = document.createElement('div');
        el.id = 'extNotif';
        el.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;padding:14px 20px;border-radius:12px;font-weight:700;font-size:14px;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15);transition:opacity .3s';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = type === 'error' ? '#d32f2f' : type === 'loading' ? '#5B3090' : '#2e7d32';
    el.style.color = '#fff'; el.style.opacity = '1';
    clearTimeout(el._t);
    if (type !== 'loading') el._t = setTimeout(function() { el.style.opacity = '0'; }, 4000);
}

// ============================================================
// REGEX HELPERS
// ============================================================
function matchAll(html, rxStr) {
    var results = [], m, rx = new RegExp(rxStr, 'g');
    while ((m = rx.exec(html)) !== null) results.push(m[1]);
    return results;
}

// Replace the Nth match of rxStr (1 capture group = content to swap)
function replaceNth(html, rxStr, n, newVal) {
    var i = 0;
    return html.replace(new RegExp(rxStr, 'g'), function(full, p1) {
        if (i++ === n) {
            var idx = full.indexOf(p1);
            if (idx === -1) return full;
            return full.slice(0, idx) + newVal + full.slice(idx + p1.length);
        }
        return full;
    });
}

// Match/replace AFTER a unique anchor string (to scope to a section)
function matchAllAfter(html, anchor, rxStr) {
    var idx = html.indexOf(anchor);
    if (idx === -1) return [];
    return matchAll(html.slice(idx), rxStr);
}

function replaceNthAfter(html, anchor, rxStr, n, newVal) {
    var idx = html.indexOf(anchor);
    if (idx === -1) return html;
    return html.slice(0, idx) + replaceNth(html.slice(idx), rxStr, n, newVal);
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// IMAGE SLOTS — 8 replaceable photos
// ============================================================
var IMAGE_SLOTS = [
    {
        id: 'hero', label: 'Hero Photo',
        desc: 'Main pet photo — right side of the hero section at the top of the page',
        extract: function(h) { var m = h.match(/<img class="orb-img" src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(class="orb-img" src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'about', label: 'About Section Photo',
        desc: 'Dog photo inside the purple "About Us" section',
        extract: function(h) { var m = h.match(/class="about-card-big"[\s\S]{0,300}?<img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(class="about-card-big"[\s\S]{0,300}?<img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g1', label: 'Gallery Photo 1 — Large (top-left)',
        desc: 'The big featured gallery image, spans 2 columns and 2 rows',
        extract: function(h) { var m = h.match(/<div class="gi ga"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi ga"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g2', label: 'Gallery Photo 2 — Top right',
        desc: 'Small gallery photo, top-right area',
        extract: function(h) { var m = h.match(/<div class="gi gb"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi gb"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g3', label: 'Gallery Photo 3 — Middle right',
        desc: 'Small gallery photo, middle-right area',
        extract: function(h) { var m = h.match(/<div class="gi gc"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi gc"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g4', label: 'Gallery Photo 4 — Bottom wide',
        desc: 'Wide gallery photo at the bottom, spans 2 columns',
        extract: function(h) { var m = h.match(/<div class="gi gd"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi gd"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g5', label: 'Gallery Photo 5 — Bottom middle',
        desc: 'Small gallery photo, bottom-middle area',
        extract: function(h) { var m = h.match(/<div class="gi ge"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi ge"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    },
    {
        id: 'g6', label: 'Gallery Photo 6 — Bottom right',
        desc: 'Small gallery photo, bottom-right corner',
        extract: function(h) { var m = h.match(/<div class="gi gf"><img src="([^"]*)"/); return m ? m[1] : ''; },
        patch:   function(h, url) { return h.replace(/(<div class="gi gf"><img src=")[^"]*(")/g, '$1' + url + '$2'); }
    }
];

async function loadImagesTab() {
    var wrap = document.getElementById('imagesTabContent');
    if (!wrap) return;
    wrap.innerHTML = '<p style="color:#7B5EA7;padding:20px;text-align:center">Loading current images from site...</p>';

    var html;
    try { html = await readFileFromGitHub('studio.html'); }
    catch(e) { wrap.innerHTML = '<div style="background:#fdecea;border-radius:10px;padding:16px;color:#d32f2f">Failed to load: ' + e.message + '</div>'; return; }

    wrap.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px">' +
        IMAGE_SLOTS.map(function(slot) {
            var cur = slot.extract(html);
            var thumb = cur
                ? '<img src="' + escHtml(cur) + '" style="width:100%;height:160px;object-fit:cover;display:block">'
                : '<div style="width:100%;height:160px;background:#E8D5FF;display:flex;align-items:center;justify-content:center;color:#7B5EA7;font-size:12px;font-weight:700">No image set</div>';
            return [
                '<div style="background:#fff;border-radius:14px;overflow:hidden;border:2px solid #E8D5FF;box-shadow:0 2px 12px rgba(61,32,96,.08)">',
                  '<div style="position:relative">',
                    '<div style="position:absolute;top:8px;left:8px;z-index:2;background:rgba(61,32,96,.82);color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.04em;text-transform:uppercase">Current</div>',
                    thumb,
                  '</div>',
                  '<div style="padding:14px">',
                    '<div style="font-size:13px;font-weight:800;color:#3D2060;margin-bottom:3px">' + escHtml(slot.label) + '</div>',
                    '<div style="font-size:11px;color:#7B5EA7;margin-bottom:12px;line-height:1.5">' + escHtml(slot.desc) + '</div>',
                    // Preview of new image (hidden until file chosen)
                    '<div id="npwrap_' + slot.id + '" style="display:none;margin-bottom:10px;position:relative;border-radius:8px;overflow:hidden">',
                      '<div style="position:absolute;top:6px;left:6px;z-index:2;background:rgba(46,125,50,.85);color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;letter-spacing:.04em;text-transform:uppercase">New</div>',
                      '<img id="npimg_' + slot.id + '" style="width:100%;height:120px;object-fit:cover;display:block">',
                    '</div>',
                    '<label style="display:block;padding:10px;background:#f5f0ff;border:2px dashed #C9B8FF;border-radius:8px;cursor:pointer;text-align:center;font-size:12px;font-weight:700;color:#5B3090;margin-bottom:8px">',
                      '<input type="file" id="fi_' + slot.id + '" accept="image/*" style="display:none" onchange="previewImg(\'' + slot.id + '\')">',
                      '📁 Choose New Photo',
                    '</label>',
                    '<button onclick="replaceImg(\'' + slot.id + '\')" style="width:100%;padding:10px;background:linear-gradient(135deg,#3D2060,#5B3090);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">Replace on Site →</button>',
                  '</div>',
                '</div>'
            ].join('');
        }).join('') + '</div>';
}

function previewImg(slotId) {
    var file = document.getElementById('fi_' + slotId).files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('npimg_' + slotId).src = e.target.result;
        document.getElementById('npwrap_' + slotId).style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function replaceImg(slotId) {
    var fileEl = document.getElementById('fi_' + slotId);
    var file = fileEl && fileEl.files[0];
    if (!file) { showNotification('Choose a photo first.', 'error'); return; }

    var slot = IMAGE_SLOTS.find(function(s) { return s.id === slotId; });
    if (!slot) return;

    showNotification('Uploading photo...', 'loading');
    try {
        var b64 = await new Promise(function(res, rej) {
            var r = new FileReader();
            r.onload = function(e) { res(e.target.result.split(',')[1]); };
            r.onerror = rej;
            r.readAsDataURL(file);
        });
        var ext = file.name.split('.').pop().toLowerCase();
        var imgPath = 'images/' + slotId + '-' + Date.now() + '.' + ext;

        await commitToGitHub(imgPath, b64, 'Admin: upload ' + slot.label, true);
        showNotification('Photo uploaded, updating page...', 'loading');

        var html = await readFileFromGitHub('studio.html');
        var updated = slot.patch(html, '/' + imgPath);
        await commitToGitHub('studio.html', updated, 'Admin: replace ' + slot.label);

        showNotification(slot.label + ' replaced! Site updates in ~1 min.', 'success');
        loadImagesTab();
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

// ============================================================
// CONTENT SECTIONS — all editable text on studio.html
// ============================================================
var CONTENT_SECTIONS = [
    {
        id: 'hero', title: '🌟 Hero Section',
        fields: [
            { id:'hero_badge', label:'Badge Text', type:'text',
              get: function(h) { return (matchAll(h,'<div class="chip">([\\s\\S]*?)<\\/div>')[0]||'').trim(); },
              set: function(h,v) { return replaceNth(h,'<div class="chip">([\\s\\S]*?)<\\/div>',0,v); } },
            { id:'hero_h1', label:'Headline (HTML allowed: &lt;br&gt; &lt;em&gt;)', type:'textarea', rows:2,
              get: function(h) { return (matchAll(h,'<h1>([\\s\\S]*?)<\\/h1>')[0]||'').trim(); },
              set: function(h,v) { return replaceNth(h,'<h1>([\\s\\S]*?)<\\/h1>',0,v); } },
            { id:'hero_sub', label:'Hero Subtitle Paragraph', type:'textarea', rows:3,
              get: function(h) { return (matchAll(h,'<p class="hero-sub">([\\s\\S]*?)<\\/p>')[0]||'').trim(); },
              set: function(h,v) { return replaceNth(h,'<p class="hero-sub">([\\s\\S]*?)<\\/p>',0,v); } },
            { id:'stat1_n', label:'Stat 1 — Number (e.g. 15+)', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>')[0]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>',0,v); } },
            { id:'stat1_l', label:'Stat 1 — Label (e.g. Years Experience)', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>')[0]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>',0,v); } },
            { id:'stat2_n', label:'Stat 2 — Number', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>')[1]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>',1,v); } },
            { id:'stat2_l', label:'Stat 2 — Label', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>')[1]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>',1,v); } },
            { id:'stat3_n', label:'Stat 3 — Number', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>')[2]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-n">([\\s\\S]*?)<\\/div>',2,v); } },
            { id:'stat3_l', label:'Stat 3 — Label', type:'text',
              get: function(h) { return matchAll(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>')[2]||''; },
              set: function(h,v) { return replaceNth(h,'<div class="hstat-l">([\\s\\S]*?)<\\/div>',2,v); } }
        ]
    },
    {
        id: 'services', title: '✂️ Services (6 Cards)',
        fields: (function() {
            var names = ['Hand Scissor Haircuts','Full Grooming Package','Bath & Brush','Nail Trimming','Daycare','Groomer Training'];
            var out = [];
            for (var i = 0; i < 6; i++) {
                (function(n) {
                    out.push(
                        { id:'svc_t'+n, label:'Service '+(n+1)+' ('+names[n]+') — Title', type:'text',
                          get: function(h) { return matchAll(h,'<h3>([\\s\\S]*?)<\\/h3>')[n]||''; },
                          set: function(h,v) { return replaceNth(h,'<h3>([\\s\\S]*?)<\\/h3>',n,v); } },
                        { id:'svc_d'+n, label:'Service '+(n+1)+' — Description', type:'textarea', rows:3,
                          get: function(h) { return matchAll(h,'<h3>[\\s\\S]*?<\\/h3>\\s*<p>([\\s\\S]*?)<\\/p>')[n]||''; },
                          set: function(h,v) { return replaceNth(h,'<h3>[\\s\\S]*?<\\/h3>\\s*<p>([\\s\\S]*?)<\\/p>',n,v); } },
                        { id:'svc_p'+n, label:'Service '+(n+1)+' — Price Tag', type:'text',
                          get: function(h) { return matchAll(h,'<div class="svc-price">([\\s\\S]*?)<\\/div>')[n]||''; },
                          set: function(h,v) { return replaceNth(h,'<div class="svc-price">([\\s\\S]*?)<\\/div>',n,v); } }
                    );
                })(i);
            }
            return out;
        })()
    },
    {
        id: 'about', title: '🐾 About Section',
        fields: (function() {
            var out = [
                { id:'about_h', label:'Headline (HTML allowed)', type:'textarea', rows:2,
                  get: function(h) { return (matchAll(h,'<h2 class="stitle about-headline">([\\s\\S]*?)<\\/h2>')[0]||'').trim(); },
                  set: function(h,v) { return replaceNth(h,'<h2 class="stitle about-headline">([\\s\\S]*?)<\\/h2>',0,v); } },
                { id:'about_p1', label:'Paragraph 1', type:'textarea', rows:3,
                  get: function(h) { return (matchAllAfter(h,'class="about-text"','<p>([\\s\\S]*?)<\\/p>')[0]||'').trim(); },
                  set: function(h,v) { return replaceNthAfter(h,'class="about-text"','<p>([\\s\\S]*?)<\\/p>',0,v); } },
                { id:'about_p2', label:'Paragraph 2', type:'textarea', rows:3,
                  get: function(h) { return (matchAllAfter(h,'class="about-text"','<p>([\\s\\S]*?)<\\/p>')[1]||'').trim(); },
                  set: function(h,v) { return replaceNthAfter(h,'class="about-text"','<p>([\\s\\S]*?)<\\/p>',1,v); } }
            ];
            var ckLabels = ['Checklist Item 1','Checklist Item 2','Checklist Item 3','Checklist Item 4','Checklist Item 5'];
            for (var i = 0; i < 5; i++) {
                (function(n) {
                    out.push({ id:'ck'+n, label:ckLabels[n], type:'text',
                        get: function(h) { return (matchAll(h,'<div class="ck">✓<\\/div>([\\s\\S]*?)<\\/li>')[n]||'').trim(); },
                        set: function(h,v) { return replaceNth(h,'<div class="ck">✓<\\/div>([\\s\\S]*?)<\\/li>',n,v); } });
                })(i);
            }
            return out;
        })()
    },
    {
        id: 'testimonials', title: '⭐ Testimonials (3 Reviews)',
        fields: (function() {
            var out = [];
            var rnames = ['Sarah R.','Michael K.','Jessica L.'];
            for (var i = 0; i < 3; i++) {
                (function(n) {
                    out.push(
                        { id:'rv_q'+n, label:'Review '+(n+1)+' ('+rnames[n]+') — Quote', type:'textarea', rows:3,
                          get: function(h) { return (matchAll(h,'<p class="rv-text">([\\s\\S]*?)<\\/p>')[n]||'').trim(); },
                          set: function(h,v) { return replaceNth(h,'<p class="rv-text">([\\s\\S]*?)<\\/p>',n,v); } },
                        { id:'rv_n'+n, label:'Review '+(n+1)+' — Reviewer Name', type:'text',
                          get: function(h) { return matchAll(h,'<div class="rv-name">([\\s\\S]*?)<\\/div>')[n]||''; },
                          set: function(h,v) { return replaceNth(h,'<div class="rv-name">([\\s\\S]*?)<\\/div>',n,v); } },
                        { id:'rv_p'+n, label:'Review '+(n+1)+' — Pet Name & Breed', type:'text',
                          get: function(h) { return matchAll(h,'<div class="rv-pet">([\\s\\S]*?)<\\/div>')[n]||''; },
                          set: function(h,v) { return replaceNth(h,'<div class="rv-pet">([\\s\\S]*?)<\\/div>',n,v); } }
                    );
                })(i);
            }
            return out;
        })()
    },
    {
        id: 'faq', title: '❓ FAQ (6 Questions)',
        fields: (function() {
            var out = [];
            for (var i = 0; i < 6; i++) {
                (function(n) {
                    out.push(
                        { id:'faq_q'+n, label:'Question '+(n+1), type:'text',
                          get: function(h) { return (matchAll(h,'class="faq-q"[^>]*>([\\s\\S]*?)<div class="faq-arr">')[n]||'').trim(); },
                          set: function(h,v) { return replaceNth(h,'class="faq-q"[^>]*>([\\s\\S]*?)<div class="faq-arr">',n,v); } },
                        { id:'faq_a'+n, label:'Answer '+(n+1), type:'textarea', rows:3,
                          get: function(h) { return (matchAll(h,'<div class="faq-a">([\\s\\S]*?)<\\/div>')[n]||'').trim(); },
                          set: function(h,v) { return replaceNth(h,'<div class="faq-a">([\\s\\S]*?)<\\/div>',n,v); } }
                    );
                })(i);
            }
            return out;
        })()
    },
    {
        id: 'contact', title: '📞 Contact Info',
        fields: [
            { id:'ci_phone', label:'Phone Number', type:'text',
              get: function(h) { return (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[1]||'').trim(); },
              set: function(h,v) {
                var old = (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[1]||'').trim();
                return old ? h.split(old).join(v) : h; } },
            { id:'ci_email', label:'Email Address', type:'text',
              get: function(h) { return (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[2]||'').trim(); },
              set: function(h,v) {
                var old = (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[2]||'').trim();
                return old ? h.split(old).join(v) : h; } },
            { id:'ci_hours', label:'Business Hours', type:'text',
              get: function(h) { return (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[3]||'').trim(); },
              set: function(h,v) {
                var old = (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[3]||'').trim();
                return old ? h.split(old).join(v) : h; } },
            { id:'ci_addr', label:'Address (map section, HTML ok e.g. &lt;br&gt;)', type:'textarea', rows:2,
              get: function(h) { return (matchAll(h,'<div class="md-val">([\\s\\S]*?)<\\/div>')[0]||'').trim(); },
              set: function(h,v) { return replaceNth(h,'<div class="md-val">([\\s\\S]*?)<\\/div>',0,v); } }
        ]
    }
];

// ============================================================
// CONTENT TAB — accordion
// ============================================================
var CF_INPUT  = 'width:100%;padding:10px 12px;border:2px solid #E8D5FF;border-radius:8px;font-family:inherit;font-size:14px;box-sizing:border-box;';
var CF_LABEL  = 'display:block;font-weight:800;font-size:11px;color:#3D2060;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;';

async function loadContentTab() {
    var wrap = document.getElementById('contentEditorWrap');
    if (!wrap) return;
    wrap.innerHTML = '<p style="color:#7B5EA7;padding:20px;text-align:center">Loading content from site...</p>';

    var html;
    try { html = await readFileFromGitHub('studio.html'); }
    catch(e) { wrap.innerHTML = '<div style="background:#fdecea;border-radius:10px;padding:16px;color:#d32f2f">Failed to load: ' + e.message + '</div>'; return; }

    wrap.dataset.orig = html;

    wrap.innerHTML = CONTENT_SECTIONS.map(function(sec) {
        var fieldsHtml = sec.fields.map(function(f) {
            var val = f.get(html);
            var inp = f.type === 'textarea'
                ? '<textarea id="cf_' + f.id + '" rows="' + (f.rows || 2) + '" style="' + CF_INPUT + 'resize:vertical">' + escHtml(val) + '</textarea>'
                : '<input type="text" id="cf_' + f.id + '" value="' + escHtml(val) + '" style="' + CF_INPUT + '">';
            return '<div style="margin-bottom:13px"><label style="' + CF_LABEL + '">' + f.label + '</label>' + inp + '</div>';
        }).join('');

        return [
            '<div style="margin-bottom:6px">',
              '<button onclick="toggleSection(\'' + sec.id + '\')" style="width:100%;text-align:left;padding:13px 16px;background:#f5f0ff;border:2px solid #E8D5FF;border-radius:10px;cursor:pointer;font-weight:800;font-size:14px;color:#3D2060;display:flex;justify-content:space-between;align-items:center;font-family:inherit">',
                '<span>' + sec.title + '</span>',
                '<span id="cs_arr_' + sec.id + '">▾</span>',
              '</button>',
              '<div id="cs_' + sec.id + '" style="display:none;background:#fafafe;border:2px solid #E8D5FF;border-top:none;border-radius:0 0 10px 10px;padding:18px 16px">',
                fieldsHtml,
              '</div>',
            '</div>'
        ].join('');
    }).join('');

    // Open hero section by default
    toggleSection('hero');
}

function toggleSection(id) {
    var body = document.getElementById('cs_' + id);
    var arr  = document.getElementById('cs_arr_' + id);
    if (!body) return;
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (arr) arr.textContent = open ? '▾' : '▴';
}

async function updateContentOnWebsiteViaGitHub() {
    var wrap = document.getElementById('contentEditorWrap');
    if (!wrap || !wrap.dataset.orig) { showNotification('Click the Content tab first.', 'error'); return; }
    showNotification('Saving content to GitHub...', 'loading');
    try {
        var html = wrap.dataset.orig;
        CONTENT_SECTIONS.forEach(function(sec) {
            sec.fields.forEach(function(f) {
                var el = document.getElementById('cf_' + f.id);
                if (el && el.value) html = f.set(html, el.value);
            });
        });
        await commitToGitHub('studio.html', html, 'Admin: update site content');
        wrap.dataset.orig = html;
        showNotification('Content saved! Site updates in ~1 min.', 'success');
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

function saveAllContent() {
    showNotification('Click "Update Website" to push changes live.', 'success');
}

// ============================================================
// PRICING TAB
// ============================================================
var PRICING_KEYS   = ['bath_brush','bath_trim','full_groom','daycare'];
var PRICING_LABELS = ['Bath & Brush','Bath & Trim','Full Grooming','Daycare'];

async function loadPricingEditor() {
    var tbody = document.getElementById('pricingTable');
    if (!tbody) return;
    var html = '';
    try { html = await readFileFromGitHub('studio.html'); } catch(e) {}
    var prices = matchAll(html, '<div class="pc-amt">\\$([^<]+)<\\/div>');
    tbody.innerHTML = PRICING_KEYS.map(function(key, i) {
        return '<tr>' +
            '<td style="padding:10px;font-weight:700;color:#3D2060">' + PRICING_LABELS[i] + '</td>' +
            '<td style="padding:10px"><div style="display:flex;align-items:center;gap:6px">' +
            '<span style="font-size:18px;font-weight:700;color:#3D2060">$</span>' +
            '<input type="number" id="price_' + key + '" value="' + (prices[i] || '') + '" style="width:90px;padding:8px;border:2px solid #E8D5FF;border-radius:8px;font-size:16px;font-weight:700;color:#3D2060">' +
            '</div></td></tr>';
    }).join('');
    if (html) tbody.dataset.orig = html;
}

async function updatePricingOnWebsiteViaGitHub() {
    var tbody = document.getElementById('pricingTable');
    if (!tbody || !tbody.dataset.orig) { showNotification('Click the Pricing tab first.', 'error'); return; }
    showNotification('Saving pricing to GitHub...', 'loading');
    try {
        var html = tbody.dataset.orig;
        var i = 0;
        html = html.replace(/<div class="pc-amt">\$([^<]+)<\/div>/g, function(match) {
            var inp = document.getElementById('price_' + PRICING_KEYS[i++]);
            return (inp && inp.value.trim()) ? '<div class="pc-amt">$' + inp.value.trim() + '</div>' : match;
        });
        await commitToGitHub('studio.html', html, 'Admin: update pricing');
        tbody.dataset.orig = html;
        showNotification('Pricing saved! Site updates in ~1 min.', 'success');
    } catch(e) {
        showNotification('Error: ' + e.message, 'error');
    }
}

function savePricing() {
    showNotification('Click "Update Website" to push changes live.', 'success');
}

// ============================================================
// ANALYTICS TAB
// ============================================================
var SERVICE_PRICES = {
    'Bath & Brush': 60, 'Bath & Trim': 85,
    'Full Grooming': 100, 'Full Grooming Package': 100,
    'Hand Scissor Haircuts': 80, 'Nail Trimming': 20,
    'Daycare': 45, 'Groomer Training': 0
};

function estimatePrice(service) {
    if (!service) return 0;
    for (var key in SERVICE_PRICES) {
        if (service.indexOf(key) !== -1) return SERVICE_PRICES[key];
    }
    return 0;
}

async function loadAnalyticsTab() {
    var wrap = document.getElementById('analyticsContent');
    if (!wrap) return;
    wrap.innerHTML = '<p style="color:#7B5EA7;padding:20px;text-align:center">Loading analytics...</p>';

    var all = [];
    try {
        var snap = await db.ref('appointments').once('value');
        var raw = snap.val() || {};
        all = Object.values(raw);
    } catch(e) {
        wrap.innerHTML = '<div style="background:#fdecea;padding:16px;border-radius:10px;color:#d32f2f">Error loading data: ' + e.message + '</div>';
        return;
    }

    var now = new Date();
    var thisMonth = all.filter(function(a) {
        var d = new Date((a.date || '') + 'T00:00:00');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    // Status counts
    function countStatus(arr, status) {
        return arr.filter(function(a) { return (a.status || 'pending') === status; }).length;
    }

    var totalAll       = all.length;
    var completedAll   = countStatus(all, 'completed');
    var cancelledAll   = countStatus(all, 'cancelled');
    var pendingAll     = all.filter(function(a) { var s = a.status || 'pending'; return s === 'pending' || s === 'confirmed'; }).length;

    var totalMonth     = thisMonth.length;
    var completedMonth = countStatus(thisMonth, 'completed');
    var cancelledMonth = countStatus(thisMonth, 'cancelled');
    var pendingMonth   = thisMonth.filter(function(a) { var s = a.status || 'pending'; return s === 'pending' || s === 'confirmed'; }).length;

    // Revenue (completed only)
    function revenue(arr) {
        return arr.filter(function(a) { return a.status === 'completed'; })
            .reduce(function(sum, a) { return sum + estimatePrice(a.service); }, 0);
    }
    var revAll   = revenue(all);
    var revMonth = revenue(thisMonth);

    // Service breakdown (all time)
    var svcMap = {};
    all.forEach(function(a) {
        if (!a.service) return;
        svcMap[a.service] = (svcMap[a.service] || 0) + 1;
    });
    var svcRows = Object.entries(svcMap).sort(function(a,b) { return b[1]-a[1]; });

    // Recent bookings (last 8)
    var recent = all.slice().sort(function(a,b) {
        return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
    }).slice(0, 8);

    function statCard(emoji, label, value, sub, color) {
        return '<div style="background:#fff;border-radius:14px;padding:20px;border:2px solid #E8D5FF;text-align:center">' +
            '<div style="font-size:28px;margin-bottom:6px">' + emoji + '</div>' +
            '<div style="font-size:26px;font-weight:800;color:' + color + '">' + value + '</div>' +
            '<div style="font-size:12px;font-weight:700;color:#3D2060;margin:2px 0">' + label + '</div>' +
            '<div style="font-size:11px;color:#7B5EA7">' + sub + '</div>' +
            '</div>';
    }

    var monthName = now.toLocaleString('default', { month: 'long' });

    wrap.innerHTML = [
        // THIS MONTH header
        '<h3 style="color:#3D2060;margin-bottom:12px;font-size:15px;text-transform:uppercase;letter-spacing:.06em">📅 ' + monthName + ' ' + now.getFullYear() + '</h3>',
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">',
            statCard('📋', 'Total Bookings',   totalMonth,     'this month',      '#3D2060'),
            statCard('✅', 'Completed',         completedMonth, 'this month',      '#2E7D32'),
            statCard('⏳', 'Pending / Upcoming',pendingMonth,   'this month',      '#E65100'),
            statCard('❌', 'Cancelled',          cancelledMonth, 'this month',      '#C62828'),
            statCard('💰', 'Est. Revenue',       '$' + revMonth, 'completed apts',  '#1565C0'),
        '</div>',

        // ALL TIME header
        '<h3 style="color:#3D2060;margin-bottom:12px;font-size:15px;text-transform:uppercase;letter-spacing:.06em">🏆 All Time</h3>',
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">',
            statCard('📋', 'Total Bookings',   totalAll,     'all time',        '#3D2060'),
            statCard('✅', 'Completed',         completedAll, 'all time',        '#2E7D32'),
            statCard('❌', 'Cancelled',          cancelledAll, 'all time',        '#C62828'),
            statCard('💰', 'Est. Revenue',       '$' + revAll, 'completed apts',  '#1565C0'),
        '</div>',

        // SERVICE BREAKDOWN
        svcRows.length ? [
            '<h3 style="color:#3D2060;margin-bottom:12px;font-size:15px;text-transform:uppercase;letter-spacing:.06em">✂️ Service Breakdown (All Time)</h3>',
            '<div style="background:#fff;border-radius:14px;border:2px solid #E8D5FF;overflow:hidden;margin-bottom:24px">',
                svcRows.map(function(row, i) {
                    var pct = Math.round((row[1] / totalAll) * 100);
                    return '<div style="padding:12px 16px;' + (i % 2 === 0 ? 'background:#fafafe' : '') + ';display:flex;align-items:center;gap:12px">' +
                        '<div style="flex:1;font-size:13px;font-weight:700;color:#3D2060">' + row[0] + '</div>' +
                        '<div style="width:120px;height:8px;background:#E8D5FF;border-radius:4px;overflow:hidden">' +
                            '<div style="width:' + pct + '%;height:100%;background:#5B3090;border-radius:4px"></div>' +
                        '</div>' +
                        '<div style="width:50px;text-align:right;font-size:13px;font-weight:800;color:#5B3090">' + row[1] + 'x</div>' +
                        '</div>';
                }).join(''),
            '</div>'
        ].join('') : '',

        // RECENT BOOKINGS
        recent.length ? [
            '<h3 style="color:#3D2060;margin-bottom:12px;font-size:15px;text-transform:uppercase;letter-spacing:.06em">🕐 Recent Bookings</h3>',
            '<div style="background:#fff;border-radius:14px;border:2px solid #E8D5FF;overflow:hidden">',
                recent.map(function(a, i) {
                    var statusColor = { completed:'#2E7D32', cancelled:'#C62828', confirmed:'#1565C0', pending:'#E65100' };
                    var s = a.status || 'pending';
                    return '<div style="padding:12px 16px;' + (i % 2 === 0 ? 'background:#fafafe' : '') + ';display:flex;align-items:center;gap:12px;flex-wrap:wrap">' +
                        '<div style="flex:1;min-width:160px">' +
                            '<div style="font-size:13px;font-weight:700;color:#3D2060">' + (a.customerName || '—') + ' · ' + (a.petName || '—') + '</div>' +
                            '<div style="font-size:11px;color:#7B5EA7">' + (a.service || '—') + ' · ' + (a.date || '') + ' ' + (a.time || '') + '</div>' +
                        '</div>' +
                        '<div style="font-size:11px;font-weight:700;color:' + (statusColor[s] || '#3D2060') + ';text-transform:capitalize">' + s + '</div>' +
                        '</div>';
                }).join(''),
            '</div>'
        ].join('') : '',

        // RESET ANALYTICS (danger zone)
        '<div style="margin-top:32px;padding:18px;border:2px dashed #ffb3b3;border-radius:14px;background:#fff5f5">',
            '<h3 style="color:#a31515;margin:0 0 6px;font-size:14px;text-transform:uppercase;letter-spacing:.06em">⚠️ Reset analytics</h3>',
            '<p style="color:#7B5EA7;font-size:12px;margin:0 0 10px">Clears all appointments and resets every counter to zero. Cannot be undone.</p>',
            '<button type="button" onclick="resetAnalytics()" style="background:#c62828;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;font-family:inherit">🗑️ Reset all analytics</button>',
        '</div>'
    ].join('');
}

async function resetAnalytics() {
    if (!confirm('Reset ALL analytics?\n\nThis deletes every appointment in Firebase. All dashboards drop to zero. Customers and waivers are kept.\n\nContinue?')) return;
    if (!confirm('Final confirmation. Really wipe all appointments? There is no undo.')) return;
    try {
        await db.ref('appointments').remove();
        if (typeof showNotification === 'function') showNotification('Analytics reset. All appointments deleted.', 'success');
        loadAnalyticsTab();
    } catch (e) {
        alert('Reset failed: ' + e.message);
    }
}
