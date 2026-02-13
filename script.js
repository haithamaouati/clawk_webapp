const Onyx = {
    state: { data: null, countries: new Map(), languages: new Map() },
    proxy: "https://corsproxy.io/?"
};

async function init() {
    try {
        const [c, l] = await Promise.all([fetch('countries.json'), fetch('languages.json')]);
        (await c.json()).forEach(x => Onyx.state.countries.set(x.code.toUpperCase(), x));
        (await l.json()).forEach(x => Onyx.state.languages.set(x.code.toLowerCase(), x.name));
    } catch (e) { console.warn("INIT_ERR"); }
}

const nF = (n) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n || 0);
const tF = (ts) => ts ? new Date(ts * 1000).toLocaleDateString('en-GB', { dateStyle: 'medium' }).toUpperCase() : 'N/A';

window.copyText = (elementId) => {
    const text = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(text);
    const btn = event.target;
    btn.innerText = "COPIED";
    setTimeout(() => { btn.innerText = "COPY"; }, 1000);
};

async function fetchUser(u) {
    const res = await fetch(Onyx.proxy + encodeURIComponent(`https://www.tiktok.com/@${u}`));
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
    Onyx.state.data = payload;
    document.getElementById('app-content').classList.remove('hidden');
    
    document.getElementById('u-avatar').src = user.avatarLarger;
    document.getElementById('u-nickname').textContent = user.nickname.toUpperCase();
    document.getElementById('u-handle').textContent = `@${user.uniqueId}`;
    document.getElementById('u-bio').textContent = user.signature || "NO_BIO_PROVIDED";
    
    const country = Onyx.state.countries.get(user.region?.toUpperCase());
    document.getElementById('u-region-val').textContent = country ? `${country.emoji} ${country.name.toUpperCase()} (${country.code})` : `REGION: ${user.region || '??'}`;
    document.getElementById('u-lang-val').textContent = (Onyx.state.languages.get(user.language?.toLowerCase()) || user.language || 'DEF').toUpperCase();

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
}

document.getElementById('search-btn').addEventListener('click', async () => {
    const u = document.getElementById('username-input').value.trim().replace('@', '');
    if (!u) return;
    const btn = document.getElementById('search-btn');
    btn.textContent = "...";
    try { render(await fetchUser(u)); } 
    catch (e) { alert(e.message); }
    finally { btn.textContent = "FETCH DATA"; }
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

document.getElementById('dl-json').addEventListener('click', () => {
    if (!Onyx.state.data) return;
    const blob = new Blob([JSON.stringify(Onyx.state.data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eyas_${Onyx.state.data.user.uniqueId}.json`;
    a.click();
});

window.onload = init;
