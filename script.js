(function(){

  var FONTS = [
    {label:"Fraunces", value:"'Fraunces', serif"},
    {label:"Playfair Display", value:"'Playfair Display', serif"},
    {label:"Cormorant Garamond", value:"'Cormorant Garamond', serif"},
    {label:"DM Serif Display", value:"'DM Serif Display', serif"},
    {label:"Space Grotesk", value:"'Space Grotesk', sans-serif"},
    {label:"Manrope", value:"'Manrope', sans-serif"},
    {label:"Archivo", value:"'Archivo', sans-serif"},
    {label:"Sora", value:"'Sora', sans-serif"},
    {label:"Caveat", value:"'Caveat', cursive"},
    {label:"Kalam", value:"'Kalam', cursive"},
    {label:"Permanent Marker", value:"'Permanent Marker', cursive"},
    {label:"Shadows Into Light", value:"'Shadows Into Light', cursive"},
    {label:"Space Mono", value:"'Space Mono', monospace"},
    {label:"JetBrains Mono", value:"'JetBrains Mono', monospace"},
    {label:"Bebas Neue", value:"'Bebas Neue', sans-serif"},
    {label:"Unbounded", value:"'Unbounded', sans-serif"},
    {label:"Righteous", value:"'Righteous', cursive"}
  ];

  var COLOR_PRESETS = ["#E7DCC8","#C9502F","#3452EB","#1D9E75","#211F1B","#F2C879","#D4537E","#5F5E5A","#97C459","#7F77DD"];

  // ---------- FONT CATALOG (1800+ Google Fonts, chargées à la demande) ----------
  var FONT_FALLBACK = {S:'sans-serif', R:'serif', D:'sans-serif', H:'cursive', M:'monospace'};
  var FONT_CAT_LABEL = {S:'Sans', R:'Serif', D:'Display', H:'Manuscrite', M:'Monospace'};
  var favoriteNames = FONTS.map(function(f){ return f.label; });
  var loadedFontLinks = {};

  function fontValueFor(family, cat){
    return "'" + family + "', " + (FONT_FALLBACK[cat] || 'sans-serif');
  }

  // Catalogue complet: favoris épinglés en tête, puis le reste trié par popularité
  var FULL_FONTS = FONTS.slice();
  (window.GOOGLE_FONTS_FULL || []).forEach(function(entry){
    var family = entry[0], cat = entry[1];
    if(favoriteNames.indexOf(family) !== -1) return;
    FULL_FONTS.push({label: family, value: fontValueFor(family, cat), cat: cat});
  });

  function ensureFontLoaded(family){
    if(!family || loadedFontLinks[family]) return;
    loadedFontLinks[family] = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g,'+') + ':wght@400;700&display=swap';
    document.head.appendChild(link);
  }
  // les favoris sont déjà chargés via le <link> statique de index.html
  favoriteNames.forEach(function(n){ loadedFontLinks[n] = true; });

  function extractFamily(fontValue){
    var m = /^'([^']+)'/.exec(fontValue || '');
    return m ? m[1] : '';
  }

  var state = {
    user: null,
    board: null,
    selectedId: null,
    savedSnapshot: null
  };

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function showScreen(name){
    $all('.screen').forEach(function(s){ s.classList.remove('active'); });
    $('#screen-' + name).classList.add('active');
  }

  function toast(msg){
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, 2200);
  }

  // ---------- MODAL ----------
  function openModal(html, onMount){
    $('#modal-box').innerHTML = html;
    $('#modal-overlay').classList.add('active');
    if(onMount) onMount($('#modal-box'));
  }
  function closeModal(){
    $('#modal-overlay').classList.remove('active');
    $('#modal-box').innerHTML = '';
  }
  $('#modal-overlay').addEventListener('click', function(e){
    if(e.target === $('#modal-overlay')) closeModal();
  });

  function confirmModal(title, desc, confirmLabel, onConfirm){
    openModal(
      '<h3>'+title+'</h3><p>'+desc+'</p>' +
      '<div class="modal-actions"><button class="btn" id="m-cancel">Annuler</button>' +
      '<button class="btn btn-primary" id="m-confirm">'+confirmLabel+'</button></div>'
    , function(box){
      box.querySelector('#m-cancel').addEventListener('click', closeModal);
      box.querySelector('#m-confirm').addEventListener('click', function(){ closeModal(); onConfirm(); });
    });
  }

  // ---------- SUPABASE CONFIG ----------
  // Remplace ces deux valeurs par celles de Project Settings > API dans Supabase
  var SUPABASE_URL = 'https://ajvklowhtodenkpxalir.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqdmtsb3dodG9kZW5rcHhhbGlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzIyNzYzMCwiZXhwIjoyMTAyODAzNjMwfQ.xrv5oZFHUqmzS1H4tjuNHUZYzvsc9aMmF-za8Uv6eyI';
  var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  // ---------- AUTH ----------
  function showAuthError(msg){
    var el = $('#auth-error');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  var authMode = 'login';

  function setAuthMode(mode){
    authMode = mode;
    showAuthError('');
    $('#auth-password').value = '';
    $('#auth-password-confirm').value = '';
    if(mode === 'signup'){
      $('#auth-confirm-wrap').style.display = 'block';
      $('#auth-password').setAttribute('autocomplete', 'new-password');
      $('#btn-auth-submit').textContent = 'Valider';
      $('#btn-auth-toggle').textContent = 'Déjà un compte ? Se connecter';
      $('#auth-hint').textContent = 'Ton mot de passe est géré par Supabase, jamais stocké en clair.';
    } else {
      $('#auth-confirm-wrap').style.display = 'none';
      $('#auth-password').setAttribute('autocomplete', 'current-password');
      $('#btn-auth-submit').textContent = 'Se connecter';
      $('#btn-auth-toggle').textContent = 'Créer un compte';
      $('#auth-hint').textContent = '';
    }
  }

  function renderAuthScreen(mode){
    $('#auth-email').value = '';
    setAuthMode(mode || 'login');
  }

  async function initApp(){
    var session = await supabase.auth.getSession();
    if(session.data.session){
      login(session.data.session.user);
    } else {
      showScreen('landing');
    }
  }

  $('#btn-landing-cta').addEventListener('click', function(){
    createNewBoard();
  });
  $('#landing-login-link').addEventListener('click', function(){
    showScreen('auth');
    renderAuthScreen('login');
  });
  $('#btn-auth-back').addEventListener('click', function(){
    showScreen('landing');
  });

  async function login(user){
    state.user = user;
    $('#who-label').textContent = user.email;
    showScreen('dashboard');
    await renderDashboard();
  }

  $('#btn-auth-toggle').addEventListener('click', function(){
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });

  $('#btn-auth-submit').addEventListener('click', async function(){
    var email = $('#auth-email').value.trim();
    var password = $('#auth-password').value;

    if(authMode === 'login'){
      if(!email || !password){
        showAuthError('Entre ton email et ton mot de passe.');
        return;
      }
      showAuthError('');
      var res = await supabase.auth.signInWithPassword({ email: email, password: password });
      if(res.error){ showAuthError(res.error.message); return; }
      login(res.data.session.user);
      return;
    }

    var confirmPassword = $('#auth-password-confirm').value;
    if(!email || password.length < 6){
      showAuthError('Entre un email et un mot de passe de 6 caractères minimum.');
      return;
    }
    if(password !== confirmPassword){
      showAuthError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    showAuthError('');
    var res = await supabase.auth.signUp({ email: email, password: password });
    if(res.error){ showAuthError(res.error.message); return; }
    if(res.data.session){
      login(res.data.session.user);
    } else {
      toast('Compte créé. Vérifie ta boîte mail pour confirmer, puis connecte-toi.');
      setAuthMode('login');
    }
  });

  $('#btn-logout').addEventListener('click', async function(){
    await supabase.auth.signOut();
    state.user = null;
    $('#auth-email').value = '';
    $('#auth-password').value = '';
    showScreen('landing');
  });

  // ---------- DASHBOARD ----------
  async function loadBoardsIndex(){
    var res = await supabase
      .from('moodboards')
      .select('id, name, elements, updated_at')
      .order('updated_at', { ascending: false });
    if(res.error){ toast("Impossible de charger tes moodboards."); return []; }
    return res.data.map(function(b){
      var colors = (b.elements || []).filter(function(e){ return e.type === 'color'; }).map(function(e){ return e.hex; });
      return { id: b.id, name: b.name, updatedAt: new Date(b.updated_at).getTime(), elementCount: (b.elements||[]).length, colors: colors };
    });
  }

  async function renderDashboard(){
    var boards = await loadBoardsIndex();
    $('#project-count').textContent = boards.length + (boards.length > 1 ? ' moodboards' : ' moodboard');

    var grid = $('#projects-grid');
    var html = '<button class="card new-card" id="card-new"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Nouveau moodboard</span></button>';

    html += boards.map(function(b){
      var swatches = (b.colors || []).slice(0,5).map(function(c){
        return '<div class="swatch-chip" style="background:'+c+'"></div>';
      }).join('');
      var date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : '';
      return '<div class="card" data-id="'+b.id+'">' +
        '<div class="card-preview">'+ (swatches || '<span class="card-preview-empty">tableau vide</span>') +'</div>' +
        '<div class="card-body"><p class="card-name">'+escapeHtml(b.name)+'</p><p class="card-date">'+ (b.elementCount||0) +' éléments · '+date+'</p></div>' +
        '<button class="btn-icon card-del" data-del="'+b.id+'" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>' +
        '</div>';
    }).join('');

    grid.innerHTML = html;

    $('#card-new').addEventListener('click', createNewBoard);
    $all('.card[data-id]').forEach(function(card){
      card.addEventListener('click', function(e){
        if(e.target.closest('[data-del]')) return;
        openBoard(card.getAttribute('data-id'));
      });
    });
    $all('[data-del]').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var id = btn.getAttribute('data-del');
        confirmModal('Supprimer ce moodboard ?', 'Cette action est définitive, le tableau et son contenu seront perdus.', 'Supprimer', async function(){
          var res = await supabase.from('moodboards').delete().eq('id', id);
          if(res.error){ toast("La suppression a échoué."); return; }
          toast('Moodboard supprimé.');
          renderDashboard();
        });
      });
    });
  }

  async function createNewBoard(){
    state.board = { id: null, name: 'Sans titre', elements: [], updatedAt: Date.now() };
    state.savedSnapshot = null;
    showScreen('editor');
    renderEditor();
  }

  async function openBoard(id){
    var res = await supabase.from('moodboards').select('id, name, elements, updated_at').eq('id', id).single();
    if(res.error){ toast("Impossible de charger ce moodboard."); return; }
    state.board = { id: res.data.id, name: res.data.name, elements: res.data.elements || [], updatedAt: new Date(res.data.updated_at).getTime() };
    state.savedSnapshot = JSON.stringify(state.board.elements);
    showScreen('editor');
    renderEditor();
  }

  function leaveEditor(){
    if(state.user){ showScreen('dashboard'); renderDashboard(); }
    else { showScreen('landing'); }
  }

  $('#btn-back').addEventListener('click', function(){
    if(hasUnsavedChanges()){
      confirmModal('Quitter sans enregistrer ?', 'Les modifications non enregistrées seront perdues.', 'Quitter', leaveEditor);
    } else {
      leaveEditor();
    }
  });

  function hasUnsavedChanges(){
    if(!state.board) return false;
    return JSON.stringify(state.board.elements) !== state.savedSnapshot;
  }

  // ---------- EDITOR ----------
  function renderEditor(){
    $('#board-name-input').value = state.board.name;
    $('#save-status').textContent = state.savedSnapshot ? 'enregistré' : 'non enregistré';
    state.selectedId = null;
    var canvas = $('#canvas');
    canvas.innerHTML = '';
    canvas.appendChild(buildEmptyHint());
    state.board.elements.forEach(renderElement);
    updateEmptyHint();
  }

  function buildEmptyHint(){
    var d = document.createElement('div');
    d.className = 'hint-empty';
    d.id = 'hint-empty';
    d.innerHTML = '<h3>Tableau vide</h3><p>Utilise la barre en bas pour épingler une image, un mot ou une couleur.</p>';
    return d;
  }
  function updateEmptyHint(){
    var hint = $('#hint-empty');
    if(hint) hint.style.display = state.board.elements.length ? 'none' : 'block';
  }

  $('#board-name-input').addEventListener('input', function(e){
    state.board.name = e.target.value || 'Sans titre';
    markDirty();
  });

  function markDirty(){
    $('#save-status').textContent = 'non enregistré';
  }

  // ---- element factory ----
  function addElement(type){
    var canvasW = 1600, canvasH = 1400;
    var baseX = 120 + Math.random()*400;
    var baseY = 100 + Math.random()*300;
    var rotation = (Math.random()*8 - 4).toFixed(1);
    var el = { id: uid(), type: type, x: baseX, y: baseY, rotation: parseFloat(rotation) };

    if(type === 'text'){
      el.w = 220; el.h = 130;
      el.content = 'Nouveau mot';
      el.font = FONTS[0].value;
      el.size = 22;
      el.color = '#211F1B';
    } else if(type === 'color'){
      el.w = 150; el.h = 150;
      el.hex = COLOR_PRESETS[Math.floor(Math.random()*COLOR_PRESETS.length)];
    } else if(type === 'image'){
      el.w = 220; el.h = 240;
      el.src = null;
    }
    state.board.elements.push(el);
    renderElement(el);
    updateEmptyHint();
    markDirty();
    selectElement(el.id);
    return el;
  }

  function getEl(id){
    return state.board.elements.find(function(e){ return e.id === id; });
  }

  function renderElement(data){
    var node = document.createElement('div');
    node.className = 'el';
    node.id = 'el-' + data.id;
    node.style.left = data.x + 'px';
    node.style.top = data.y + 'px';
    node.style.width = data.w + 'px';
    node.style.height = data.h + 'px';
    node.style.transform = 'rotate(' + data.rotation + 'deg)';

    var inner = '';
    if(data.type === 'image'){
      inner += '<div class="el-tape"></div>';
      inner += '<div class="el-frame"><div class="el-img-wrap">' +
        (data.src ? '<img src="'+data.src+'" alt="">' : '<div class="img-loading-placeholder">chargement...</div>') +
        '</div></div>';
    } else if(data.type === 'text'){
      ensureFontLoaded(extractFamily(data.font));
      inner += '<div class="el-pin"></div>';
      inner += '<div class="el-text-frame"><div class="el-text-content" contenteditable="true" style="font-family:'+data.font+';font-size:'+data.size+'px;color:'+data.color+';">'+escapeHtml(data.content)+'</div></div>';
    } else if(data.type === 'color'){
      inner += '<div class="el-pin"></div>';
      inner += '<div class="el-color-frame" style="background:'+data.hex+';"><span class="el-color-tag">#'+data.hex.replace('#','').toUpperCase()+'</span></div>';
    }
    inner += '<div class="resize-handle"></div>';
    node.innerHTML = inner;

    $('#canvas').appendChild(node);
    attachElementBehavior(node, data);
  }

  function refreshElementNode(data){
    var node = $('#el-' + data.id);
    if(!node) return;
    node.style.left = data.x + 'px';
    node.style.top = data.y + 'px';
    node.style.width = data.w + 'px';
    node.style.height = data.h + 'px';
    node.style.transform = 'rotate(' + data.rotation + 'deg)';
    if(data.type === 'image'){
      var img = node.querySelector('.el-img-wrap');
      img.innerHTML = data.src ? '<img src="'+data.src+'" alt="">' : '<div class="img-loading-placeholder">chargement...</div>';
    } else if(data.type === 'color'){
      var frame = node.querySelector('.el-color-frame');
      frame.style.background = data.hex;
      frame.querySelector('.el-color-tag').textContent = '#' + data.hex.replace('#','').toUpperCase();
    } else if(data.type === 'text'){
      ensureFontLoaded(extractFamily(data.font));
      var content = node.querySelector('.el-text-content');
      content.style.fontFamily = data.font;
      content.style.fontSize = data.size + 'px';
      content.style.color = data.color;
    }
  }

  function attachElementBehavior(node, data){
    var dragging = false, resizing = false;
    var startX, startY, startLeft, startTop, startW, startH;

    node.addEventListener('pointerdown', function(e){
      if(e.target.closest('.resize-handle')){
        resizing = true;
        node.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        startW = data.w; startH = data.h;
        e.stopPropagation();
        return;
      }
      if(e.target.closest('.el-toolbar')) return;
      if(e.target.isContentEditable) { selectElement(data.id); return; }
      dragging = true;
      node.classList.add('dragging');
      node.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startLeft = data.x; startTop = data.y;
      selectElement(data.id);
    });

    node.addEventListener('pointermove', function(e){
      if(dragging){
        var dx = e.clientX - startX, dy = e.clientY - startY;
        data.x = Math.max(0, startLeft + dx);
        data.y = Math.max(0, startTop + dy);
        node.style.left = data.x + 'px';
        node.style.top = data.y + 'px';
      } else if(resizing){
        var ddx = e.clientX - startX, ddy = e.clientY - startY;
        data.w = Math.max(80, startW + ddx);
        data.h = Math.max(80, startH + ddy);
        node.style.width = data.w + 'px';
        node.style.height = data.h + 'px';
      }
    });

    function endInteraction(e){
      if(dragging || resizing){
        markDirty();
        repositionToolbar(data.id);
      }
      dragging = false; resizing = false;
      node.classList.remove('dragging');
      try{ node.releasePointerCapture(e.pointerId); }catch(err){}
    }
    node.addEventListener('pointerup', endInteraction);
    node.addEventListener('pointercancel', endInteraction);

    if(data.type === 'text'){
      var contentEl = node.querySelector('.el-text-content');
      contentEl.addEventListener('input', function(){
        data.content = contentEl.textContent;
        markDirty();
      });
      contentEl.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    }
  }

  // ---- selection + contextual toolbar ----
  function selectElement(id){
    state.selectedId = id;
    $all('.el').forEach(function(n){ n.classList.remove('selected'); });
    var existingToolbar = $('.el-toolbar');
    if(existingToolbar) existingToolbar.remove();
    var node = $('#el-' + id);
    if(!node) return;
    node.classList.add('selected');
    buildElementToolbar(getEl(id), node);

    document.addEventListener('pointerdown', dismissOnOutside, {capture:true});
  }

  function dismissOnOutside(e){
    if(!state.selectedId) return;
    var node = $('#el-' + state.selectedId);
    if(node && !node.contains(e.target)){
      node.classList.remove('selected');
      var t = $('.el-toolbar');
      if(t) t.remove();
      state.selectedId = null;
      document.removeEventListener('pointerdown', dismissOnOutside, {capture:true});
    }
  }

  function buildFontPicker(data){
    var wrap = document.createElement('div');
    wrap.className = 'font-picker';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'font-picker-btn';
    btn.textContent = extractFamily(data.font) || 'Police';
    btn.title = 'Choisir une police (' + FULL_FONTS.length + ' disponibles)';
    wrap.appendChild(btn);

    var panel = null;

    function closePanel(){
      if(!panel) return;
      panel.remove();
      panel = null;
      document.removeEventListener('pointerdown', onOutside, {capture:true});
    }
    function onOutside(e){
      if(panel && !wrap.contains(e.target)) closePanel();
    }

    function renderList(query){
      var listEl = panel.querySelector('.font-picker-list');
      listEl.innerHTML = '';
      var q = query.trim().toLowerCase();
      var matches = FULL_FONTS.filter(function(f){
        return !q || f.label.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 150);

      if(!matches.length){
        var empty = document.createElement('div');
        empty.className = 'font-picker-empty';
        empty.textContent = 'Aucune police trouvée';
        listEl.appendChild(empty);
        return;
      }

      var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            var family = entry.target.getAttribute('data-family');
            ensureFontLoaded(family);
            entry.target.style.fontFamily = "'" + family + "', sans-serif";
            observer.unobserve(entry.target);
          }
        });
      }, {root: listEl, rootMargin: '80px'});

      matches.forEach(function(f){
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'font-picker-item' + (f.value === data.font ? ' active' : '');
        item.setAttribute('data-family', f.label);
        item.textContent = f.label;
        item.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
        item.addEventListener('click', function(){
          data.font = f.value;
          refreshElementNode(data);
          markDirty();
          btn.textContent = f.label;
          closePanel();
        });
        listEl.appendChild(item);
        observer.observe(item);
      });
    }

    function openPanel(){
      if(panel) return;
      panel = document.createElement('div');
      panel.className = 'font-picker-panel';
      panel.innerHTML = '<input type="text" class="font-picker-search" placeholder="Rechercher une police…">' +
        '<div class="font-picker-list"></div>';
      wrap.appendChild(panel);

      var search = panel.querySelector('.font-picker-search');
      search.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      search.addEventListener('click', function(e){ e.stopPropagation(); });
      search.addEventListener('input', function(){ renderList(search.value); });
      search.addEventListener('keydown', function(e){ if(e.key === 'Escape') closePanel(); });
      renderList('');
      setTimeout(function(){ search.focus(); }, 0);

      document.addEventListener('pointerdown', onOutside, {capture:true});
    }

    btn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if(panel) closePanel(); else openPanel();
    });

    return wrap;
  }

  function buildElementToolbar(data, node){
    var tb = document.createElement('div');
    tb.className = 'el-toolbar';

    var delBtn = document.createElement('button');
    delBtn.title = 'Supprimer';
    delBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
    delBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    delBtn.addEventListener('click', function(){
      state.board.elements = state.board.elements.filter(function(e){ return e.id !== data.id; });
      node.remove();
      tb.remove();
      state.selectedId = null;
      updateEmptyHint();
      markDirty();
    });
    tb.appendChild(delBtn);

    var dupBtn = document.createElement('button');
    dupBtn.title = 'Dupliquer';
    dupBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    dupBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    dupBtn.addEventListener('click', function(){
      var clone = JSON.parse(JSON.stringify(data));
      clone.id = uid();
      clone.x += 24; clone.y += 24;
      state.board.elements.push(clone);
      renderElement(clone);
      markDirty();
      selectElement(clone.id);
    });
    tb.appendChild(dupBtn);

    if(data.type === 'text'){
      tb.appendChild(buildFontPicker(data));

      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = data.color;
      colorInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      colorInput.addEventListener('input', function(){
        data.color = colorInput.value;
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(colorInput);

      var sizeSel = document.createElement('select');
      [14,16,18,22,28,36,48,64].forEach(function(s){
        var opt = document.createElement('option');
        opt.value = s; opt.textContent = s + 'px';
        if(s === data.size) opt.selected = true;
        sizeSel.appendChild(opt);
      });
      sizeSel.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      sizeSel.addEventListener('change', function(){
        data.size = parseInt(sizeSel.value, 10);
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(sizeSel);
    }

    if(data.type === 'color'){
      var hexInput = document.createElement('input');
      hexInput.type = 'color';
      hexInput.value = data.hex;
      hexInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      hexInput.addEventListener('input', function(){
        data.hex = hexInput.value;
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(hexInput);
    }

    node.appendChild(tb);
    positionToolbarWithinView(tb, node);
  }

  function repositionToolbar(id){
    var tb = $('.el-toolbar');
    var node = $('#el-' + id);
    if(tb && node) positionToolbarWithinView(tb, node);
  }
  function positionToolbarWithinView(tb, node){
    tb.style.left = '50%';
    tb.style.top = '-42px';
    tb.style.transform = 'translateX(-50%)';
  }

  // ---- toolbar actions ----
  $('#btn-add-text').addEventListener('click', function(){ addElement('text'); });
  $('#btn-add-color').addEventListener('click', function(){ addElement('color'); });
  $('#btn-add-image').addEventListener('click', function(){ $('#file-input').click(); });

  $('#file-input').addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    e.target.value = '';
    compressImage(file, 900, 0.72).then(function(dataUrl){
      var el = addElement('image');
      el.src = dataUrl;
      refreshElementNode(el);
    }).catch(function(){
      toast("Impossible de lire cette image.");
    });
  });

  function compressImage(file, maxW, quality){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(ev){
        var img = new Image();
        img.onload = function(){
          var scale = Math.min(1, maxW / img.width);
          var w = Math.round(img.width * scale);
          var h = Math.round(img.height * scale);
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = ev.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- save ----
  $('#btn-save').addEventListener('click', function(){
    if(!state.user){
      openAuthModal();
    } else {
      saveBoard();
    }
  });

  function openAuthModal(){
    var mode = 'signup';
    var html =
      '<h3 id="modal-auth-title">Créer un compte pour enregistrer</h3>' +
      '<p id="modal-auth-sub">Ton moodboard est prêt. Crée un compte gratuit pour le sauvegarder.</p>' +
      '<label class="field-label" for="modal-auth-email">Email</label>' +
      '<input type="text" id="modal-auth-email" placeholder="toi@exemple.com" autocomplete="email">' +
      '<label class="field-label modal-auth-field" for="modal-auth-password">Mot de passe</label>' +
      '<input type="password" id="modal-auth-password" placeholder="6 caractères minimum" autocomplete="new-password">' +
      '<div id="modal-auth-confirm-wrap">' +
        '<label class="field-label modal-auth-field" for="modal-auth-password-confirm">Confirmer le mot de passe</label>' +
        '<input type="password" id="modal-auth-password-confirm" placeholder="Retape ton mot de passe" autocomplete="new-password">' +
      '</div>' +
      '<p id="modal-auth-error" class="modal-auth-error"></p>' +
      '<div class="modal-actions modal-actions-stacked">' +
        '<button class="btn btn-primary btn-full" id="modal-btn-submit">Valider</button>' +
        '<button class="btn btn-full" id="modal-btn-toggle">J’ai déjà un compte</button>' +
      '</div>';

    openModal(html, function(box){
      var errEl = box.querySelector('#modal-auth-error');
      function showModalAuthError(msg){
        errEl.textContent = msg;
        errEl.style.display = msg ? 'block' : 'none';
      }

      function applyModalAuthMode(){
        showModalAuthError('');
        box.querySelector('#modal-auth-password').value = '';
        box.querySelector('#modal-auth-password-confirm').value = '';
        if(mode === 'signup'){
          box.querySelector('#modal-auth-confirm-wrap').style.display = 'block';
          box.querySelector('#modal-auth-password').setAttribute('autocomplete', 'new-password');
          box.querySelector('#modal-btn-submit').textContent = 'Valider';
          box.querySelector('#modal-btn-toggle').textContent = 'J’ai déjà un compte';
          box.querySelector('#modal-auth-title').textContent = 'Créer un compte pour enregistrer';
          box.querySelector('#modal-auth-sub').textContent = 'Ton moodboard est prêt. Crée un compte gratuit pour le sauvegarder.';
        } else {
          box.querySelector('#modal-auth-confirm-wrap').style.display = 'none';
          box.querySelector('#modal-auth-password').setAttribute('autocomplete', 'current-password');
          box.querySelector('#modal-btn-submit').textContent = 'Connexion';
          box.querySelector('#modal-btn-toggle').textContent = 'Créer un compte';
          box.querySelector('#modal-auth-title').textContent = 'Se connecter pour enregistrer';
          box.querySelector('#modal-auth-sub').textContent = 'Connecte-toi pour sauvegarder ton moodboard.';
        }
      }
      applyModalAuthMode();

      box.querySelector('#modal-btn-toggle').addEventListener('click', function(){
        mode = mode === 'signup' ? 'login' : 'signup';
        applyModalAuthMode();
      });

      function afterAuthSuccess(user){
        state.user = user;
        $('#who-label').textContent = user.email;
        closeModal();
        saveBoard();
      }

      box.querySelector('#modal-btn-submit').addEventListener('click', async function(){
        var email = box.querySelector('#modal-auth-email').value.trim();
        var password = box.querySelector('#modal-auth-password').value;

        if(mode === 'login'){
          if(!email || !password){
            showModalAuthError('Entre ton email et ton mot de passe.');
            return;
          }
          showModalAuthError('');
          var res = await supabase.auth.signInWithPassword({ email: email, password: password });
          if(res.error){ showModalAuthError(res.error.message); return; }
          afterAuthSuccess(res.data.session.user);
          return;
        }

        var confirmPassword = box.querySelector('#modal-auth-password-confirm').value;
        if(!email || password.length < 6){
          showModalAuthError('Entre un email et un mot de passe de 6 caractères minimum.');
          return;
        }
        if(password !== confirmPassword){
          showModalAuthError('Les deux mots de passe ne correspondent pas.');
          return;
        }
        showModalAuthError('');
        var res = await supabase.auth.signUp({ email: email, password: password });
        if(res.error){ showModalAuthError(res.error.message); return; }
        if(res.data.session){
          afterAuthSuccess(res.data.session.user);
        } else {
          showModalAuthError('Compte créé. Vérifie ta boîte mail pour confirmer, puis reviens enregistrer.');
        }
      });
    });
  }

  async function saveBoard(){
    var payloadSize = JSON.stringify(state.board.elements).length;
    if(payloadSize > 4500000){
      toast("Ce moodboard est trop volumineux (trop d'images). Réduis-en le nombre.");
      return;
    }
    $('#save-status').textContent = 'enregistrement...';

    var row = {
      user_id: state.user.id,
      name: state.board.name,
      elements: state.board.elements,
      updated_at: new Date().toISOString()
    };

    var res;
    if(state.board.id){
      res = await supabase.from('moodboards').update(row).eq('id', state.board.id).select().single();
    } else {
      res = await supabase.from('moodboards').insert(row).select().single();
    }

    if(res.error){
      toast("L'enregistrement a échoué, réessaie.");
      $('#save-status').textContent = 'non enregistré';
      return;
    }

    state.board.id = res.data.id;
    state.savedSnapshot = JSON.stringify(state.board.elements);
    $('#save-status').textContent = 'enregistré';
    toast('Moodboard « ' + state.board.name + ' » enregistré.');
  }

  window.addEventListener('beforeunload', function(e){
    if(hasUnsavedChanges()){
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ---------- INIT ----------
  initApp();

})();
