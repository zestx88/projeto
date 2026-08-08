// ============================================================
// TADASHI - server.js
// Backend: Express (rotas HTTP/API) + Socket.io (tempo real) + lowdb (persistência em JSON)
// ============================================================

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

// --- lowdb (versão 1.x, API síncrona, ótima para projetos pequenos) ---
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Garante que o diretório de dados exista (criado automaticamente em produção)
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Cada "banco" é um arquivo JSON separado dentro de /data
const usersDb = low(new FileSync(path.join(dataDir, 'users.json')));
const postsDb = low(new FileSync(path.join(dataDir, 'posts.json')));
const messagesDb = low(new FileSync(path.join(dataDir, 'messages.json')));

// Garante valores padrão caso os arquivos estejam vazios
usersDb.defaults({ users: [] }).write();
postsDb.defaults({ posts: [] }).write();
messagesDb.defaults({ messages: [] }).write();

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

const palavrasOfensivas = [
  'idiota', 'imbecil', 'burro', 'bosta', 'lixo', 'pqp', 'puta', 'puta',
  'merda', 'desgraçado', 'desgraçada', 'fdp', 'filhodaputa', 'cuzão', 'cuzao', ''
];

function textoTemPalavraOfensiva(texto) {
  if (!texto || !String(texto).trim()) return false;

  const textoNormalizado = String(texto).toLowerCase();
  return palavrasOfensivas.some((palavra) => textoNormalizado.includes(palavra));
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
  const hashEsperadoBuffer = Buffer.from(hashEsperado, 'hex');
  const hashTentativaBuffer = Buffer.from(hashTentativa, 'hex');

  if (hashEsperadoBuffer.length !== hashTentativaBuffer.length) return false;

  return crypto.timingSafeEqual(hashEsperadoBuffer, hashTentativaBuffer);
}

// --- Configuração do servidor ---
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let server;
let io;

if (IS_PRODUCTION) {
  // Em produção (Render), o HTTPS é fornecido pelo proxy do Render.
  // O servidor escuta em HTTP na porta definida pelo Render.
  server = http.createServer(app);
  console.log('🌐 Modo produção: usando HTTP (HTTPS fornecido pelo Render)');
} else {
  // Localmente, usamos HTTPS com certificados mkcert confiáveis
  const certPath = path.join(__dirname, 'cert', 'tadashi-cert.pem');
  const keyPath = path.join(__dirname, 'cert', 'tadashi-key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    server = https.createServer(httpsOptions, app);
    console.log('🔒 Modo local: usando HTTPS com certificado mkcert');
  } else {
    server = http.createServer(app);
    console.log('⚠️ Certificados não encontrados, usando HTTP');
  }
}

io = new Server(server, {
  maxHttpBufferSize: 100 * 1024 * 1024 // aceita data URL de vídeo/imagem em base64 pela conexão Socket.IO
});

app.use(express.json({ limit: '50mb' })); // limit maior por causa de imagens e vídeos em base64
app.use(express.static(path.join(__dirname, 'public'))); // serve o frontend estático

// ===================== ROTAS REST (API) ======================

// GET /api/users -> retorna os usuários cadastrados (para tela de login)
app.get('/api/users', (req, res) => {
  const users = usersDb.get('users').value();
  const response = users.map((u) => {
    const clone = { ...u };
    delete clone.passwordHash;
    return clone;
  });
  res.json(response);
});

