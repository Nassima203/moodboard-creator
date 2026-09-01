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
    savedSnapshot: null,
    zoom: 1,
    drawMode: false
  };

  var ZOOM_MIN = 0.25, ZOOM_MAX = 2, ZOOM_STEP = 0.1;
  var CANVAS_W = 1600, CANVAS_H = 1400;

  function applyZoom(){
    $('#canvas').style.transform = 'scale(' + state.zoom + ')';
    $('#canvas-scaler').style.width = (CANVAS_W * state.zoom) + 'px';
    $('#canvas-scaler').style.height = (CANVAS_H * state.zoom) + 'px';
    $('#zoom-level').textContent = Math.round(state.zoom * 100) + '%';
  }

  function setZoom(newZoom, pivotClientX, pivotClientY){
    newZoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom)) * 100) / 100;
    if(newZoom === state.zoom) return;
    var wrap = $('#canvas-wrap');
    var rect = wrap.getBoundingClientRect();
    var offsetX = (pivotClientX != null ? pivotClientX : rect.left + rect.width/2) - rect.left;
    var offsetY = (pivotClientY != null ? pivotClientY : rect.top + rect.height/2) - rect.top;
    var contentX = (wrap.scrollLeft + offsetX) / state.zoom;
    var contentY = (wrap.scrollTop + offsetY) / state.zoom;
    state.zoom = newZoom;
    applyZoom();
    wrap.scrollLeft = contentX * newZoom - offsetX;
    wrap.scrollTop = contentY * newZoom - offsetY;
  }

  $('#btn-zoom-in').addEventListener('click', function(){ setZoom(state.zoom + ZOOM_STEP); });
  $('#btn-zoom-out').addEventListener('click', function(){ setZoom(state.zoom - ZOOM_STEP); });
  $('#btn-zoom-reset').addEventListener('click', function(){ setZoom(1); });

  $('#canvas-wrap').addEventListener('wheel', function(e){
    if(!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(state.zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP), e.clientX, e.clientY);
  }, { passive:false });

  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function showScreen(name){
    $all('.screen').forEach(function(s){ s.classList.remove('active'); });
    $('#screen-' + name).classList.add('active');
  }

  // ---------- THEME ----------
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    try{ localStorage.setItem('nassimood_theme', theme); }catch(e){}
    $('#theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  $('#theme-toggle').addEventListener('click', function(){
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

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
    $('#modal-box').classList.remove('modal-box-wide');
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

  function escapeHtml(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  // ---------- API ----------
  var TOKEN_KEY = 'nassimood_token';
  var authToken = null;
  try{ authToken = localStorage.getItem(TOKEN_KEY); }catch(e){}

  function saveToken(t){
    authToken = t;
    try{ if(t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }catch(e){}
  }

  function apiFetch(url, opts){
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if(opts.headers) for(var k in opts.headers) headers[k] = opts.headers[k];
    if(authToken) headers.Authorization = 'Bearer ' + authToken;
    opts.headers = headers;
    return fetch(url, opts).then(function(res){
      return res.json().catch(function(){ return null; }).then(function(data){
        if(!res.ok){
          var err = new Error((data && data.error) || 'Erreur serveur.');
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function initApp(){
    if(!authToken){ showScreen('landing'); return; }
    apiFetch('/api/me').then(function(me){
      state.user = me;
      $('#who-label').textContent = me.email;
      showScreen('dashboard');
      renderDashboard();
    }).catch(function(){
      saveToken(null);
      showScreen('landing');
    });
  }

  $('#btn-landing-cta').addEventListener('click', function(){
    createNewBoard();
  });
  $('#landing-dashboard-link').addEventListener('click', function(){
    if(state.user){ showScreen('dashboard'); renderDashboard(); }
    else { showScreen('auth'); renderAuthScreen('login'); }
  });
  $('#btn-auth-back').addEventListener('click', function(){
    showScreen('landing');
  });
  $('#btn-logout').addEventListener('click', function(){
    saveToken(null);
    state.user = null;
    showScreen('landing');
  });

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
      $('#auth-hint').textContent = 'Ton compte est enregistré sur ce serveur, sans service tiers.';
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

  function afterAuthSuccess(data){
    saveToken(data.token);
    state.user = { email: data.email };
    $('#who-label').textContent = data.email;
    showScreen('dashboard');
    renderDashboard();
  }

  $('#btn-auth-toggle').addEventListener('click', function(){
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  });

  $('#btn-auth-submit').addEventListener('click', function(){
    var email = $('#auth-email').value.trim();
    var password = $('#auth-password').value;

    if(authMode === 'login'){
      if(!email || !password){
        showAuthError('Entre ton email et ton mot de passe.');
        return;
      }
      showAuthError('');
      apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
        .then(afterAuthSuccess)
        .catch(function(err){ showAuthError(err.message); });
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
    apiFetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
      .then(afterAuthSuccess)
      .catch(function(err){ showAuthError(err.message); });
  });

  // ---------- DASHBOARD ----------
  function loadBoardsIndex(){
    return apiFetch('/api/boards').then(function(boards){
      return boards.map(function(b){
        return { id: b.id, name: b.name, updatedAt: b.updatedAt, elementCount: (b.elements||[]).length, items: b.elements || [], background: b.background || null };
      });
    });
  }

  function buildCollagePreview(items){
    if(!items || !items.length) return '<span class="card-preview-empty">tableau vide</span>';
    var CW = 1600, CH = 1400;
    return items.slice(0, 20).map(function(el){
      var style = 'left:' + (el.x / CW * 100).toFixed(2) + '%;' +
        'top:' + (el.y / CH * 100).toFixed(2) + '%;' +
        'width:' + (el.w / CW * 100).toFixed(2) + '%;' +
        'height:' + (el.h / CH * 100).toFixed(2) + '%;' +
        'transform:rotate(' + (el.rotation || 0) + 'deg);';
      if(el.type === 'image'){
        if(!el.src) return '';
        return '<div class="mini-el mini-image" style="' + style + '"><img src="' + el.src + '" alt=""></div>';
      }
      if(el.type === 'color'){
        return '<div class="mini-el mini-color" style="' + style + 'background:' + el.hex + ';"></div>';
      }
      if(el.type === 'text'){
        return '<div class="mini-el mini-text" style="' + style + 'color:' + (el.color || '#211f1b') + ';">' + escapeHtml((el.content || '').slice(0, 40)) + '</div>';
      }
      if(el.type === 'shape'){
        return '<div class="mini-el mini-shape shape-' + el.shape + '" style="' + style + 'background:' + el.hex + ';"></div>';
      }
      return '';
    }).join('');
  }

  function renderDashboard(){
    var grid = $('#projects-grid');
    grid.innerHTML = '<span class="card-preview-empty">Chargement…</span>';

    loadBoardsIndex().then(function(boards){
      $('#project-count').textContent = boards.length + (boards.length > 1 ? ' moodboards' : ' moodboard');

      var html = '<button class="card new-card" id="card-new"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Nouveau moodboard</span></button>';

      html += boards.map(function(b){
        var date = b.updatedAt ? new Date(b.updatedAt).toLocaleDateString('fr-FR', {day:'numeric', month:'short'}) : '';
        var previewStyle = b.background ? ' style="background:'+b.background+';"' : '';
        return '<div class="card" data-id="'+b.id+'">' +
          '<div class="card-preview"'+previewStyle+'>'+ buildCollagePreview(b.items) +'</div>' +
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
          confirmModal('Supprimer ce moodboard ?', 'Cette action est définitive, le tableau et son contenu seront perdus.', 'Supprimer', function(){
            apiFetch('/api/boards/' + id, { method: 'DELETE' }).then(function(){
              toast('Moodboard supprimé.');
              renderDashboard();
            }).catch(function(){ toast('La suppression a échoué.'); });
          });
        });
      });
    }).catch(function(err){
      if(err.status === 401){ saveToken(null); state.user = null; showScreen('landing'); return; }
      grid.innerHTML = '';
      toast("Impossible de charger tes moodboards.");
    });
  }

  function createNewBoard(){
    state.board = { id: uid(), name: 'Sans titre', elements: [], background: null, updatedAt: Date.now() };
    state.savedSnapshot = null;
    showScreen('editor');
    renderEditor();
  }

  function openBoard(id){
    apiFetch('/api/boards/' + id).then(function(found){
      state.board = { id: found.id, name: found.name, elements: found.elements || [], background: found.background || null, updatedAt: found.updatedAt };
      state.savedSnapshot = JSON.stringify({ elements: state.board.elements, background: state.board.background });
      showScreen('editor');
      renderEditor();
    }).catch(function(err){
      if(err.status === 401){ saveToken(null); state.user = null; showScreen('landing'); return; }
      toast("Impossible de charger ce moodboard.");
    });
  }

  function leaveEditor(){
    showScreen('dashboard');
    renderDashboard();
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
    return JSON.stringify({ elements: state.board.elements, background: state.board.background }) !== state.savedSnapshot;
  }

  // ---------- EDITOR ----------
  function renderEditor(){
    $('#board-name-input').value = state.board.name;
    $('#save-status').textContent = state.savedSnapshot ? 'enregistré' : 'non enregistré';
    state.selectedId = null;
    state.zoom = 1;
    state.drawMode = false;
    $('#btn-draw').classList.remove('emphasis');
    $('#canvas-wrap').classList.remove('draw-mode');
    var drawPanel = $('#draw-picker .draw-picker-panel');
    if(drawPanel) drawPanel.remove();
    applyZoom();
    applyBoardBackground();
    undoStack = [];
    redoStack = [];
    var canvas = $('#canvas');
    canvas.innerHTML = '';
    state.board.elements.forEach(renderElement);
  }

  // ---------- BACKGROUND ----------
  var BG_PRESETS = ['#e7e1d3','#f5f1e8','#e3e6e1','#ece1e6','#dde3ea','#f2c879','#211f1b','#ffffff'];

  function applyBoardBackground(){
    var canvas = $('#canvas');
    var wrap = $('#canvas-wrap');
    if(state.board.background){
      canvas.style.backgroundColor = state.board.background;
      canvas.style.backgroundImage = 'none';
      wrap.style.backgroundColor = state.board.background;
    } else {
      canvas.style.backgroundColor = '';
      canvas.style.backgroundImage = '';
      wrap.style.backgroundColor = '';
    }
  }

  function setBoardBackground(hex){
    state.board.background = hex;
    applyBoardBackground();
    markDirty();
  }

  // ---------- UNDO / REDO ----------
  var undoStack = [];
  var redoStack = [];
  var UNDO_LIMIT = 30;

  function snapshotState(){
    return JSON.stringify({ name: state.board.name, elements: state.board.elements, background: state.board.background });
  }
  function pushUndo(){
    if(!state.board) return;
    undoStack.push(snapshotState());
    if(undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
  }
  function applySnapshot(snap){
    var parsed = JSON.parse(snap);
    state.board.name = parsed.name;
    state.board.elements = parsed.elements;
    state.board.background = parsed.background;
    state.selectedId = null;
    var existingToolbar = $('.el-toolbar');
    if(existingToolbar) existingToolbar.remove();
    $('#board-name-input').value = state.board.name;
    applyBoardBackground();
    var canvas = $('#canvas');
    canvas.innerHTML = '';
    state.board.elements.forEach(renderElement);
    markDirty();
  }
  function undo(){
    if(!undoStack.length) return;
    redoStack.push(snapshotState());
    applySnapshot(undoStack.pop());
  }
  function redo(){
    if(!redoStack.length) return;
    undoStack.push(snapshotState());
    applySnapshot(redoStack.pop());
  }

  document.addEventListener('keydown', function(e){
    if(!(e.ctrlKey || e.metaKey)) return;
    if(e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
    if(!$('#screen-editor').classList.contains('active')) return;
    if($('#modal-overlay').classList.contains('active')) return;
    var isRedo = e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey);
    e.preventDefault();
    if(isRedo) redo(); else undo();
  });

  $('#board-name-input').addEventListener('focus', function(){ pushUndo(); });
  $('#board-name-input').addEventListener('input', function(e){
    state.board.name = e.target.value || 'Sans titre';
    markDirty();
  });

  function markDirty(){
    $('#save-status').textContent = 'non enregistré';
  }

  // ---- element factory ----
  function addElement(type, opts){
    pushUndo();
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
      el.bold = false;
      el.italic = false;
      el.underline = false;
      el.align = 'left';
    } else if(type === 'color'){
      el.w = 150; el.h = 150;
      el.hex = COLOR_PRESETS[Math.floor(Math.random()*COLOR_PRESETS.length)];
    } else if(type === 'image'){
      el.w = 220; el.h = 240;
      el.src = null;
    } else if(type === 'shape'){
      el.w = 160; el.h = 160;
      el.shape = (opts && opts.shape) || 'rectangle';
      el.hex = COLOR_PRESETS[Math.floor(Math.random()*COLOR_PRESETS.length)];
    }
    state.board.elements.push(el);
    renderElement(el);
    markDirty();
    selectElement(el.id);
    return el;
  }

  function getEl(id){
    return state.board.elements.find(function(e){ return e.id === id; });
  }

  function deleteElement(id){
    pushUndo();
    state.board.elements = state.board.elements.filter(function(e){ return e.id !== id; });
    var node = $('#el-' + id);
    if(node) node.remove();
    var tb = $('.el-toolbar');
    if(tb) tb.remove();
    if(state.selectedId === id) state.selectedId = null;
    markDirty();
  }

  function bringToFront(id){
    var idx = state.board.elements.findIndex(function(e){ return e.id === id; });
    if(idx === -1 || idx === state.board.elements.length - 1) return;
    pushUndo();
    var el = state.board.elements.splice(idx, 1)[0];
    state.board.elements.push(el);
    var node = $('#el-' + id);
    if(node) $('#canvas').appendChild(node);
    markDirty();
  }

  function sendToBack(id){
    var idx = state.board.elements.findIndex(function(e){ return e.id === id; });
    if(idx <= 0) return;
    pushUndo();
    var el = state.board.elements.splice(idx, 1)[0];
    state.board.elements.unshift(el);
    var node = $('#el-' + id);
    var canvas = $('#canvas');
    if(node) canvas.insertBefore(node, canvas.firstChild);
    markDirty();
  }

  function textStyleAttr(data){
    return 'font-family:'+data.font+';font-size:'+data.size+'px;color:'+data.color+';' +
      'font-weight:'+(data.bold ? '700' : '400')+';' +
      'font-style:'+(data.italic ? 'italic' : 'normal')+';' +
      'text-decoration:'+(data.underline ? 'underline' : 'none')+';' +
      'text-align:'+(data.align || 'left')+';';
  }

  function svgPointsAttr(points){
    return (points || []).map(function(p){ return p.x + ',' + p.y; }).join(' ');
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
      inner += '<div class="el-text-frame"><div class="el-text-content" contenteditable="true" style="'+textStyleAttr(data)+'">'+escapeHtml(data.content)+'</div></div>';
    } else if(data.type === 'color'){
      inner += '<div class="el-pin"></div>';
      inner += '<div class="el-color-frame" style="background:'+data.hex+';"><span class="el-color-tag">#'+data.hex.replace('#','').toUpperCase()+'</span></div>';
    } else if(data.type === 'shape'){
      inner += '<div class="el-pin"></div>';
      inner += '<div class="el-shape-frame shape-'+data.shape+'" style="background:'+data.hex+';"></div>';
    } else if(data.type === 'drawing'){
      inner += '<svg class="el-drawing-svg" viewBox="0 0 '+data.viewW+' '+data.viewH+'" preserveAspectRatio="none">' +
        '<polyline points="'+svgPointsAttr(data.points)+'" fill="none" stroke="'+data.color+'" stroke-width="'+data.strokeWidth+'" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';
    }
    if(data.type !== 'color'){
      inner += '<div class="rotate-handle" title="Glisser pour pivoter"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg></div>';
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
      content.style.cssText = textStyleAttr(data);
    } else if(data.type === 'shape'){
      var shapeFrame = node.querySelector('.el-shape-frame');
      shapeFrame.className = 'el-shape-frame shape-' + data.shape;
      shapeFrame.style.background = data.hex;
    } else if(data.type === 'drawing'){
      var svg = node.querySelector('.el-drawing-svg');
      var poly = svg.querySelector('polyline');
      svg.setAttribute('viewBox', '0 0 ' + data.viewW + ' ' + data.viewH);
      poly.setAttribute('points', svgPointsAttr(data.points));
      poly.setAttribute('stroke', data.color);
      poly.setAttribute('stroke-width', data.strokeWidth);
    }
  }

  function attachElementBehavior(node, data){
    var dragging = false, resizing = false, rotating = false, gestureDirty = false;
    var startX, startY, startLeft, startTop, startW, startH;
    var rotateCenterX, rotateCenterY;

    node.addEventListener('pointerdown', function(e){
      if(e.target.closest('.resize-handle')){
        resizing = true; gestureDirty = false;
        node.setPointerCapture(e.pointerId);
        startX = e.clientX; startY = e.clientY;
        startW = data.w; startH = data.h;
        e.stopPropagation();
        return;
      }
      if(e.target.closest('.rotate-handle')){
        rotating = true; gestureDirty = false;
        node.setPointerCapture(e.pointerId);
        var rect = node.getBoundingClientRect();
        rotateCenterX = rect.left + rect.width/2;
        rotateCenterY = rect.top + rect.height/2;
        e.stopPropagation();
        return;
      }
      if(e.target.closest('.el-toolbar')) return;
      if(e.target.isContentEditable) { selectElement(data.id); return; }
      dragging = true; gestureDirty = false;
      node.classList.add('dragging');
      node.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startLeft = data.x; startTop = data.y;
      selectElement(data.id);
    });

    node.addEventListener('pointermove', function(e){
      if(dragging){
        if(!gestureDirty){ pushUndo(); gestureDirty = true; }
        var dx = (e.clientX - startX) / state.zoom, dy = (e.clientY - startY) / state.zoom;
        data.x = Math.max(0, startLeft + dx);
        data.y = Math.max(0, startTop + dy);
        node.style.left = data.x + 'px';
        node.style.top = data.y + 'px';
      } else if(resizing){
        if(!gestureDirty){ pushUndo(); gestureDirty = true; }
        var ddx = (e.clientX - startX) / state.zoom, ddy = (e.clientY - startY) / state.zoom;
        data.w = Math.max(80, startW + ddx);
        data.h = Math.max(80, startH + ddy);
        node.style.width = data.w + 'px';
        node.style.height = data.h + 'px';
      } else if(rotating){
        if(!gestureDirty){ pushUndo(); gestureDirty = true; }
        var angle = Math.atan2(e.clientY - rotateCenterY, e.clientX - rotateCenterX) * 180/Math.PI + 90;
        data.rotation = Math.round(angle * 10) / 10;
        node.style.transform = 'rotate(' + data.rotation + 'deg)';
      }
    });

    function endInteraction(e){
      if(dragging || resizing || rotating){
        markDirty();
        repositionToolbar(data.id);
      }
      dragging = false; resizing = false; rotating = false;
      node.classList.remove('dragging');
      try{ node.releasePointerCapture(e.pointerId); }catch(err){}
    }
    node.addEventListener('pointerup', endInteraction);
    node.addEventListener('pointercancel', endInteraction);

    if(data.type === 'text'){
      var contentEl = node.querySelector('.el-text-content');
      contentEl.addEventListener('focus', function(){ pushUndo(); });
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

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Delete' && e.key !== 'Backspace') return;
    if(!state.selectedId) return;
    var active = document.activeElement;
    if(active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    deleteElement(state.selectedId);
  });

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
          pushUndo();
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
      deleteElement(data.id);
    });
    tb.appendChild(delBtn);

    var dupBtn = document.createElement('button');
    dupBtn.title = 'Dupliquer';
    dupBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    dupBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    dupBtn.addEventListener('click', function(){
      pushUndo();
      var clone = JSON.parse(JSON.stringify(data));
      clone.id = uid();
      clone.x += 24; clone.y += 24;
      state.board.elements.push(clone);
      renderElement(clone);
      markDirty();
      selectElement(clone.id);
    });
    tb.appendChild(dupBtn);

    var frontBtn = document.createElement('button');
    frontBtn.title = 'Premier plan';
    frontBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>';
    frontBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    frontBtn.addEventListener('click', function(){ bringToFront(data.id); });
    tb.appendChild(frontBtn);

    var backBtn = document.createElement('button');
    backBtn.title = 'Arrière-plan';
    backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="12" height="12" rx="1.5"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/></svg>';
    backBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
    backBtn.addEventListener('click', function(){ sendToBack(data.id); });
    tb.appendChild(backBtn);

    if(data.type === 'image'){
      var cropBtn = document.createElement('button');
      cropBtn.title = 'Recadrer';
      cropBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>';
      cropBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      cropBtn.addEventListener('click', function(){
        if(!data.src){ toast("Patiente, l'image charge encore."); return; }
        openCropModal(data);
      });
      tb.appendChild(cropBtn);
    }

    if(data.type === 'text'){
      tb.appendChild(buildFontPicker(data));

      var colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = data.color;
      colorInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); pushUndo(); });
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
        pushUndo();
        data.size = parseInt(sizeSel.value, 10);
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(sizeSel);

      function styleToggleBtn(label, field, title){
        var btn = document.createElement('button');
        btn.className = 'style-toggle-btn' + (data[field] ? ' active' : '');
        btn.title = title;
        btn.textContent = label;
        btn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
        btn.addEventListener('click', function(){
          pushUndo();
          data[field] = !data[field];
          btn.classList.toggle('active', data[field]);
          refreshElementNode(data);
          markDirty();
        });
        return btn;
      }
      var boldBtn = styleToggleBtn('B', 'bold', 'Gras');
      boldBtn.style.fontWeight = '700';
      tb.appendChild(boldBtn);
      var italicBtn = styleToggleBtn('I', 'italic', 'Italique');
      italicBtn.style.fontStyle = 'italic';
      tb.appendChild(italicBtn);
      var underlineBtn = styleToggleBtn('U', 'underline', 'Souligné');
      underlineBtn.style.textDecoration = 'underline';
      tb.appendChild(underlineBtn);

      var ALIGN_ORDER = ['left', 'center', 'right'];
      var ALIGN_ICONS = { left: '⟸', center: '≡', right: '⟹' };
      var alignBtn = document.createElement('button');
      alignBtn.title = 'Alignement du paragraphe';
      alignBtn.textContent = ALIGN_ICONS[data.align || 'left'];
      alignBtn.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      alignBtn.addEventListener('click', function(){
        pushUndo();
        var idx = ALIGN_ORDER.indexOf(data.align || 'left');
        data.align = ALIGN_ORDER[(idx + 1) % ALIGN_ORDER.length];
        alignBtn.textContent = ALIGN_ICONS[data.align];
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(alignBtn);
    }

    if(data.type === 'color' || data.type === 'shape'){
      var hexInput = document.createElement('input');
      hexInput.type = 'color';
      hexInput.value = data.hex;
      hexInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); pushUndo(); });
      hexInput.addEventListener('input', function(){
        data.hex = hexInput.value;
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(hexInput);
    }

    if(data.type === 'drawing'){
      var drawColorInput = document.createElement('input');
      drawColorInput.type = 'color';
      drawColorInput.value = data.color;
      drawColorInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); pushUndo(); });
      drawColorInput.addEventListener('input', function(){
        data.color = drawColorInput.value;
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(drawColorInput);

      var strokeSel = document.createElement('select');
      [2,4,8,14,22].forEach(function(s){
        var opt = document.createElement('option');
        opt.value = s; opt.textContent = s + 'px';
        if(s === data.strokeWidth) opt.selected = true;
        strokeSel.appendChild(opt);
      });
      strokeSel.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      strokeSel.addEventListener('change', function(){
        pushUndo();
        data.strokeWidth = parseInt(strokeSel.value, 10);
        refreshElementNode(data);
        markDirty();
      });
      tb.appendChild(strokeSel);
    }

    node.appendChild(tb);
    positionToolbarWithinView(tb, node, data);
  }

  // ---- crop ----
  function openCropModal(data){
    var original = data.originalSrc || data.src;
    var html =
      '<h3>Recadrer l\'image</h3>' +
      '<div class="crop-stage" id="crop-stage">' +
        '<img id="crop-img" src="'+original+'" alt="">' +
        '<div class="crop-box" id="crop-box">' +
          '<div class="crop-handle" data-dir="nw"></div>' +
          '<div class="crop-handle" data-dir="ne"></div>' +
          '<div class="crop-handle" data-dir="sw"></div>' +
          '<div class="crop-handle" data-dir="se"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn" id="crop-cancel">Annuler</button>' +
        '<button class="btn btn-primary" id="crop-apply">Appliquer</button>' +
      '</div>';

    $('#modal-box').classList.add('modal-box-wide');
    openModal(html, function(box){
      var img = box.querySelector('#crop-img');
      var cropBox = box.querySelector('#crop-box');
      var mode = null, dir = null;
      var startX, startY, startLeft, startTop, startW, startH;

      function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

      function initBox(){
        var iw = img.clientWidth, ih = img.clientHeight;
        var boxW = iw * 0.8, boxH = ih * 0.8;
        cropBox.style.left = ((iw - boxW) / 2) + 'px';
        cropBox.style.top = ((ih - boxH) / 2) + 'px';
        cropBox.style.width = boxW + 'px';
        cropBox.style.height = boxH + 'px';
      }
      if(img.complete && img.naturalWidth) initBox();
      else img.addEventListener('load', initBox);

      function onMove(e){
        if(!mode) return;
        var iw = img.clientWidth, ih = img.clientHeight;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if(mode === 'move'){
          var w = parseFloat(cropBox.style.width), h = parseFloat(cropBox.style.height);
          cropBox.style.left = clamp(startLeft + dx, 0, iw - w) + 'px';
          cropBox.style.top = clamp(startTop + dy, 0, ih - h) + 'px';
        } else if(mode === 'resize'){
          var newLeft = startLeft, newTop = startTop, newW = startW, newH = startH;
          if(dir.indexOf('e') !== -1) newW = clamp(startW + dx, 30, iw - startLeft);
          if(dir.indexOf('s') !== -1) newH = clamp(startH + dy, 30, ih - startTop);
          if(dir.indexOf('w') !== -1){ newW = clamp(startW - dx, 30, startLeft + startW); newLeft = startLeft + startW - newW; }
          if(dir.indexOf('n') !== -1){ newH = clamp(startH - dy, 30, startTop + startH); newTop = startTop + startH - newH; }
          cropBox.style.left = newLeft + 'px'; cropBox.style.top = newTop + 'px';
          cropBox.style.width = newW + 'px'; cropBox.style.height = newH + 'px';
        }
      }
      function onUp(){
        mode = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
      function startDrag(e, m, d){
        mode = m; dir = d;
        startX = e.clientX; startY = e.clientY;
        startLeft = parseFloat(cropBox.style.left); startTop = parseFloat(cropBox.style.top);
        startW = parseFloat(cropBox.style.width); startH = parseFloat(cropBox.style.height);
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        e.stopPropagation(); e.preventDefault();
      }

      cropBox.addEventListener('pointerdown', function(e){
        if(e.target.closest('.crop-handle')) return;
        startDrag(e, 'move');
      });
      box.querySelectorAll('.crop-handle').forEach(function(h){
        h.addEventListener('pointerdown', function(e){ startDrag(e, 'resize', h.getAttribute('data-dir')); });
      });

      box.querySelector('#crop-cancel').addEventListener('click', closeModal);
      box.querySelector('#crop-apply').addEventListener('click', function(){
        pushUndo();
        var iw = img.clientWidth, ih = img.clientHeight;
        var scaleX = img.naturalWidth / iw, scaleY = img.naturalHeight / ih;
        var cl = parseFloat(cropBox.style.left), ct = parseFloat(cropBox.style.top);
        var cw = parseFloat(cropBox.style.width), ch = parseFloat(cropBox.style.height);
        var sx = Math.round(cl * scaleX), sy = Math.round(ct * scaleY);
        var sw = Math.round(cw * scaleX), sh = Math.round(ch * scaleY);
        var canvas = document.createElement('canvas');
        canvas.width = sw; canvas.height = sh;
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        if(!data.originalSrc) data.originalSrc = data.src;
        data.src = canvas.toDataURL('image/jpeg', 0.85);
        refreshElementNode(data);
        markDirty();
        closeModal();
      });
    });
  }

  function repositionToolbar(id){
    var tb = $('.el-toolbar');
    var node = $('#el-' + id);
    var data = getEl(id);
    if(tb && node) positionToolbarWithinView(tb, node, data);
  }
  function positionToolbarWithinView(tb, node, data){
    var hasRotateHandle = data && data.type !== 'color';
    tb.style.left = '50%';
    tb.style.top = hasRotateHandle ? '-70px' : '-42px';
    var counter = data ? -data.rotation : 0;
    tb.style.transform = 'translateX(-50%) rotate(' + counter + 'deg)';
  }

  // ---- toolbar actions ----
  $('#btn-add-text').addEventListener('click', function(){ addElement('text'); });
  $('#btn-add-color').addEventListener('click', function(){ addElement('color'); });
  $('#btn-add-image').addEventListener('click', function(){ $('#file-input').click(); });

  // ---- shape picker ----
  (function(){
    var wrap = $('#shape-picker');
    var btn = $('#btn-shape');
    var panel = null;
    var SHAPES = [
      { id: 'rectangle', label: 'Rectangle', icon: '<rect x="4" y="6" width="16" height="12"/>' },
      { id: 'rounded', label: 'Rectangle arrondi', icon: '<rect x="4" y="6" width="16" height="12" rx="4"/>' },
      { id: 'circle', label: 'Cercle', icon: '<circle cx="12" cy="12" r="8"/>' },
      { id: 'triangle', label: 'Triangle', icon: '<path d="M12 4l9 16H3z"/>' },
      { id: 'diamond', label: 'Losange', icon: '<polygon points="12,3 21,12 12,21 3,12"/>' },
      { id: 'pentagon', label: 'Pentagone', icon: '<polygon points="12,2 21,9 17.5,20 6.5,20 3,9"/>' },
      { id: 'hexagon', label: 'Hexagone', icon: '<polygon points="7,3 17,3 22,12 17,21 7,21 2,12"/>' },
      { id: 'star', label: 'Étoile', icon: '<polygon points="12,2 15,9 22,9.5 16.5,14 18,21.5 12,17.5 6,21.5 7.5,14 2,9.5 9,9"/>' }
    ];

    function closePanel(){
      if(!panel) return;
      panel.remove();
      panel = null;
      document.removeEventListener('pointerdown', onOutside, {capture:true});
    }
    function onOutside(e){
      if(panel && !wrap.contains(e.target)) closePanel();
    }
    function openPanel(){
      if(panel) return;
      panel = document.createElement('div');
      panel.className = 'shape-picker-panel';
      panel.innerHTML = SHAPES.map(function(s){
        return '<button type="button" class="shape-option" data-shape="' + s.id + '" title="' + s.label + '">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + s.icon + '</svg>' +
          '</button>';
      }).join('');
      wrap.appendChild(panel);

      panel.querySelectorAll('.shape-option').forEach(function(opt){
        opt.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
        opt.addEventListener('click', function(){
          addElement('shape', { shape: opt.getAttribute('data-shape') });
          closePanel();
        });
      });
      document.addEventListener('pointerdown', onOutside, {capture:true});
    }
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if(panel) closePanel(); else openPanel();
    });
  })();

  // ---- freehand drawing ----
  (function(){
    var wrap = $('#draw-picker');
    var btn = $('#btn-draw');
    var panel = null;
    var drawColor = '#211f1b';
    var drawSize = 4;
    var drawing = false;
    var currentPoints = [];
    var currentId = null;

    function closePanel(){
      if(!panel) return;
      panel.remove();
      panel = null;
    }
    function openPanel(){
      if(panel) return;
      panel = document.createElement('div');
      panel.className = 'draw-picker-panel';
      panel.innerHTML =
        '<label class="draw-picker-row"><span>Couleur</span><input type="color" id="draw-color-input" value="' + drawColor + '"></label>' +
        '<label class="draw-picker-row"><span>Épaisseur</span><select id="draw-size-input">' +
          [2,4,8,14,22].map(function(s){ return '<option value="'+s+'"'+(s===drawSize?' selected':'')+'>'+s+'px</option>'; }).join('') +
        '</select></label>';
      wrap.appendChild(panel);
      panel.querySelector('#draw-color-input').addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      panel.querySelector('#draw-color-input').addEventListener('input', function(e){ drawColor = e.target.value; });
      panel.querySelector('#draw-size-input').addEventListener('pointerdown', function(e){ e.stopPropagation(); });
      panel.querySelector('#draw-size-input').addEventListener('change', function(e){ drawSize = parseInt(e.target.value, 10); });
    }

    function setDrawMode(on){
      state.drawMode = on;
      btn.classList.toggle('emphasis', on);
      $('#canvas-wrap').classList.toggle('draw-mode', on);
      if(on) openPanel(); else closePanel();
    }
    btn.addEventListener('click', function(){ setDrawMode(!state.drawMode); });

    function canvasPoint(e){
      var rect = $('#canvas').getBoundingClientRect();
      return { x: (e.clientX - rect.left) / state.zoom, y: (e.clientY - rect.top) / state.zoom };
    }

    function computeDrawingFields(points, color, strokeWidth){
      var minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
      points.forEach(function(p){
        if(p.x < minX) minX = p.x; if(p.x > maxX) maxX = p.x;
        if(p.y < minY) minY = p.y; if(p.y > maxY) maxY = p.y;
      });
      var pad = strokeWidth;
      var viewW = Math.max(1, (maxX - minX) + pad * 2);
      var viewH = Math.max(1, (maxY - minY) + pad * 2);
      return {
        x: minX - pad,
        y: minY - pad,
        w: viewW,
        h: viewH,
        viewW: viewW,
        viewH: viewH,
        points: points.map(function(p){ return { x: p.x - minX + pad, y: p.y - minY + pad }; }),
        color: color,
        strokeWidth: strokeWidth
      };
    }

    $('#canvas').addEventListener('pointerdown', function(e){
      if(!state.drawMode) return;
      if(e.target.closest('.el')) return;
      pushUndo();
      drawing = true;
      currentPoints = [canvasPoint(e)];
      var fields = computeDrawingFields(currentPoints.concat([currentPoints[0]]), drawColor, drawSize);
      var el = { id: uid(), type: 'drawing', rotation: 0 };
      Object.assign(el, fields);
      currentId = el.id;
      state.board.elements.push(el);
      renderElement(el);
      e.target.setPointerCapture(e.pointerId);
    });
    $('#canvas').addEventListener('pointermove', function(e){
      if(!drawing) return;
      currentPoints.push(canvasPoint(e));
      var el = getEl(currentId);
      if(!el) return;
      var fields = computeDrawingFields(currentPoints, drawColor, drawSize);
      Object.assign(el, fields);
      refreshElementNode(el);
    });
    function endDraw(){
      if(!drawing) return;
      drawing = false;
      markDirty();
      selectElement(currentId);
      currentId = null;
      currentPoints = [];
    }
    $('#canvas').addEventListener('pointerup', endDraw);
    $('#canvas').addEventListener('pointercancel', endDraw);
  })();

  // ---- background picker ----
  (function(){
    var wrap = $('#bg-picker');
    var btn = $('#btn-bg');
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

    function openPanel(){
      if(panel) return;
      panel = document.createElement('div');
      panel.className = 'bg-picker-panel';
      var swatchesHtml = BG_PRESETS.map(function(hex){
        var active = state.board.background === hex ? ' active' : '';
        return '<button type="button" class="bg-swatch' + active + '" data-hex="' + hex + '" style="background:' + hex + ';" title="' + hex + '"></button>';
      }).join('');
      panel.innerHTML =
        '<p class="bg-picker-title">Fond du tableau</p>' +
        '<div class="bg-picker-swatches">' + swatchesHtml + '</div>' +
        '<label class="bg-picker-custom"><input type="color" id="bg-custom-input" value="' + (state.board.background || '#e7e1d3') + '"><span>Personnalisée</span></label>';
      wrap.appendChild(panel);

      panel.querySelectorAll('.bg-swatch').forEach(function(sw){
        sw.addEventListener('pointerdown', function(e){ e.stopPropagation(); });
        sw.addEventListener('click', function(){
          pushUndo();
          setBoardBackground(sw.getAttribute('data-hex'));
          closePanel();
        });
      });
      var customInput = panel.querySelector('#bg-custom-input');
      customInput.addEventListener('pointerdown', function(e){ e.stopPropagation(); pushUndo(); });
      customInput.addEventListener('input', function(){
        setBoardBackground(customInput.value);
      });

      document.addEventListener('pointerdown', onOutside, {capture:true});
    }

    btn.addEventListener('click', function(e){
      e.stopPropagation();
      if(panel) closePanel(); else openPanel();
    });
  })();

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
      openSaveAuthModal();
    } else {
      saveBoard();
    }
  });

  function openSaveAuthModal(){
    var mode = 'signup';
    var html =
      '<h3 id="modal-auth-title">Créer un compte pour enregistrer</h3>' +
      '<p id="modal-auth-sub">Ton moodboard est prêt. Crée un compte gratuit pour le sauvegarder.</p>' +
      '<label class="field-label" for="modal-auth-email">Email</label>' +
      '<input type="text" id="modal-auth-email" placeholder="toi@exemple.com" autocomplete="email">' +
      '<label class="field-label" for="modal-auth-password">Mot de passe</label>' +
      '<input type="password" id="modal-auth-password" placeholder="6 caractères minimum" autocomplete="new-password">' +
      '<div id="modal-auth-confirm-wrap">' +
        '<label class="field-label" for="modal-auth-password-confirm">Confirmer le mot de passe</label>' +
        '<input type="password" id="modal-auth-password-confirm" placeholder="Retape ton mot de passe" autocomplete="new-password">' +
      '</div>' +
      '<p id="modal-auth-error" class="auth-error"></p>' +
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
          box.querySelector('#modal-btn-submit').textContent = 'Valider';
          box.querySelector('#modal-btn-toggle').textContent = 'J’ai déjà un compte';
          box.querySelector('#modal-auth-title').textContent = 'Créer un compte pour enregistrer';
          box.querySelector('#modal-auth-sub').textContent = 'Ton moodboard est prêt. Crée un compte gratuit pour le sauvegarder.';
        } else {
          box.querySelector('#modal-auth-confirm-wrap').style.display = 'none';
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

      function onSuccess(data){
        saveToken(data.token);
        state.user = { email: data.email };
        $('#who-label').textContent = data.email;
        closeModal();
        saveBoard();
      }

      box.querySelector('#modal-btn-submit').addEventListener('click', function(){
        var email = box.querySelector('#modal-auth-email').value.trim();
        var password = box.querySelector('#modal-auth-password').value;

        if(mode === 'login'){
          if(!email || !password){
            showModalAuthError('Entre ton email et ton mot de passe.');
            return;
          }
          showModalAuthError('');
          apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
            .then(onSuccess)
            .catch(function(err){ showModalAuthError(err.message); });
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
        apiFetch('/api/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) })
          .then(onSuccess)
          .catch(function(err){ showModalAuthError(err.message); });
      });
    });
  }

  function saveBoard(){
    var payloadSize = JSON.stringify(state.board.elements).length;
    if(payloadSize > 4500000){
      toast("Ce moodboard est trop volumineux (trop d'images). Réduis-en le nombre.");
      return;
    }
    $('#save-status').textContent = 'enregistrement...';

    apiFetch('/api/boards/' + state.board.id, {
      method: 'PUT',
      body: JSON.stringify({ name: state.board.name, elements: state.board.elements, background: state.board.background })
    }).then(function(saved){
      state.board.updatedAt = saved.updatedAt;
      state.savedSnapshot = JSON.stringify({ elements: state.board.elements, background: state.board.background });
      $('#save-status').textContent = 'enregistré';
      toast('Moodboard « ' + state.board.name + ' » enregistré.');
    }).catch(function(err){
      if(err.status === 401){
        saveToken(null);
        state.user = null;
        $('#save-status').textContent = 'non enregistré';
        openSaveAuthModal();
        return;
      }
      toast("L'enregistrement a échoué, réessaie.");
      $('#save-status').textContent = 'non enregistré';
    });
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
