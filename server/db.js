var path = require('path');
var { createClient } = require('@libsql/client');

var db = createClient({
  url: process.env.DATABASE_URL || ('file:' + path.join(__dirname, '..', 'data.sqlite')),
  authToken: process.env.DATABASE_AUTH_TOKEN
});

var ready = db.batch([
  'CREATE TABLE IF NOT EXISTS users (' +
  '  id TEXT PRIMARY KEY,' +
  '  email TEXT UNIQUE NOT NULL,' +
  '  password_hash TEXT NOT NULL,' +
  '  created_at INTEGER NOT NULL' +
  ')',
  'CREATE TABLE IF NOT EXISTS boards (' +
  '  id TEXT PRIMARY KEY,' +
  '  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,' +
  '  name TEXT NOT NULL,' +
  '  elements TEXT NOT NULL,' +
  '  background TEXT,' +
  '  updated_at INTEGER NOT NULL' +
  ')',
  'CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id)'
], 'write');

module.exports = { db: db, ready: ready };
