// ============================================================
// TADASHI - seed.js
// Garante os usuários demo (admin, alice, bob, arthur) e posts
// iniciais sempre presentes, mesmo após reset do servidor.
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

function criarPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

const USUARIOS_DEMO = [
  {
    id: 'u_seed_admin',
    name: 'Admin',
    handle: '@admin',
    avatar: 'https://i.pravatar.cc/150?img=1',
    bio: 'Administrador do Tadashi 🛡️',
    following: [],
    role: 'admin',
    senha: 'admin123'
  },
  {
    id: 'u_seed_alice',
    name: 'Alice',
    handle: '@alice',
    avatar: 'https://i.pravatar.cc/150?img=69',
    bio: 'Olá! Sou a Alice 👋',
    following: [],
    role: 'user',
    senha: 'alice123'
  },
  {
    id: 'u_seed_bob',
    name: 'Bob',
    handle: '@bob',
    avatar: 'https://i.pravatar.cc/150?img=62',
    bio: 'Bob aqui! 🚀',
    following: [],
    role: 'user',
    senha: 'bob123'
  },
  {
    id: 'u_seed_arthur',
    name: 'Arthur',
    handle: '@arthur',
    avatar: 'https://i.pravatar.cc/150?img=46',
    bio: 'Sou legal 😎',
    following: [],
    role: 'user',
    senha: 'arthur123'
  }
];

function seed(dbs) {
  let usersDb, postsDb, messagesDb, notificationsDb, sessionsDb, reportsDb;

  if (dbs && dbs.usersDb) {
    // Usa os mesmos bancos já abertos pelo server.js (evita dessincronização)
    ({ usersDb, postsDb, messagesDb, notificationsDb, sessionsDb, reportsDb } = dbs);
  } else {
    for (const dir of [dataDir, uploadsDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    usersDb = low(new FileSync(path.join(dataDir, 'users.json')));
    postsDb = low(new FileSync(path.join(dataDir, 'posts.json')));
    messagesDb = low(new FileSync(path.join(dataDir, 'messages.json')));
    notificationsDb = low(new FileSync(path.join(dataDir, 'notifications.json')));
    sessionsDb = low(new FileSync(path.join(dataDir, 'sessions.json')));
    reportsDb = low(new FileSync(path.join(dataDir, 'reports.json')));

    usersDb.defaults({ users: [] }).write();
    postsDb.defaults({ posts: [] }).write();
    messagesDb.defaults({ messages: [] }).write();
    notificationsDb.defaults({ notifications: [] }).write();
    sessionsDb.defaults({ sessions: [] }).write();
    reportsDb.defaults({ reports: [] }).write();
  }

  let usuariosAdicionados = 0;

  // UPSERT: garante que cada usuário demo exista (por @handle), mesmo que já existam outros usuários
  for (const demo of USUARIOS_DEMO) {
    const jaExiste = usersDb.get('users').find((u) => String(u.handle).toLowerCase() === demo.handle.toLowerCase()).value();
    if (jaExiste) continue; // já está lá: não sobrescreve

    const usuario = {
      id: demo.id,
      name: demo.name,
      handle: demo.handle,
      avatar: demo.avatar,
      bio: demo.bio,
      following: demo.following,
      role: demo.role,
      strikes: 0,
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      passwordHash: criarPasswordHash(demo.senha),
      createdAt: Date.now()
    };
    usersDb.get('users').push(usuario).write();
    usuariosAdicionados++;
  }

  // Só cria posts iniciais se ainda não houver nenhum
  if (postsDb.get('posts').value().length === 0) {
    const agora = Date.now();
    const posts = [
      {
        id: 'p_seed_1',
        authorId: 'u_seed_alice',
        authorName: 'Alice',
        authorHandle: '@alice',
        authorAvatar: 'https://i.pravatar.cc/150?img=69',
        texto: 'Bem-vindos ao Tadashi! 🎉 Primeira rede social feita com Node.js!',
        imagem: null,
        video: null,
        createdAt: agora - 60000,
        likes: [],
        comentarios: [],
        repostBy: null,
        originalId: null
      },
      {
        id: 'p_seed_2',
        authorId: 'u_seed_bob',
        authorName: 'Bob',
        authorHandle: '@bob',
        authorAvatar: 'https://i.pravatar.cc/150?img=62',
        texto: 'Testando o tempo real com Socket.io! ⚡',
        imagem: null,
        video: null,
        createdAt: agora - 30000,
        likes: [],
        comentarios: [],
        repostBy: null,
        originalId: null
      },
      {
        id: 'p_seed_3',
        authorId: 'u_seed_arthur',
        authorName: 'Arthur',
        authorHandle: '@arthur',
        authorAvatar: 'https://i.pravatar.cc/150?img=46',
        texto: 'Quem mais está animado com essa rede social? 🚀',
        imagem: null,
        video: null,
        createdAt: agora,
        likes: [],
        comentarios: [],
        repostBy: null,
        originalId: null
      }
    ];
    postsDb.get('posts').push(...posts).write();
  }

  if (usuariosAdicionados > 0) {
    console.log('🌱 Usuários demo adicionados:', usuariosAdicionados);
    console.log('👤 Admin: @admin (senha: admin123)');
    console.log('👤 Usuários: @alice, @bob, @arthur (senha: nome + 123)');
  } else {
    console.log('ℹ️ Usuários demo já presentes.');
  }
}

module.exports = { seed, USUARIOS_DEMO };

// Só roda direto se chamado como `node seed.js`
if (require.main === module) {
  seed();
}
