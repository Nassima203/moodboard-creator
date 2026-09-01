var path = require('path');
var Database = require('better-sqlite3');

var db = new Database(path.join(__dirname, '..', 'data.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(
  'CREATE TABLE IF NOT EXISTS users (' +
  '  id TEXT PRIMARY KEY,' +
  '  email TEXT UNIQUE NOT NULL,' +
  '  password_hash TEXT NOT NULL,' +
  '  created_at INTEGER NOT NULL' +
  ');' +
  'CREATE TABLE IF NOT EXISTS boards (' +
  '  id TEXT PRIMARY KEY,' +
  '  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,' +
  '  name TEXT NOT NULL,' +
  '  elements TEXT NOT NULL,' +
  '  background TEXT,' +
  '  updated_at INTEGER NOT NULL' +
  ');' +
  'CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id);'
);

module.exports = db;
