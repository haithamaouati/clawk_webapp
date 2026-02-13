const Eyas = {
    state: { data: null, countries: new Map(), languages: new Map() },
    proxy: "https://corsproxy.io/?",
    worldMap: null,
    defaultViewBox: null,
    isPanning: false,
    startPoint: { x: 0, y: 0 },
    viewBox: { x: 0, y: 0, w: 0, h: 0 }
};

async function init() {
    try {
        const [c, l, m] = await Promise.all([
            fetch('countries.json'), 
            fetch('languages.json'),
            fetch('world.svg')
        ]);
        
        (await c.json()).forEach(x => Eyas.state.countries.set(x.code.toUpperCase(), x));
        (await l.json()).forEach(x => Eyas.state.languages.set(x.code.toLowerCase(), x.name));
        
        const svgText = await m.text();
        const wrapper = document.getElementById('world-map-wrapper');
        wrapper.innerHTML = svgText;
        Eyas.worldMap = wrapper.querySelector('svg');
        
        const vb = Eyas.worldMap.getAttribute('viewBox').split(' ').map(Number);
        Eyas.defaultViewBox = Eyas.worldMap.getAttribute('viewBox');
        Eyas.viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };

        setupMapInteractions(wrapper);
    } catch (e) { }
}

function setupMapInteractions(wrapper) {
    const handleStart = (clientX, clientY) => {
        Eyas.isPanning = true;
        Eyas.startPoint = { x: clientX, y: clientY };
    };

    const handleMove = (clientX, clientY) => {
        if (!Eyas.isPanning) return;
        const dx = (clientX - Eyas.startPoint.x) * (Eyas.viewBox.w / wrapper.clientWidth);
        const dy = (clientY - Eyas.startPoint.y) * (Eyas.viewBox.h / wrapper.clientHeight);
        Eyas.viewBox.x -= dx;
        Eyas.viewBox.y -= dy;
        updateSVGViewBox();
        Eyas.startPoint = { x: clientX, y: clientY };
    };

    const handleEnd = () => { Eyas.isPanning = false; };

    wrapper.addEventListener('mousedown', e => handleStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleEnd);

    wrapper.addEventListener('touchstart', e => {
        if (e.touches.length === 1) handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    
    window.addEventListener('touchmove', e => {
        if (Eyas.isPanning && e.touches.length === 1) {
            e.preventDefault();
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchend', handleEnd);
}

function updateSVGViewBox() {
    Eyas.worldMap.setAttribute('viewBox', `${Eyas.viewBox.x} ${Eyas.viewBox.y} ${Eyas.viewBox.w} ${Eyas.viewBox.h}`);
}

function adjustZoom(delta) {
    const factor = delta > 0 ? 0.8 : 1.2;
    const nw = Eyas.viewBox.w * factor;
    const nh = Eyas.viewBox.h * factor;
    Eyas.viewBox.x += (Eyas.viewBox.w - nw) / 2;
    Eyas.viewBox.y += (Eyas.viewBox.h - nh) / 2;
    Eyas.viewBox.w = nw;
    Eyas.viewBox.h = nh;
    updateSVGViewBox();
}

function zoomToCountry(code) {
    if (!Eyas.worldMap || !code) return;
    const cleanCode = code.toUpperCase();
    const target = Eyas.worldMap.getElementById(cleanCode) || Eyas.worldMap.querySelector(`[id="${cleanCode}"]`);
    document.querySelectorAll('.country-active').forEach(p => p.classList.remove('country-active'));

    if (target) {
        target.classList.add('country-active');
        const country = Eyas.state.countries.get(cleanCode);
        const label = country ? `${country.name.toUpperCase()} (${cleanCode})` : cleanCode;
        document.getElementById('active-country-label').textContent = `FOCUS_LOCKED: ${label}`;
        const bbox = target.getBBox();
        const pad = 30;
        Eyas.viewBox = { x: bbox.x - pad, y: bbox.y - pad, w: bbox.width + pad * 2, h: bbox.height + pad * 2 };
        updateSVGViewBox();
    }
}

const nF = (n) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n || 0);
const tF = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { dateStyle: 'medium' }).toUpperCase() : 'N/A';

async function fetchUser(u) {
    const res = await fetch(Eyas.proxy + encodeURIComponent(`https://www.tiktok.com/@${u}`));
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const scripts = Array.from(doc.querySelectorAll('script'));
    let data = null;
    for (let s of scripts) {
        try {
            const json = JSON.parse(s.textContent);
            data = json?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo || json?.userInfo;
            if (data) break;
        } catch {}
    }
    if (!data) throw new Error("USER_NOT_FOUND");
    return data;
}

function render(payload) {
    const { user, stats } = payload;
    Eyas.state.data = payload;
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('u-avatar').src = user.avatarLarger;
    document.getElementById('u-nickname').textContent = (user.nickname || user.uniqueId).toUpperCase();
    document.getElementById('u-handle').textContent = `@${user.uniqueId}`;
    document.getElementById('u-bio').textContent = user.signature || "NO_BIO_PROVIDED";
    const country = Eyas.state.countries.get(user.region?.toUpperCase());
    document.getElementById('u-region-val').textContent = country ? `${country.emoji} ${country.name.toUpperCase()} (${country.code})` : user.region;
    document.getElementById('u-lang-val').textContent = (Eyas.state.languages.get(user.language?.toLowerCase()) || user.language || 'N/A').toUpperCase();
    document.getElementById('s-followers').textContent = nF(stats.followerCount);
    document.getElementById('s-following').textContent = nF(stats.followingCount);
    document.getElementById('s-hearts').textContent = nF(stats.heartCount);
    document.getElementById('s-videos').textContent = nF(stats.videoCount);
    document.getElementById('s-friends').textContent = nF(stats.friendCount);
    document.getElementById('d-userid').textContent = user.id;
    document.getElementById('d-verified').textContent = user.verified ? "TRUE" : "FALSE";
    document.getElementById('d-private').textContent = user.privateAccount ? "TRUE" : "FALSE";
    document.getElementById('d-created').textContent = tF(user.createTime);
    document.getElementById('d-secuid').textContent = user.secUid;
    document.getElementById('u-link').href = `https://www.tiktok.com/@${user.uniqueId}`;
    zoomToCountry(user.region);
}

document.getElementById('search-btn').addEventListener('click', async () => {
    const u = document.getElementById('username-input').value.trim().replace('@', '');
    if (!u) return;
    const btn = document.getElementById('search-btn');
    btn.textContent = "...";
    try { render(await fetchUser(u)); } 
    catch (e) { alert(`ERROR: ${e.message}`); }
    finally { btn.textContent = "FETCH DATA"; }
});

document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('username-input').value = "";
    document.getElementById('app-content').classList.add('hidden');
    Eyas.state.data = null;
    const vb = Eyas.defaultViewBox.split(' ').map(Number);
    Eyas.viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
    updateSVGViewBox();
    document.querySelectorAll('.country-active').forEach(p => p.classList.remove('country-active'));
    document.getElementById('active-country-label').textContent = "LOCATION: NONE";
});

document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(1));
document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-1));
document.getElementById('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

document.getElementById('dl-json').addEventListener('click', () => {
    if (!Eyas.state.data) return;
    const blob = new Blob([JSON.stringify(Eyas.state.data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eyas_${Eyas.state.data.user.uniqueId}.json`;
    a.click();
});

window.copyText = (id) => {
    navigator.clipboard.writeText(document.getElementById(id).innerText);
    const btn = event.target;
    btn.innerText = "COPIED";
    setTimeout(() => { btn.innerText = "COPY"; }, 1000);
};

window.onload = init;