// POST /api/login -> login por handle e senha
app.post('/api/login', (req, res) => {
  const { handle, password } = req.body || {};
  const handleRecebido = String(handle || '').trim().toLowerCase();
  const senhaRecebida = String(password || '');

  if (!handleRecebido || !senhaRecebida) {
    return res.status(400).json({ error: 'Informe handle e senha.' });
  }

  const usuario = usersDb.get('users')
    .find((u) => String(u.handle).toLowerCase() === handleRecebido)
    .value();

  if (!usuario || !usuario.passwordHash) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const senhaValida = verificarPassword(senhaRecebida, usuario.passwordHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const usuarioPublico = { ...usuario };
  delete usuarioPublico.passwordHash;
  res.json(usuarioPublico);
});

// POST /api/users/:id/avatar -> atualiza a foto de perfil do usuário
app.post('/api/users/:id/avatar', (req, res) => {
  const userId = req.params.id;
  const { avatar } = req.body || {};
  const avatarTexto = String(avatar || '').trim();

  if (!userId) {
    return res.status(400).json({ error: 'Usuário inválido.' });
  }

  if (!avatarTexto) {
    return res.status(400).json({ error: 'Selecione uma imagem de perfil.' });
  }

  const usuario = usersDb.get('users').find({ id: userId }).value();
  if (!usuario) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  usuario.avatar = avatarTexto;
  usersDb.get('users').find({ id: userId }).assign(usuario).write();

  const usuarioPublico = { ...usuario };
  delete usuarioPublico.passwordHash;

  io.emit('usuarioAtualizado', {
    id: usuario.id,
    avatar: usuario.avatar,
    name: usuario.name,
    handle: usuario.handle
  });

  res.json(usuarioPublico);
});

// POST /api/users -> cria uma nova conta do usuário
app.post('/api/users', (req, res) => {
  const { name, handle, bio, avatar, password } = req.body || {};
  const nome = String(name || '').trim();
  const bioTexto = String(bio || '').trim();
  const handleTexto = String(handle || '').trim();
  const senhaTexto = String(password || '').trim();

  if (!nome || nome.length < 2) {
    return res.status(400).json({ error: 'Informe um nome com pelo menos 2 caracteres.' });
  }

  if (!handleTexto || handleTexto.length < 2) {
    return res.status(400).json({ error: 'Informe um @handle válido.' });
  }

  if (!senhaTexto || senhaTexto.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const handleNormalizado = handleTexto.startsWith('@') ? handleTexto : `@${handleTexto}`;
  const handleComercial = handleNormalizado.toLowerCase();

  const jaExiste = usersDb.get('users').find({ handle: handleComercial }).value();
  if (jaExiste) {
    return res.status(409).json({ error: 'Este @handle já está em uso.' });
  }

  const novoUsuario = {
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: nome,
    handle: handleComercial,
    avatar: avatar || `https://i.pravatar.cc/150?img=${Math.floor(1 + Math.random() * 70)}`,
    bio: bioTexto || 'Novo membro do Tadashi.',
    following: [],
    passwordHash: criarPasswordHash(senhaTexto)
  };

  usersDb.get('users').push(novoUsuario).write();
  const usuarioPublico = { ...novoUsuario };
  delete usuarioPublico.passwordHash;
  res.status(201).json(usuarioPublico);
});

// GET /api/messages/:userId -> lista mensagens do usuário autenticado
app.get('/api/messages/:userId', (req, res) => {
  const mensagens = messagesDb.get('messages')
    .filter((m) => m.fromId === req.params.userId || m.toId === req.params.userId)
    .sortBy('createdAt')
    .value();

  res.json(mensagens);
});

// POST /api/messages -> cria e persiste uma mensagem privada
app.post('/api/messages', (req, res) => {
  const { fromId, toId, texto } = req.body || {};
  const remetente = usersDb.get('users').find({ id: fromId }).value();
  const destinatario = usersDb.get('users').find({ id: toId }).value();

  if (!remetente || !destinatario || !texto || String(texto).trim().length === 0) {
    return res.status(400).json({ error: 'Mensagem inválida.' });
  }

  if (textoTemPalavraOfensiva(texto)) {
    return res.status(400).json({ error: 'Mensagem bloqueada por conteúdo ofensivo.' });
  }

  const mensagem = {
    id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    fromId,
    toId,
    texto: String(texto).trim().slice(0, 280),
    createdAt: Date.now()
  };

  messagesDb.get('messages').push(mensagem).write();
  io.emit('mensagemCriada', mensagem);
  res.status(201).json(mensagem);
});

// GET /api/posts -> retorna todos os posts, mais recentes primeiro
app.get('/api/posts', (req, res) => {
  const posts = postsDb.get('posts').sortBy('createdAt').reverse().value();
  res.json(posts);
});

// GET /api/posts/usuario/:id -> retorna apenas os posts (e reposts) de um usuário específico
// usado na página de Perfil
app.get('/api/posts/usuario/:id', (req, res) => {
  const posts = postsDb.get('posts')
    .filter((p) => p.authorId === req.params.id || (p.repostBy && p.repostBy.id === req.params.id))
    .sortBy('createdAt')
    .reverse()
    .value();
  res.json(posts);
});

// ===================== SOCKET.IO (tempo real) ======================
// Toda a lógica de criar/curtir/repostar/deletar posts acontece aqui,
// pois precisamos emitir os eventos para TODOS os clientes conectados
// instantaneamente (broadcast), e não apenas responder quem fez a ação.

io.on('connection', (socket) => {
  console.log(`🔌 Novo cliente conectado: ${socket.id}`);

  // --- Evento: novo post criado por um usuário ---
  socket.on('novoPost', (dados) => {
    // dados = { authorId, texto, imagem }
    const autor = usersDb.get('users').find({ id: dados.authorId }).value();
    if (!autor) return;

    if (textoTemPalavraOfensiva(dados.texto)) return;

    const post = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      authorId: autor.id,
      authorName: autor.name,
      authorHandle: autor.handle,
      authorAvatar: autor.avatar,
      texto: (dados.texto || '').slice(0, 280), // garante limite de 280 chars no backend também
      imagem: dados.imagem || null,
      video: dados.video || null,
      createdAt: Date.now(),
      likes: [],       // array de ids de usuários que curtiram
      repostBy: null,  // se for um repost, guarda quem repostou
      originalId: null // referência ao post original (quando repost)
    };

    postsDb.get('posts').push(post).write(); // salva no lowdb
    io.emit('postCriado', post); // envia para TODOS os clientes (broadcast em tempo real)
  });

  // --- Evento: curtir/descurtir um post ---
  socket.on('curtir', ({ postId, userId }) => {
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    const jaCurtiu = post.likes.includes(userId);
    if (jaCurtiu) {
      // remove o like (toggle)
      post.likes = post.likes.filter((id) => id !== userId);
    } else {
      post.likes.push(userId);
    }

    postsDb.get('posts').find({ id: postId }).assign(post).write();

    // envia atualização do post para todos
    io.emit('postAtualizado', post);

    // se foi um like novo (não remoção) e o autor não é quem curtiu, notifica o autor
    if (!jaCurtiu && post.authorId !== userId) {
      const quemCurtiu = usersDb.get('users').find({ id: userId }).value();
      io.emit('notificacao', {
        paraUserId: post.authorId,
        mensagem: `${quemCurtiu ? quemCurtiu.name : 'Alguém'} curtiu seu post`
      });
    }
  });

  // --- Evento: repostar um post existente ---
  socket.on('repostar', ({ postId, userId }) => {
    const original = postsDb.get('posts').find({ id: postId }).value();
    const usuario = usersDb.get('users').find({ id: userId }).value();
    if (!original || !usuario) return;

    // evita repost duplicado da mesma pessoa
    const jaRepostou = postsDb.get('posts')
      .find({ originalId: original.originalId || original.id, repostBy: usuario.id })
      .value();
    if (jaRepostou) return;

    const repost = {
      id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      authorId: original.authorId,
      authorName: original.authorName,
      authorHandle: original.authorHandle,
      authorAvatar: original.authorAvatar,
      texto: original.texto,
      imagem: original.imagem,
      video: original.video,
      createdAt: Date.now(),
      likes: [],
      repostBy: { id: usuario.id, name: usuario.name, handle: usuario.handle },
      originalId: original.originalId || original.id
    };

    postsDb.get('posts').push(repost).write();
    io.emit('postCriado', repost); // aparece no feed de todos como novo post

    if (original.authorId !== usuario.id) {
      io.emit('notificacao', {
        paraUserId: original.authorId,
        mensagem: `${usuario.name} repostou seu post`
      });
    }
  });

  // --- Evento: deletar post (apenas o autor pode) ---
  socket.on('deletarPost', ({ postId, userId }) => {
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;
    if (post.authorId !== userId) return; // segurança: só o autor deleta

    postsDb.get('posts').remove({ id: postId }).write();
    io.emit('postDeletado', { postId }); // remove em tempo real de todos os clientes
  });

  // --- Evento: comentário simples (contador apenas, sem thread completa) ---
  socket.on('comentar', ({ postId, userId, texto }) => {
    const post = postsDb.get('posts').find({ id: postId }).value();
    if (!post) return;

    if (textoTemPalavraOfensiva(texto)) return;

    if (!post.comentarios) post.comentarios = [];
    const usuario = usersDb.get('users').find({ id: userId }).value();

    const comentario = {
      autor: usuario ? usuario.name : 'Anônimo',
      handle: usuario ? usuario.handle : '',
      texto: (texto || '').slice(0, 280),
      createdAt: Date.now()
    };
    post.comentarios.push(comentario);

    postsDb.get('posts').find({ id: postId }).assign(post).write();
    io.emit('postAtualizado', post);
  });

  // --- Evento: enviar mensagem privada em tempo real ---
  socket.on('enviarMensagem', ({ fromId, toId, texto }) => {
    const remetente = usersDb.get('users').find({ id: fromId }).value();
    const destinatario = usersDb.get('users').find({ id: toId }).value();
    if (!remetente || !destinatario || !texto || String(texto).trim().length === 0) return;
    if (textoTemPalavraOfensiva(texto)) return;

    const mensagem = {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      fromId,
      toId,
      texto: String(texto).trim().slice(0, 280),
      createdAt: Date.now()
    };

    messagesDb.get('messages').push(mensagem).write();
    io.emit('mensagemCriada', mensagem);
  });

  // --- Evento: seguir/deixar de seguir outro usuário (toggle) ---
  socket.on('seguir', ({ userId, alvoId }) => {
    if (userId === alvoId) return; // não pode seguir a si mesmo
    const usuario = usersDb.get('users').find({ id: userId }).value();
    if (!usuario) return;

    if (!usuario.following) usuario.following = [];
    const jaSegue = usuario.following.includes(alvoId);

    usuario.following = jaSegue
      ? usuario.following.filter((id) => id !== alvoId)
      : [...usuario.following, alvoId];

    usersDb.get('users').find({ id: userId }).assign(usuario).write();

    // avisa todo mundo para atualizar contadores/botões de "Seguir" em tela
    io.emit('seguidorAtualizado', { userId, alvoId, seguindo: !jaSegue });

    if (!jaSegue) {
      io.emit('notificacao', {
        paraUserId: alvoId,
        mensagem: `${usuario.name} começou a seguir você`
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// ===================== INICIALIZAÇÃO DO SERVIDOR ======================
server.listen(PORT, HOST, () => {
  const protocolo = IS_PRODUCTION ? 'http' : 'https';
  console.log(`🚀 Tadashi rodando em ${protocolo}://${HOST}:${PORT}`);
  if (!IS_PRODUCTION) {
    console.log(`🌍 Rede Wi-Fi: https://192.168.237.79:${PORT}`);
  }
});