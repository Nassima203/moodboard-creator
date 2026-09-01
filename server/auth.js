var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var SECRET_PATH = path.join(__dirname, '..', '.jwt-secret');

function loadSecret(){
  if(process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if(fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  var secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
  return secret;
}

var SECRET = loadSecret();

function signToken(userId){
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });
}

function requireAuth(req, res, next){
  var header = req.headers.authorization || '';
  var token = header.indexOf('Bearer ') === 0 ? header.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Non authentifié.' });
  try{
    var payload = jwt.verify(token, SECRET);
    req.userId = payload.sub;
    next();
  }catch(e){
    res.status(401).json({ error: 'Session invalide, reconnecte-toi.' });
  }
}

module.exports = { signToken: signToken, requireAuth: requireAuth };
