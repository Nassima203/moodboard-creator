var path = require('path');
var crypto = require('crypto');
var express = require('express');
var bcrypt = require('bcryptjs');
var dbModule = require('./db');
var db = dbModule.db;
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

function asyncRoute(fn){
  return function(req, res){
    fn(req, res).catch(function(err){
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur.' });
    });
  };
}

// ---------- AUTH ----------
app.post('/api/signup', asyncRoute(async function(req, res){
  var email = String((req.body && req.body.email) || '').trim().toLowerCase();
  var password = String((req.body && req.body.password) || '');
  if(!email || password.length < 6){
    return res.status(400).json({ error: 'Entre un email et un mot de passe de 6 caractères minimum.' });
  }
  var existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
  if(existing.rows.length){
    return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
  }
  var id = uid();
  var hash = bcrypt.hashSync(password, 10);
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    args: [id, email, hash, Date.now()]
  });
  res.json({ token: auth.signToken(id), email: email });
}));

app.post('/api/login', asyncRoute(async function(req, res){
  var email = String((req.body && req.body.email) || '').trim().toLowerCase();
  var password = String((req.body && req.body.password) || '');
  var result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
  var user = result.rows[0];
  if(!user || !bcrypt.compareSync(password, user.password_hash)){
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }
  res.json({ token: auth.signToken(user.id), email: user.email });
}));

app.get('/api/me', auth.requireAuth, asyncRoute(async function(req, res){
  var result = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.userId] });
  var user = result.rows[0];
  if(!user) return res.status(404).json({ error: 'Compte introuvable.' });
  res.json({ email: user.email });
}));

// ---------- BOARDS ----------
app.get('/api/boards', auth.requireAuth, asyncRoute(async function(req, res){
  var result = await db.execute({
    sql: 'SELECT id, name, elements, background, updated_at FROM boards WHERE user_id = ? ORDER BY updated_at DESC',
    args: [req.userId]
  });
  res.json(result.rows.map(rowToBoard));
}));

app.get('/api/boards/:id', auth.requireAuth, asyncRoute(async function(req, res){
  var result = await db.execute({
    sql: 'SELECT id, name, elements, background, updated_at FROM boards WHERE user_id = ? AND id = ?',
    args: [req.userId, req.params.id]
  });
  var row = result.rows[0];
  if(!row) return res.status(404).json({ error: 'Moodboard introuvable.' });
  res.json(rowToBoard(row));
}));

app.put('/api/boards/:id', auth.requireAuth, asyncRoute(async function(req, res){
  var name = (req.body && req.body.name) || 'Sans titre';
  var elements = (req.body && req.body.elements) || [];
  var background = (req.body && req.body.background) || null;
  var elementsJson = JSON.stringify(elements);
  var now = Date.now();

  var existing = await db.execute({
    sql: 'SELECT id FROM boards WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.userId]
  });
  if(existing.rows.length){
    await db.execute({
      sql: 'UPDATE boards SET name = ?, elements = ?, background = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      args: [name, elementsJson, background, now, req.params.id, req.userId]
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO boards (id, user_id, name, elements, background, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [req.params.id, req.userId, name, elementsJson, background, now]
    });
  }
  res.json(rowToBoard({ id: req.params.id, name: name, elements: elementsJson, background: background, updated_at: now }));
}));

app.delete('/api/boards/:id', auth.requireAuth, asyncRoute(async function(req, res){
  await db.execute({ sql: 'DELETE FROM boards WHERE id = ? AND user_id = ?', args: [req.params.id, req.userId] });
  res.json({ ok: true });
}));

// ---------- STATIC FRONTEND ----------
app.use(express.static(path.join(__dirname, '..')));

var PORT = process.env.PORT || 3000;
dbModule.ready.then(function(){
  app.listen(PORT, function(){
    console.log('NASSIMOOD server running on http://localhost:' + PORT);
  });
}).catch(function(err){
  console.error("Erreur d'initialisation de la base de données:", err);
  process.exit(1);
});
