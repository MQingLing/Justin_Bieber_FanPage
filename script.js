// Simple modern interactions — no frameworks
(function(){
    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const playerWrap = document.getElementById('playerWrap');
    const trackCards = document.querySelectorAll('.track');
    const joinForm = document.getElementById('joinForm');
    const fanCard = document.getElementById('fanCard');
    const uploader = document.getElementById('uploader');
    const galleryGrid = document.getElementById('galleryGrid');
    const clearBtn = document.getElementById('clearGallery');
    const slideshow = document.getElementById('slideshow');
  
    // ==== Helpers ====
    function safeLocalStorage(){
      try { const k='__t'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return localStorage; } catch { return null; }
    }
    const store = safeLocalStorage();
  
    // ==== Theme Toggle (persist) ====
    const savedTheme = (store && store.getItem('theme')) || 'dark';
    root.setAttribute('data-theme', savedTheme);
    if (themeToggle) {
      themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
      themeToggle.addEventListener('click', ()=>{
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        if (store) store.setItem('theme', next);
        themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
      });
    }
  
    // ==== Video Embed ====
    function embed(videoId){
      if (!playerWrap || !videoId) return;
      playerWrap.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
      iframe.loading = 'lazy';
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('title', 'Justin Bieber video');
      playerWrap.appendChild(iframe);
      playerWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const peachesBtn = document.getElementById('playPeaches');
    if (peachesBtn) peachesBtn.addEventListener('click', ()=> embed('tQ0yjYUFKAE'));
    trackCards.forEach(card => {
      const play = card.querySelector('.btn');
      if (play) play.addEventListener('click', ()=> embed(card.dataset.videoId));
    });
  
    // ==== Join Form / Fan Card ====
    function renderFanCard(data){
      if(!fanCard) return;
      if(!data){ fanCard.innerHTML = '<h3>Your Fan Card</h3><p class="dim">Fill the form to see your card.</p>'; return; }
      fanCard.innerHTML = `
        <h3>🎟️ ${escapeHtml(data.name)}</h3>
        <p class="dim">Belieber since today</p>
        <p><strong>Favourite:</strong> ${escapeHtml(data.song || '—')}</p>
      `;
    }
    if (joinForm) {
      joinForm.addEventListener('submit', e => {
        e.preventDefault();
        const data = { name: document.getElementById('fanName').value.trim(), song: document.getElementById('favSong').value.trim() };
        if (store) store.setItem('fan_card', JSON.stringify(data));
        renderFanCard(data);
      });
    }
    try { renderFanCard(store ? JSON.parse(store.getItem('fan_card')) : null); } catch { renderFanCard(null); }
  
    // ==== Slideshow (prefers /img folder) ====
    // Priority: discovered /img files > window.JB_IMAGES > uploaded gallery > fallback
    async function getSlideSourcesAsync(){
      // 1) Try discovering files that actually exist in /img
      const discovered = await discoverFromImgFolder();
      if (discovered.length) return discovered;
  
      // 2) If developer provided a manual list
      if (Array.isArray(window.JB_IMAGES) && window.JB_IMAGES.length) return window.JB_IMAGES.map(toImgPath);
  
      // 3) Else use uploaded gallery if any
      if (store) {
        try { const saved = JSON.parse(store.getItem('gallery')||'[]'); if (saved.length) return saved; } catch {}
      }
  
      // 4) Fallback single image
      return ['img/justin4_720.jpg'];
    }
  
    function toImgPath(p){ return /^img\//.test(p) ? p : 'img/' + p; }
  
    // Discover by checking a few common filename patterns + optional manifest.json
    async function discoverFromImgFolder(){
      const out = new Set();
  
      // a) Try manifest.json if user created it
      try {
        const res = await fetch('img/manifest.json', { cache: 'no-store' });
        if (res.ok) {
          const arr = await res.json();
          arr.forEach(p => out.add(toImgPath(p)));
        }
      } catch {}
  
      // b) Always include known file if present
      await tryAdd('img/justin4_720.jpg', out);
  
      // c) Guess common patterns (kept small to avoid spam)
      const bases = ['justin','jb','bieber'];
      const exts = ['jpg','jpeg','png','webp'];
      const nums = Array.from({length: 20}, (_,i)=> i+1); // 1..20
      const candidates = [];
      for (const b of bases){ for (const n of nums){ for (const e of exts){ candidates.push(`img/${b}${n}.${e}`); } } }
  
      // Test candidates concurrently but capped batch size to be gentle
      const batchSize = 25;
      for (let i=0; i<candidates.length; i+=batchSize){
        const batch = candidates.slice(i, i+batchSize).map(p => tryAdd(p, out));
        await Promise.all(batch);
        if (out.size >= 6) break; // we already have a nice mix; stop early
      }
  
      return Array.from(out);
    }
  
    function tryAdd(src, set){
      return new Promise(resolve=>{
        const img = new Image();
        const done = (ok)=>{ if (ok) set.add(src); resolve(); };
        img.onload = ()=> done(true);
        img.onerror = ()=> done(false);
        img.src = src + (src.includes('?') ? '' : `?v=${Date.now()%1e6}`); // bust cache
      });
    }
  
    let slideTimer = null;
    async function buildSlideshow(){
      if (!slideshow) return;
      const sources = await getSlideSourcesAsync();
      slideshow.innerHTML = '';
      sources.forEach((src, i)=>{
        const d = document.createElement('div'); d.className = 'slide' + (i===0?' active':'');
        const img = document.createElement('img'); img.src = src; img.alt = 'Justin Bieber photo';
        d.appendChild(img); slideshow.appendChild(d);
      });
      startSlideshow();
    }
  
    function startSlideshow(){
      if (!slideshow) return;
      const slides = slideshow.querySelectorAll('.slide');
      if (!slides.length) return;
      clearInterval(slideTimer);
      let idx = 0;
      slideTimer = setInterval(()=>{
        slides[idx].classList.remove('active');
        idx = (idx+1) % slides.length;
        slides[idx].classList.add('active');
      }, 1000); // change every second
  
      slideshow.onmouseenter = () => clearInterval(slideTimer);
      slideshow.onmouseleave = () => startSlideshow();
      document.addEventListener('visibilitychange', ()=>{ if (document.hidden) clearInterval(slideTimer); else startSlideshow(); });
    }
  
    // ==== Gallery (persist) ====
    function addImage(src){
      if(!galleryGrid || !src) return;
      const wrap = document.createElement('div');
      wrap.className = 'item';
      const img = document.createElement('img');
      img.src = src; img.alt = 'Fan photo';
      wrap.appendChild(img);
      galleryGrid.prepend(wrap);
    }
    if (uploader) {
      uploader.addEventListener('change', async (e)=>{
        const files = [...e.target.files].slice(0, 12);
        const saved = store ? (JSON.parse(store.getItem('gallery')||'[]')) : [];
        for(const f of files){
          const src = await fileToDataURL(f);
          saved.push(src); addImage(src);
        }
        if (store) store.setItem('gallery', JSON.stringify(saved));
        uploader.value = '';
        buildSlideshow(); // refresh slides when new images are added
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', ()=>{ if (store) store.removeItem('gallery'); if (galleryGrid) galleryGrid.innerHTML=''; buildSlideshow(); });
    try { (store ? (JSON.parse(store.getItem('gallery'))||[]) : []).forEach(addImage); } catch {}
  
    // Init slideshow once page loads previous images
    buildSlideshow();
  
    // Utils
    function fileToDataURL(file){ return new Promise(res=>{ const r = new FileReader(); r.onload = ()=> res(r.result); r.readAsDataURL(file); }); }
    function escapeHtml(s){ return s.replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  })();
