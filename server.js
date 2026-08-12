// ============================================================
// TADASHI - server.js
// Backend: Express + Socket.io + lowdb
// Auth: tokens HMAC (Bearer) em REST e Socket.io
// Mídia: arquivos em /public/uploads (não base64 no JSON)
// ============================================================

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { Server } = require('socket.io');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// -------------------- Diretórios --------------------
const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

for (const dir of [dataDir, uploadsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// -------------------- Bancos lowdb --------------------
const usersDb = low(new FileSync(path.join(dataDir, 'users.json')));
const postsDb = low(new FileSync(path.join(dataDir, 'posts.json')));
const messagesDb = low(new FileSync(path.join(dataDir, 'messages.json')));
const notificationsDb = low(new FileSync(path.join(dataDir, 'notifications.json')));
const sessionsDb = low(new FileSync(path.join(dataDir, 'sessions.json')));
const reportsDb = low(new FileSync(path.join(dataDir, 'reports.json')));

usersDb.defaults({ users: [] }).write();
postsDb.defaults({ posts: [] }).write();
messagesDb.defaults({ messages: [] }).write();
notificationsDb.defaults({ notifications: [] }).write();
sessionsDb.defaults({ sessions: [] }).write();
reportsDb.defaults({ reports: [] }).write();

// -------------------- Constantes --------------------
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_NOTIFICACOES_POR_USER = 100;
const MAX_STRIKES = 3; // strikes automáticos antes do banimento

const AUTH_SECRET = process.env.AUTH_SECRET || 'tadashi-dev-secret-change-me';

const palavrasOfensivas = [
  'idiota', 'imbecil', 'burro', 'bosta', 'lixo', 'pqp', 'puta',
  'merda', 'desgraçado', 'desgraçada', 'fdp', 'filhodaputa', 'cuzão', 'cuzao'
];

// -------------------- Utilitários --------------------
function gerarId(prefixo) {
  return `${prefixo}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

function textoTemPalavraOfensiva(texto) {
  if (!texto || !String(texto).trim()) return false;
  const normalizado = String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return palavrasOfensivas.some((palavra) => {
    if (!palavra) return false;
    const p = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizado.includes(p);
  });
}

function criarPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

function verificarPassword(password, passwordHash) {
  if (!password || !passwordHash || !passwordHash.includes(':')) return false;
  const [salt, hashEsperado] = passwordHash.split(':');
  const hashTentativa = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  const a = Buffer.from(hashEsperado, 'hex');
  const b = Buffer.from(hashTentativa, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function usuarioPublico(usuario) {
  if (!usuario) return null;
  const clone = { ...usuario };
  delete clone.passwordHash;
  return clone;
}

function obterUsuarioPorId(id) {
  return usersDb.get('users').find({ id }).value() || null;
}

function obterUsuarioPorHandle(handle) {
  const h = String(handle || '').trim().toLowerCase();
  if (!h) return null;
  return usersDb.get('users').find((u) => String(u.handle).toLowerCase() === h).value() || null;
}

/**
 * Extrai os ids de usuários mencionados via @handle no texto.
 * Retorna um array de ids (sem o próprio autor, filtrado pelo chamador se preciso).
 */
function extrairUsuariosMencionados(texto, ignorarId) {
  const ids = new Set();
  const regex = /@([a-zA-Z0-9_]{2,30})/g;
  let match;
  let str = String(texto || '');
  while ((match = regex.exec(str)) !== null) {
    const h = `@${match[1].toLowerCase()}`;
    const u = obterUsuarioPorHandle(h);
    if (u && u.id !== ignorarId) ids.add(u.id);
  }
  return Array.from(ids);
}

function limparSessoesExpiradas() {
  const agora = Date.now();
  sessionsDb.get('sessions').remove((s) => s.expiresAt <= agora).write();
}

function criarSessao(userId) {
  limparSessoesExpiradas();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHmac('sha256', AUTH_SECRET).update(token).digest('hex');
  const sessao = {
    id: gerarId('s'),
    userId,
    tokenHash,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS
  };
  sessionsDb.get('sessions').push(sessao).write();
  return token;
}

function revogarSessoesDoUsuario(userId, tokenAtual) {
  if (tokenAtual) {
    const tokenHash = crypto.createHmac('sha256', AUTH_SECRET).update(tokenAtual).digest('hex');
    sessionsDb.get('sessions').remove({ tokenHash }).write();
    return;
  }
  sessionsDb.get('sessions').remove({ userId }).write();
}

function validarToken(token) {
  if (!token || typeof token !== 'string') return null;
  limparSessoesExpiradas();
  const tokenHash = crypto.createHmac('sha256', AUTH_SECRET).update(token).digest('hex');
  const sessao = sessionsDb.get('sessions').find({ tokenHash }).value();
  if (!sessao || sessao.expiresAt <= Date.now()) return null;
  const usuario = obterUsuarioPorId(sessao.userId);
  if (!usuario) return null;
  // Usuário banido: invalida sessão e revoga todas as sessões ativas
  if (usuario.banned) {
    revogarSessoesDoUsuario(sessao.userId);
    return null;
  }
  return { usuario, sessao, token };
}

function extrairBearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

function middlewareAuth(req, res, next) {
  const token = extrairBearer(req);
  const auth = validarToken(token);
  if (!auth) {
    return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  }
  req.usuario = auth.usuario;
  req.token = auth.token;
  req.sessao = auth.sessao;
  next();
}

function middlewareAuthOpcional(req, res, next) {
  const token = extrairBearer(req);
  const auth = validarToken(token);
  if (auth) {
    req.usuario = auth.usuario;
    req.token = auth.token;
    req.sessao = auth.sessao;
  }
  next();
}

// -------------------- Admin / Moderação --------------------
function middlewareAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
}

function notificarAdmins(mensagem, tipo, deUserId) {
  const adminIds = usersDb.get('users').filter({ role: 'admin' }).map('id').value();
  for (const adminId of adminIds) {
    const notif = criarNotificacao(adminId, mensagem, tipo || 'geral', deUserId);
    if (notif) io.to(`user:${adminId}`).emit('notificacao', notif);
  }
}

/**
 * Registra um strike automático contra um usuário por conteúdo ofensivo.
 * Cria um report, incrementa strikes, e auto-banifica ao atingir MAX_STRIKES.
 * Retorna o número de strikes ou null.
 */
function registrarStrike(userId, motivo) {
  const usuario = obterUsuarioPorId(userId);
  if (!usuario) return null;

  // Cria report no banco
  const report = {
    id: gerarId('r'),
    tipo: 'ofensivo',
    motivo,
    deUserId: 'sistema',
    targetUserId: userId,
    postagemId: null,
    resolvido: false,
    createdAt: Date.now()
  };
  reportsDb.get('reports').unshift(report).write();

  // Incrementa strikes
  const strikes = (usuario.strikes || 0) + 1;
  usersDb.get('users').find({ id: userId }).assign({ strikes }).write();

  // Notifica admins
  notificarAdmins(
    `${usuario.name} (@${usuario.handle}) recebeu strike (${strikes}/${MAX_STRIKES}): ${motivo}`,
    'strike',
    userId
  );

  // Auto-ban ao atingir o limite
  if (strikes >= MAX_STRIKES) {
    usersDb.get('users').find({ id: userId }).assign({
      banned: true,
      banReason: motivo,
      bannedAt: Date.now(),
      bannedBy: 'sistema'
    }).write();
    revogarSessoesDoUsuario(userId);
    io.to(`user:${userId}`).emit('usuarioBanido', { motivo, strikes });
    notificarAdmins(
      `${usuario.name} (@${usuario.handle}) foi BANIDO automaticamente após ${strikes} strikes.`,
      'banimento',
      userId
    );
  }

  return strikes;
}

/**
 * Remove arquivos de mídia (imagem/video) do disco quando um post é deletado.
 */
function removerMidiaPost(post) {
  if (!post) return;
  for (const campo of ['imagem', 'video']) {
    const url = post[campo];
    if (typeof url === 'string' && url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', url);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        // ignora erro de remoção
      }
    }
  }
}

function extensaoDeMime(mime) {
  const mapa = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/x-m4a': '.m4a',
    'audio/mp4': '.m4a',
    'audio/webm': '.webm'
  };
  return mapa[mime] || null;
}

/**
 * Converte data URL base64 em arquivo em /public/uploads.
 * Retorna caminho público (/uploads/...) ou null.
 * Se já for URL/caminho relativo, devolve como está.
 */
function salvarMidiaBase64(dataUrl, tipoEsperado, limiteBytes) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const texto = dataUrl.trim();
  if (!texto) return null;

  // Já é URL ou caminho servido estaticamente
  if (
    texto.startsWith('/uploads/') ||
    texto.startsWith('http://') ||
    texto.startsWith('https://')
  ) {
    return texto;
  }

  // data:[mime];base64,....
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/s.exec(texto);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const b64 = match[2];

  if (tipoEsperado === 'image' && !mime.startsWith('image/')) {
    throw new Error('Arquivo de imagem inválido.');
  }
  if (tipoEsperado === 'video' && !mime.startsWith('video/')) {
    throw new Error('Arquivo de vídeo inválido.');
  }
  if (tipoEsperado === 'audio' && !mime.startsWith('audio/')) {
    throw new Error('Arquivo de áudio inválido.');
  }

  const ext = extensaoDeMime(mime);
  if (!ext) throw new Error('Tipo de arquivo não suportado.');

  const buffer = Buffer.from(b64, 'base64');
  if (!buffer.length) throw new Error('Arquivo vazio.');
  if (buffer.length > limiteBytes) {
    throw new Error(`Arquivo muito grande (máx. ${Math.round(limiteBytes / (1024 * 1024))} MB).`);
  }

  const nome = `${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}${ext}`;
  const caminhoAbs = path.join(uploadsDir, nome);
  fs.writeFileSync(caminhoAbs, buffer);
  return `/uploads/${nome}`;
}

function criarNotificacao(paraUserId, mensagem, tipo, deUserId) {
  if (!paraUserId || paraUserId === deUserId) return null;

  const notificacao = {
    id: gerarId('n'),
    paraUserId,
    deUserId: deUserId || null,
    tipo: tipo || 'geral',
    mensagem: String(mensagem || '').slice(0, 280),
    lida: false,
    createdAt: Date.now()
  };

  notificationsDb.get('notifications').unshift(notificacao).write();

  // Mantém só as N mais recentes por usuário
  const doUser = notificationsDb.get('notifications')
    .filter({ paraUserId })
    .sortBy('createdAt')
    .reverse()
    .value();

  if (doUser.length > MAX_NOTIFICACOES_POR_USER) {
    const manterIds = new Set(doUser.slice(0, MAX_NOTIFICACOES_POR_USER).map((n) => n.id));
    notificationsDb.get('notifications')
      .remove((n) => n.paraUserId === paraUserId && !manterIds.has(n.id))
      .write();
  }

  return notificacao;
}

function ipLocalLan() {
  const ifaces = os.networkInterfaces();
  for (const nome of Object.keys(ifaces)) {
    for (const info of ifaces[nome] || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return '127.0.0.1';
}

// -------------------- Servidor HTTP/HTTPS --------------------
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let server;

if (IS_PRODUCTION) {
  server = http.createServer(app);
  console.log('🌐 Modo produção: usando HTTP (HTTPS fornecido pelo Render)');
} else {
  const certPath = path.join(__dirname, 'cert', 'tadashi-cert.pem');
  const keyPath = path.join(__dirname, 'cert', 'tadashi-key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    server = https.createServer({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }, app);
    console.log('🔒 Modo local: usando HTTPS com certificado mkcert');
  } else {
    server = http.createServer(app);
    console.log('⚠️ Certificados não encontrados, usando HTTP');
  }
}

const io = new Server(server, {
  maxHttpBufferSize: 45 * 1024 * 1024
});

app.use(express.json({ limit: '45mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------- Middleware de Segurança --------------------
// Headers de segurança HTTP (proteção contra clickjacking, MIME sniffing, etc.)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  next();
});

// Rate limiter em memória para proteger endpoints de autenticação
// Evita brute-force em login e cadastro de contas
const rateLimitStore = new Map();
function rateLimit(maxReqs, windowMs) {
  return (req, res, next) => {
    const ident = `${req.ip}:${req.body ? (req.body.handle || '') : ''}`;
    const agora = Date.now();
    const record = rateLimitStore.get(ident);
    if (!record || agora > record.resetAt) {
      rateLimitStore.set(ident, { count: 1, resetAt: agora + windowMs });
      return next();
    }
    record.count++;
    if (record.count > maxReqs) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em breve.' });
    }
    next();
  };
}
// Limpa entradas expiradas periodicamente para não vazar memória
setInterval(() => {
  const agora = Date.now();
  for (const [chave, rec] of rateLimitStore.entries()) {
    if (agora > rec.resetAt) rateLimitStore.delete(chave);
  }
}, 60000);

// ===================== ROTAS REST ======================

// Lista pública de usuários (sem senha) — útil na tela de login
app.get('/api/users', (req, res) => {
  const users = usersDb.get('users').value().map(usuarioPublico);
  res.json(users);
});

// Login
app.post('/api/login', rateLimit(5, 60000), (req, res) => {
  const { handle, password } = req.body || {};
  const handleRecebido = String(handle || '').trim().toLowerCase();
  const senhaRecebida = String(password || '');

  if (!handleRecebido || !senhaRecebida) {
    return res.status(400).json({ error: 'Informe handle e senha.' });
  }

    const usuario = obterUsuarioPorHandle(handleRecebido);
  if (!usuario || !usuario.passwordHash || !verificarPassword(senhaRecebida, usuario.passwordHash)) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  // Bloqueia login de usuários banidos
  if (usuario.banned) {
    return res.status(403).json({
      error: `Conta banida: ${usuario.banReason || 'contato com administrador'}.`,
      banned: true,
      banReason: usuario.banReason || '',
      bannedAt: usuario.bannedAt || 0
    });
  }

  const token = criarSessao(usuario.id);
  res.json({ token, user: usuarioPublico(usuario) });
});

// Login rápido (demo): entra sem senha pelo handle/email — usado pelos cards
// de perfil pré-cadastrados na tela de login. Remove em produção se desejado.
app.post('/api/quick-login', rateLimit(10, 60000), (req, res) => {
  const { handle } = req.body || {};
  const handleRecebido = String(handle || '').trim().toLowerCase();
  if (!handleRecebido) {
    return res.status(400).json({ error: 'Informe o handle.' });
  }

  const usuario = obterUsuarioPorHandle(handleRecebido);
  if (!usuario) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }
  if (usuario.banned) {
    return res.status(403).json({ error: `Conta banida: ${usuario.banReason || 'contato com administrador'}.` });
  }

  const token = criarSessao(usuario.id);
  res.json({ token, user: usuarioPublico(usuario) });
});

// Cadastro
app.post('/api/users', rateLimit(5, 60000), (req, res) => {
  const { name, handle, bio, avatar, password } = req.body || {};
  const nome = String(name || '').trim();
  const bioTexto = String(bio || '').trim().slice(0, 160);
  const handleTexto = String(handle || '').trim();
  const senhaTexto = String(password || '');

  if (!nome || nome.length < 2) {
    return res.status(400).json({ error: 'Informe um nome com pelo menos 2 caracteres.' });
  }
  if (!handleTexto || handleTexto.replace(/^@/, '').length < 2) {
    return res.status(400).json({ error: 'Informe um @handle válido.' });
  }
  if (!senhaTexto || senhaTexto.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const handleNormalizado = (handleTexto.startsWith('@') ? handleTexto : `@${handleTexto}`).toLowerCase();
  if (!/^@[a-z0-9_]{2,30}$/.test(handleNormalizado)) {
    return res.status(400).json({ error: 'Handle inválido. Use apenas letras, números e _ (2-30).' });
  }

  if (obterUsuarioPorHandle(handleNormalizado)) {
    return res.status(409).json({ error: 'Este @handle já está em uso.' });
  }

  let avatarUrl = `https://i.pravatar.cc/150?img=${Math.floor(1 + Math.random() * 70)}`;
  if (avatar) {
    try {
      avatarUrl = salvarMidiaBase64(avatar, 'image', MAX_AVATAR_BYTES) || avatarUrl;
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Avatar inválido.' });
    }
  }

  const novoUsuario = {
    id: gerarId('u'),
    name: nome,
    handle: handleNormalizado,
    avatar: avatarUrl,
    bio: bioTexto || 'Novo membro do Tadashi.',
    following: [],
    role: 'user',
    strikes: 0,
    banned: false,
    banReason: '',
    bannedAt: 0,
    bannedBy: '',
    passwordHash: criarPasswordHash(senhaTexto),
    createdAt: Date.now()
  };

  usersDb.get('users').push(novoUsuario).write();

  const token = criarSessao(novoUsuario.id);
  res.status(201).json({ token, user: usuarioPublico(novoUsuario) });
});

// Sessão atual
app.get('/api/me', middlewareAuth, (req, res) => {
  res.json(usuarioPublico(req.usuario));
});

// Logout
app.post('/api/logout', middlewareAuth, (req, res) => {
  revogarSessoesDoUsuario(req.usuario.id, req.token);
  res.json({ ok: true });
});

// Atualizar avatar (somente o próprio usuário)
app.post('/api/users/me/avatar', middlewareAuth, (req, res) => {
  const { avatar } = req.body || {};
  if (!avatar || !String(avatar).trim()) {
    return res.status(400).json({ error: 'Selecione uma imagem de perfil.' });
  }

  let avatarUrl;
  try {
    avatarUrl = salvarMidiaBase64(String(avatar).trim(), 'image', MAX_AVATAR_BYTES);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Imagem inválida.' });
  }
  if (!avatarUrl) {
    return res.status(400).json({ error: 'Imagem de perfil inválida.' });
  }

  usersDb.get('users').find({ id: req.usuario.id }).assign({ avatar: avatarUrl }).write();
  const atualizado = obterUsuarioPorId(req.usuario.id);

  // Atualiza avatar embutido nos posts do autor
  const posts = postsDb.get('posts').value();
  posts.forEach((p) => {
    if (p.authorId === atualizado.id) {
      p.authorAvatar = avatarUrl;
      p.authorName = atualizado.name;
      p.authorHandle = atualizado.handle;
    }
  });
  postsDb.set('posts', posts).write();

  io.emit('usuarioAtualizado', {
    id: atualizado.id,
    avatar: atualizado.avatar,
    name: atualizado.name,
    handle: atualizado.handle
  });

  res.json(usuarioPublico(atualizado));
});

// Compat: rota antiga de avatar com id — só permite se for o próprio usuário
app.post('/api/users/:id/avatar', middlewareAuth, (req, res) => {
  if (req.params.id !== req.usuario.id) {
    return res.status(403).json({ error: 'Você só pode alterar o próprio avatar.' });
  }

  const { avatar } = req.body || {};
  if (!avatar || !String(avatar).trim()) {
    return res.status(400).json({ error: 'Selecione uma imagem de perfil.' });
  }

  let avatarUrl;
  try {
    avatarUrl = salvarMidiaBase64(String(avatar).trim(), 'image', MAX_AVATAR_BYTES);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Imagem inválida.' });
  }
  if (!avatarUrl) {
    return res.status(400).json({ error: 'Imagem de perfil inválida.' });
  }

  usersDb.get('users').find({ id: req.usuario.id }).assign({ avatar: avatarUrl }).write();
  const atualizado = obterUsuarioPorId(req.usuario.id);

  const posts = postsDb.get('posts').value();
  posts.forEach((p) => {
    if (p.authorId === atualizado.id) {
      p.authorAvatar = avatarUrl;
      p.authorName = atualizado.name;
      p.authorHandle = atualizado.handle;
    }
  });
  postsDb.set('posts', posts).write();

  io.emit('usuarioAtualizado', {
    id: atualizado.id,
    avatar: atualizado.avatar,
    name: atualizado.name,
    handle: atualizado.handle
  });

  res.json(usuarioPublico(atualizado));
});


// Mensagens do usuário autenticado
app.get('/api/messages', middlewareAuth, (req, res) => {
  const userId = req.usuario.id;
  const mensagens = messagesDb.get('messages')
    .filter((m) => m.fromId === userId || m.toId === userId)
    .sortBy('createdAt')
    .value();
  res.json(mensagens);
});

// Compat antiga
app.get('/api/messages/:userId', middlewareAuth, (req, res) => {
  if (req.params.userId !== req.usuario.id) {
    return res.status(403).json({ error: 'Acesso negado às mensagens de outro usuário.' });
  }
  const mensagens = messagesDb.get('messages')
    .filter((m) => m.fromId === req.usuario.id || m.toId === req.usuario.id)
    .sortBy('createdAt')
    .value();
  res.json(mensagens);
});

// Enviar mensagem (REST)
app.post('/api/messages', middlewareAuth, (req, res) => {
  const { toId, texto, imagem, video, audio } = req.body || {};
  const fromId = req.usuario.id;
  const destinatario = obterUsuarioPorId(toId);

  if (!destinatario) {
    return res.status(400).json({ error: 'Destinatário inválido.' });
  }
  if (textoTemPalavraOfensiva(texto)) {
    const strikes = registrarStrike(fromId, 'Mensagem ofensiva');
    const msg = strikes ? `Mensagem bloqueada. Strike ${strikes}/${MAX_STRIKES}.` : 'Mensagem bloqueada por conteúdo ofensivo.';
    return res.status(400).json({ error: msg });
  }

  let imgUrl = null;
  let vidUrl = null;
  let audUrl = null;
  try {
    if (imagem) imgUrl = salvarMidiaBase64(String(imagem).trim(), 'image', MAX_IMAGE_BYTES);
    if (video) vidUrl = salvarMidiaBase64(String(video).trim(), 'video', MAX_VIDEO_BYTES);
    if (audio) audUrl = salvarMidiaBase64(String(audio).trim(), 'audio', MAX_IMAGE_BYTES);
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Mídia inválida.' });
  }

  const textoLimpo = String(texto || '').trim().slice(0, 280);
  if (!textoLimpo && !imgUrl && !vidUrl && !audUrl) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  const mensagem = {
    id: gerarId('m'),
    fromId,
    toId,
    texto: textoLimpo,
    imagem: imgUrl,
    video: vidUrl,
    audio: audUrl,
    tipo: imgUrl ? 'imagem' : (vidUrl ? 'video' : (audUrl ? 'audio' : 'texto')),
    createdAt: Date.now()
  };

  messagesDb.get('messages').push(mensagem).write();
  io.emit('mensagemCriada', mensagem);

  const notif = criarNotificacao(
    toId,
    `${req.usuario.name} enviou uma ${mensagem.tipo === 'texto' ? 'mensagem' : mensagem.tipo}`,
    'mensagem',
    fromId
  );
  if (notif) io.emit('notificacao', notif);

  res.status(201).json(mensagem);
});

// Posts
app.get('/api/posts', (req, res) => {
  const posts = postsDb.get('posts').sortBy('createdAt').reverse().value();
  res.json(posts);
});

app.get('/api/posts/usuario/:id', (req, res) => {
  const posts = postsDb.get('posts')
    .filter((p) => p.authorId === req.params.id || (p.repostBy && p.repostBy.id === req.params.id))
    .sortBy('createdAt')
    .reverse()
    .value();
  res.json(posts);
});

// Notificações persistentes
app.get('/api/notifications', middlewareAuth, (req, res) => {
  const lista = notificationsDb.get('notifications')
    .filter({ paraUserId: req.usuario.id })
    .sortBy('createdAt')
    .reverse()
    .value();
  res.json(lista);
});

app.post('/api/notifications/read', middlewareAuth, (req, res) => {
  const todas = notificationsDb.get('notifications').value();
  let alterou = false;
  todas.forEach((n) => {
    if (n.paraUserId === req.usuario.id && !n.lida) {
      n.lida = true;
      alterou = true;
    }
  });
  if (alterou) notificationsDb.set('notifications', todas).write();
  res.json({ ok: true });
});

// ===================== ROTAS ADMIN =====================
// Listar todos os usuários (admin)
app.get('/api/admin/users', middlewareAuth, middlewareAdmin, (req, res) => {
  const usuarios = usersDb.get('users').map((u) => {
    const clone = { ...u };
    delete clone.passwordHash;
    return clone;
  }).value();
  res.json(usuarios);
});

// Listar reports (admin)
app.get('/api/admin/reports', middlewareAuth, middlewareAdmin, (req, res) => {
  const qs = req.query || {};
  let query = reportsDb.get('reports');
  if (qs.resolvidos === 'false' || qs.resolvidos === undefined) {
    query = query.filter({ resolvido: false });
  } else if (qs.resolvidos === 'true') {
    query = query.filter({ resolvido: true });
  }
  const reports = query.sortBy('createdAt').reverse().value();
  res.json(reports);
});

// Responder a um report (admin)
app.post('/api/admin/reports/:id/responder', middlewareAuth, middlewareAdmin, (req, res) => {
  const { id } = req.params;
  const { resolver = true, banir = false, motivoBan = 'Violação das regras' } = req.body || {};

  const report = reportsDb.get('reports').find({ id }).value();
  if (!report) return res.status(404).json({ error: 'Reporte não encontrado.' });

  reportsDb.get('reports').find({ id }).assign({ resolvido: !!resolver }).write();

  const usuario = obterUsuarioPorId(report.targetUserId);
  if (banir && usuario && !usuario.banned) {
    usersDb.get('users').find({ id: report.targetUserId }).assign({
      banned: true,
      banReason: motivoBan,
      bannedAt: Date.now(),
      bannedBy: req.usuario.id
    }).write();
    revogarSessoesDoUsuario(report.targetUserId);
    io.to(`user:${report.targetUserId}`).emit('usuarioBanido', {
      motivo: motivoBan,
      strikes: usuario.strikes || 0
    });
  }

  io.emit('reporteAtualizado', { id, resolvido: !!resolver });
  res.json({ ok: true });
});

// Deletar qualquer post (admin) – limpa mídia do disco
app.delete('/api/admin/posts/:id', middlewareAuth, middlewareAdmin, (req, res) => {
  const post = postsDb.get('posts').find({ id: req.params.id }).value();
  if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
  removerMidiaPost(post);
  postsDb.get('posts').remove({ id: req.params.id }).write();
  io.emit('postDeletado', { postId: req.params.id });
  res.json({ ok: true });
});

// Banir usuário (admin)
app.post('/api/admin/users/:id/ban', middlewareAuth, middlewareAdmin, (req, res) => {
  const { motivo = 'Violação das regras' } = req.body || {};
  const usuario = obterUsuarioPorId(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (usuario.role === 'admin') return res.status(400).json({ error: 'Não é possível banir outro admin.' });

  usersDb.get('users').find({ id: req.params.id }).assign({
    banned: true,
    banReason: motivo,
    bannedAt: Date.now(),
    bannedBy: req.usuario.id
  }).write();
  revogarSessoesDoUsuario(req.params.id);
  io.to(`user:${req.params.id}`).emit('usuarioBanido', { motivo, strikes: usuario.strikes || 0 });
  notificarAdmins(`${usuario.name} (@${usuario.handle}) foi banido por ${req.usuario.name}.`, 'banimento', req.params.id);

  res.json({ ok: true });
});

// Desbanir usuário (admin)
app.post('/api/admin/users/:id/unban', middlewareAuth, middlewareAdmin, (req, res) => {
  const usuario = obterUsuarioPorId(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

  usersDb.get('users').find({ id: req.params.id }).assign({
    banned: false,
    banReason: '',
    bannedAt: 0,
    bannedBy: '',
    strikes: 0
  }).write();

  notificarAdmins(`${usuario.name} (@${usuario.handle}) foi desbanido por ${req.usuario.name}.`, 'banimento', req.params.id);
  res.json({ ok: true });
});

// Reportar post (usuário comum) – cria report para análise do admin
app.post('/api/posts/:id/reportar', middlewareAuth, (req, res) => {
  const post = postsDb.get('posts').find({ id: req.params.id }).value();
  if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

  const report = {
    id: gerarId('r'),
    tipo: 'manual',
    motivo: String((req.body || {}).motivo || 'Conteúdo ofensivo').slice(0, 280),
    deUserId: req.usuario.id,
    targetUserId: post.authorId,
    postId: req.params.id,
    resolvido: false,
    createdAt: Date.now()
  };
  reportsDb.get('reports').unshift(report).write();

  notificarAdmins(
    `${req.usuario.name} reportou post de ${post.authorName || 'usuário'}: ${report.motivo}`,
    'reporte',
    req.usuario.id
  );

  io.to(`user:${post.authorId}`).emit('postReportado', { postId: req.params.id });
  res.status(201).json({ ok: true, report });
});

// ===================== SOCKET.IO ======================
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const auth = validarToken(token);
    if (!auth) return next(new Error('Não autenticado'));
    socket.userId = auth.usuario.id;
    socket.usuario = auth.usuario;
    next();
  } catch (err) {
    next(new Error('Não autenticado'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id} (${socket.usuario.handle})`);
  socket.join(`user:${socket.userId}`);

  socket.on('novoPost', (dados = {}) => {
    const autor = obterUsuarioPorId(socket.userId);
    if (!autor) return;

    const texto = String(dados.texto || '').slice(0, 280);
    if (textoTemPalavraOfensiva(texto)) {
      const strikes = registrarStrike(autor.id, 'Post com conteúdo ofensivo');
      const msg = strikes ? `Post bloqueado. Strike ${strikes}/${MAX_STRIKES}.` : 'Post bloqueado por conteúdo ofensivo.';
      socket.emit('erroAcao', { error: msg });
      return;
    }

    let imagem = null;
    let video = null;
    try {
      if (dados.imagem) imagem = salvarMidiaBase64(dados.imagem, 'image', MAX_IMAGE_BYTES);
      if (dados.video) video = salvarMidiaBase64(dados.video, 'video', MAX_VIDEO_BYTES);
    } catch (err) {
      socket.emit('erroAcao', { error: err.message || 'Mídia inválida.' });
      return;
    }

    if (!texto.trim() && !imagem && !video) {
      socket.emit('erroAcao', { error: 'Post vazio.' });
      return;
    }

    const post = {
      id: gerarId('p'),
      authorId: autor.id,
      authorName: autor.name,
      authorHandle: autor.handle,
      authorAvatar: autor.avatar,
      texto,
      imagem,
      video,
      createdAt: Date.now(),
      likes: [],
      comentarios: [],
      repostBy: null,
      originalId: null
    };

    postsDb.get('posts').push(post).write();
    io.emit('postCriado', post);

    // Notifica usuários mencionados via @handle
    const mencionados = extrairUsuariosMencionados(texto, autor.id);
    mencionados.forEach((uid) => {
      const notif = criarNotificacao(uid, `${autor.name} mencionou você em um post`, 'menção', autor.id);
      if (notif) io.to(`user:${uid}`).emit('notificacao', notif);
    });
  });

  socket.on('curtir', ({ postId } = {}) => {
    const userId = socket.userId;
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    if (!Array.isArray(post.likes)) post.likes = [];
    const jaCurtiu = post.likes.includes(userId);
    post.likes = jaCurtiu
      ? post.likes.filter((id) => id !== userId)
      : [...post.likes, userId];

    postsDb.get('posts').find({ id: postId }).assign(post).write();
    io.emit('postAtualizado', post);

    if (!jaCurtiu && post.authorId !== userId) {
      const quem = obterUsuarioPorId(userId);
      const notif = criarNotificacao(
        post.authorId,
        `${quem ? quem.name : 'Alguém'} curtiu seu post`,
        'like',
        userId
      );
      if (notif) io.to(`user:${post.authorId}`).emit('notificacao', notif);
    }
  });

  socket.on('repostar', ({ postId } = {}) => {
    const userId = socket.userId;
    const original = postsDb.get('posts').find({ id: postId }).value();
    const usuario = obterUsuarioPorId(userId);
    if (!original || !usuario) return;

    const originalRef = original.originalId || original.id;

    const jaRepostou = postsDb.get('posts').find((p) =>
      p.originalId === originalRef && p.repostBy && p.repostBy.id === usuario.id
    ).value();

    if (jaRepostou) {
      socket.emit('erroAcao', { error: 'Você já repostou isso.' });
      return;
    }

    const repost = {
      id: gerarId('p'),
      authorId: original.authorId,
      authorName: original.authorName,
      authorHandle: original.authorHandle,
      authorAvatar: original.authorAvatar,
      texto: original.texto,
      imagem: original.imagem,
      video: original.video,
      createdAt: Date.now(),
      likes: [],
      comentarios: [],
      repostBy: { id: usuario.id, name: usuario.name, handle: usuario.handle },
      originalId: originalRef
    };

    postsDb.get('posts').push(repost).write();
    io.emit('postCriado', repost);

    if (original.authorId !== usuario.id) {
      const notif = criarNotificacao(
        original.authorId,
        `${usuario.name} repostou seu post`,
        'repost',
        usuario.id
      );
      if (notif) io.to(`user:${original.authorId}`).emit('notificacao', notif);
    }
  });

  socket.on('deletarPost', ({ postId } = {}) => {
    const userId = socket.userId;
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    const ehAutor = post.authorId === userId;
    const ehRepostProprio = post.repostBy && post.repostBy.id === userId;
    const ehAdmin = socket.usuario.role === 'admin';

    if (!ehAutor && !ehRepostProprio && !ehAdmin) {
      socket.emit('erroAcao', { error: 'Sem permissão para deletar.' });
      return;
    }

    const idsRemovidos = [postId];
    
    // Limpa arquivos de mídia do disco
    removerMidiaPost(post);

    // Se for post original (não repost), remove também os reposts derivados
    if (!post.repostBy) {
      const reposts = postsDb.get('posts')
        .filter((p) => p.originalId === post.id)
        .value();
      reposts.forEach((r) => idsRemovidos.push(r.id));
      postsDb.get('posts').remove((p) => p.id === post.id || p.originalId === post.id).write();
    } else {
      postsDb.get('posts').remove({ id: postId }).write();
    }

    idsRemovidos.forEach((id) => io.emit('postDeletado', { postId: id }));
  });

  // ---------- Reportar post (usuário comum) ----------
  socket.on('reportarPost', ({ postId, motivo } = {}) => {
    const userId = socket.userId;
    if (!postId || !motivo || !String(motivo).trim()) return;
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    const usuario = obterUsuarioPorId(userId);
    if (!usuario) return;

    const report = {
      id: gerarId('r'),
      tipo: 'manual',
      motivo: String(motivo).trim().slice(0, 280),
      deUserId: userId,
      targetUserId: post.authorId,
      postId,
      resolvido: false,
      createdAt: Date.now()
    };
    reportsDb.get('reports').unshift(report).write();

    notificarAdmins(
      `${usuario.name} (@${usuario.handle}) reportou post: ${report.motivo}`,
      'reporte',
      userId
    );

    io.emit('reporteCriado', report);
    socket.emit('reporteEnviado', { ok: true });
  });

  // ---------- Admin: banir usuário ----------
  socket.on('adminBanirUsuario', ({ alvoId, motivo } = {}) => {
    if (!socket.usuario || socket.usuario.role !== 'admin') {
      socket.emit('erroAcao', { error: 'Acesso restrito.' });
      return;
    }
    const usuario = obterUsuarioPorId(alvoId);
    if (!usuario) {
      socket.emit('erroAcao', { error: 'Usuário não encontrado.' });
      return;
    }
    if (usuario.role === 'admin') {
      socket.emit('erroAcao', { error: 'Não é possível banir outro admin.' });
      return;
    }

    usersDb.get('users').find({ id: alvoId }).assign({
      banned: true,
      banReason: motivo || 'Violação das regras',
      bannedAt: Date.now(),
      bannedBy: socket.usuario.id
    }).write();
    revogarSessoesDoUsuario(alvoId);
    io.to(`user:${alvoId}`).emit('usuarioBanido', {
      motivo: motivo || 'Violação das regras',
      strikes: usuario.strikes || 0
    });
    notificarAdmins(
      `${usuario.name} (@${usuario.handle}) foi banido por ${socket.usuario.name}.`,
      'banimento',
      alvoId
    );
    io.emit('usuarioAtualizado', { id: alvoId, banned: true });
  });

  // ---------- Admin: desbanir usuário ----------
  socket.on('adminDesbanirUsuario', ({ alvoId } = {}) => {
    if (!socket.usuario || socket.usuario.role !== 'admin') {
      socket.emit('erroAcao', { error: 'Acesso restrito.' });
      return;
    }
    const usuario = obterUsuarioPorId(alvoId);
    if (!usuario) {
      socket.emit('erroAcao', { error: 'Usuário não encontrado.' });
      return;
    }

    usersDb.get('users').find({ id: alvoId }).assign({
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      strikes: 0
    }).write();

    notificarAdmins(
      `${usuario.name} (@${usuario.handle}) foi desbanido por ${socket.usuario.name}.`,
      'banimento',
      alvoId
    );
    io.emit('usuarioAtualizado', { id: alvoId, banned: false });
  });

  // ---------- Admin: forçar deletar post de outro usuário ----------
  socket.on('adminDeletarPost', ({ postId } = {}) => {
    const userId = socket.userId;
    const usuario = socket.usuario;
    if (!usuario || usuario.role !== 'admin') {
      socket.emit('erroAcao', { error: 'Acesso restrito.' });
      return;
    }
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    // Limpa arquivos de mídia do disco
    removerMidiaPost(post);
    postsDb.get('posts').remove({ id: postId }).write();
    io.emit('postDeletado', { postId });
    io.emit('postModerado', { postId, adminId: userId });
  });

  socket.on('comentar', ({ postId, texto } = {}) => {
    const userId = socket.userId;
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    if (textoTemPalavraOfensiva(texto)) {
      const strikes = registrarStrike(userId, 'Comentário ofensivo');
      const msg = strikes ? `Comentário bloqueado. Strike ${strikes}/${MAX_STRIKES}.` : 'Comentário bloqueado por conteúdo ofensivo.';
      socket.emit('erroAcao', { error: msg });
      return;
    }

    const usuario = obterUsuarioPorId(userId);
    if (!post.comentarios) post.comentarios = [];

    const comentario = {
      id: gerarId('c'),
      autorId: userId,
      autor: usuario ? usuario.name : 'Anônimo',
      handle: usuario ? usuario.handle : '',
      texto: String(texto || '').slice(0, 280),
      createdAt: Date.now()
    };

    if (!comentario.texto.trim()) return;

    post.comentarios.push(comentario);
    postsDb.get('posts').find({ id: postId }).assign(post).write();
    io.emit('postAtualizado', post);

    // Notifica usuários mencionados no comentário
    extrairUsuariosMencionados(comentario.texto, userId).forEach((uid) => {
      const notif = criarNotificacao(uid, `${usuario ? usuario.name : 'Alguém'} mencionou você em um comentário`, 'menção', userId);
      if (notif) io.to(`user:${uid}`).emit('notificacao', notif);
    });

    if (post.authorId !== userId) {
      const notif = criarNotificacao(
        post.authorId,
        `${usuario ? usuario.name : 'Alguém'} comentou no seu post`,
        'comentario',
        userId
      );
      if (notif) io.to(`user:${post.authorId}`).emit('notificacao', notif);
    }
  });

  socket.on('enviarMensagem', ({ toId, texto, imagem, video, audio } = {}) => {
    const fromId = socket.userId;
    const remetente = obterUsuarioPorId(fromId);
    const destinatario = obterUsuarioPorId(toId);
    if (!remetente || !destinatario) return;

    if (textoTemPalavraOfensiva(texto)) {
      const strikes = registrarStrike(fromId, 'Mensagem ofensiva');
      const msg = strikes ? `Mensagem bloqueada. Strike ${strikes}/${MAX_STRIKES}.` : 'Mensagem bloqueada por conteúdo ofensivo.';
      socket.emit('erroAcao', { error: msg });
      return;
    }

    let imgUrl = null;
    let vidUrl = null;
    let audUrl = null;
    try {
      if (imagem) imgUrl = salvarMidiaBase64(String(imagem).trim(), 'image', MAX_IMAGE_BYTES);
      if (video) vidUrl = salvarMidiaBase64(String(video).trim(), 'video', MAX_VIDEO_BYTES);
      if (audio) audUrl = salvarMidiaBase64(String(audio).trim(), 'audio', MAX_IMAGE_BYTES);
    } catch (err) {
      socket.emit('erroAcao', { error: err.message || 'Mídia inválida.' });
      return;
    }

    const textoLimpo = String(texto || '').trim().slice(0, 280);
    if (!textoLimpo && !imgUrl && !vidUrl && !audUrl) return;

    const mensagem = {
      id: gerarId('m'),
      fromId,
      toId,
      texto: textoLimpo,
      imagem: imgUrl,
      video: vidUrl,
      audio: audUrl,
      tipo: imgUrl ? 'imagem' : (vidUrl ? 'video' : (audUrl ? 'audio' : 'texto')),
      createdAt: Date.now()
    };

    messagesDb.get('messages').push(mensagem).write();
    io.emit('mensagemCriada', mensagem);

    const notif = criarNotificacao(
      toId,
      `${remetente.name} enviou uma ${mensagem.tipo === 'texto' ? 'mensagem' : mensagem.tipo}`,
      'mensagem',
      fromId
    );
    if (notif) io.to(`user:${toId}`).emit('notificacao', notif);
  });

  socket.on('seguir', ({ alvoId } = {}) => {
    const userId = socket.userId;
    if (!alvoId || userId === alvoId) return;

    const usuario = obterUsuarioPorId(userId);
    const alvo = obterUsuarioPorId(alvoId);
    if (!usuario || !alvo) return;

    if (!Array.isArray(usuario.following)) usuario.following = [];
    const jaSegue = usuario.following.includes(alvoId);

    usuario.following = jaSegue
      ? usuario.following.filter((id) => id !== alvoId)
      : [...usuario.following, alvoId];

    usersDb.get('users').find({ id: userId }).assign({ following: usuario.following }).write();

    io.emit('seguidorAtualizado', {
      userId,
      alvoId,
      seguindo: !jaSegue,
      following: usuario.following
    });

    if (!jaSegue) {
      const notif = criarNotificacao(
        alvoId,
        `${usuario.name} começou a seguir você`,
        'seguir',
        userId
      );
      if (notif) io.to(`user:${alvoId}`).emit('notificacao', notif);
    }
  });

  // ---------- Chamada de voz (WebRTC via Socket.io) ----------
  // Sinalização apenas: os dois lados trocam offer/answer/ICE diretamente.
  socket.on('chamarVoz', ({ toId } = {}) => {
    const fromId = socket.userId;
    const remetente = obterUsuarioPorId(fromId);
    const destinatario = obterUsuarioPorId(toId);
    if (!remetente || !destinatario || fromId === toId) return;

    io.to(`user:${toId}`).emit('chamadaVozEntrada', {
      callId: `${fromId}-${toId}-${Date.now()}`,
      fromId,
      fromName: remetente.name,
      fromHandle: remetente.handle,
      fromAvatar: remetente.avatar
    });
  });

  socket.on('chamadaVozResposta', ({ toId, aceita, callId } = {}) => {
    const fromId = socket.userId;
    const remetente = obterUsuarioPorId(fromId);
    if (!remetente) return;
    if (aceita) {
      io.to(`user:${toId}`).emit('chamadaVozAceita', { callId, toName: remetente.name, toHandle: remetente.handle, toAvatar: remetente.avatar });
    } else {
      io.to(`user:${toId}`).emit('chamadaVozRejeitada', { callId });
    }
  });

  // Reencaminha oferta/resposta/ICE do WebRTC para o participante da chamada
  socket.on('sinalVoz', ({ toId, fromId, descricao, candidato } = {}) => {
    if (!toId || !descricao) return;
    const remetente = socket.usuario;
    if (!remetente) return;
    io.to(`user:${toId}`).emit('sinalVoz', {
      fromId,
      descricao,
      candidato
    });
  });

  socket.on('encerrarChamada', ({ toId } = {}) => {
    if (toId) io.to(`user:${toId}`).emit('chamadaEncerrada', { fromId: socket.userId });
  });

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// -------------------- Start --------------------
server.listen(PORT, HOST, () => {
  const protocolo = (!IS_PRODUCTION && fs.existsSync(path.join(__dirname, 'cert', 'tadashi-cert.pem')))
    ? 'https'
    : 'http';
  console.log(`🚀 Tadashi rodando em ${protocolo}://${HOST}:${PORT}`);
  if (!IS_PRODUCTION) {
    console.log(`🌍 Rede local: ${protocolo}://${ipLocalLan()}:${PORT}`);
  }
});
