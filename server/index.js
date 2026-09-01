var path = require('path');
var crypto = require('crypto');
var express = require('express');
var bcrypt = require('bcryptjs');
var db = require('./db');
var auth = require('./auth');

var app = express();
app.use(express.json({ limit: '15mb' }));

function uid(){ return crypto.randomBytes(12).toString('hex'); }

function rowToBoard(row){
  return {
    id: row.id,
    name: row.name,
    elements: JSON.parse(row.elements || '[]'),
    background: row.background || null,
    updatedAt: row.updated_at
  };
}

// ---------- AUTH ----------
app.post('/api/signup', function(req, res){
  var email = String((req.body && req.body.email) || '').trim().toLowerCase();
  var password = String((req.body && req.body.password) || '');
  if(!email || password.length < 6){
    return res.status(400).json({ error: 'Entre un email et un mot de passe de 6 caractères minimum.' });
  }
  var existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if(existing){
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  var id = uid();
  var hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, email, hash, Date.now());
  res.json({ token: auth.signToken(id), email: email });
});

app.post('/api/login', function(req, res){
  var email = String((req.body && req.body.email) || '').trim().toLowerCase();
  var password = String((req.body && req.body.password) || '');
  var user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if(!user || !bcrypt.compareSync(password, user.password_hash)){
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }
  res.json({ token: auth.signToken(user.id), email: user.email });
});

app.get('/api/me', auth.requireAuth, function(req, res){
  var user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.userId);
  if(!user) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json({ email: user.email });
});

// ---------- BOARDS ----------
app.get('/api/boards', auth.requireAuth, function(req, res){
  var rows = db.prepare('SELECT id, name, elements, background, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC').all(req.userId);
  res.json(rows.map(rowToBoard));
});

app.get('/api/boards/:id', auth.requireAuth, function(req, res){
  var row = db.prepare('SELECT id, name, elements, background, updated_at FROM boards WHERE user_id = ? AND id = ?').get(req.userId, req.params.id);
  if(!row) return res.status(404).json({ error: 'Moodboard introuvable.' });
  res.json(rowToBoard(row));
});

app.put('/api/boards/:id', auth.requireAuth, function(req, res){
  var name = (req.body && req.body.name) || 'Sans titre';
  var elements = (req.body && req.body.elements) || [];
  var background = (req.body && req.body.background) || null;
  var elementsJson = JSON.stringify(elements);
  var now = Date.now();

  var existing = db.prepare('SELECT id FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if(existing){
    db.prepare('UPDATE boards SET name = ?, elements = ?, background = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(name, elementsJson, background, now, req.params.id, req.userId);
  } else {
    db.prepare('INSERT INTO boards (id, user_id, name, elements, background, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.params.id, req.userId, name, elementsJson, background, now);
  }
  res.json(rowToBoard({ id: req.params.id, name: name, elements: elementsJson, background: background, updated_at: now }));
});

app.delete('/api/boards/:id', auth.requireAuth, function(req, res){
  db.prepare('DELETE FROM boards WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// ---------- STATIC FRONTEND ----------
app.use(express.static(path.join(__dirname, '..')));

var PORT = process.env.PORT || 3000;
app.listen(PORT, function(){
  console.log('NASSIMOOD server running on http://localhost:' + PORT);
});
