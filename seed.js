// ============================================================
// TADASHI - seed.js
// Popula dados iniciais quando o banco está vazio (produção)
// ============================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

for (const dir of [dataDir, uploadsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

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

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

function criarPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

// Só popula se não houver usuários
if (usersDb.get('users').value().length === 0) {
  console.log('🌱 Populando dados iniciais...');

  const usuarios = [
    {
      id: 'u_seed_admin',
      name: 'Admin',
      handle: '@admin',
      avatar: 'https://i.pravatar.cc/150?img=1',
      bio: 'Administrador do Tadashi 🛡️',
      following: [],
      role: 'admin',
            strikes: 0,
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      passwordHash: criarPasswordHash('admin123'),
      createdAt: Date.now()
    },
    {
      id: 'u_seed_alice',
      name: 'Alice',
      handle: '@alice',
      avatar: 'https://i.pravatar.cc/150?img=69',
      bio: 'Olá! Sou a Alice 👋',
      following: [],
      role: 'user',
            strikes: 0,
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      passwordHash: criarPasswordHash('alice123'),
      createdAt: Date.now()
    },
    {
      id: 'u_seed_bob',
      name: 'Bob',
      handle: '@bob',
      avatar: 'https://i.pravatar.cc/150?img=62',
      bio: 'Bob aqui! 🚀',
      following: [],
      role: 'user',
            strikes: 0,
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      passwordHash: criarPasswordHash('bob123'),
      createdAt: Date.now()
    },
    {
      id: 'u_seed_arthur',
      name: 'Arthur',
      handle: '@arthur',
      avatar: 'https://i.pravatar.cc/150?img=46',
      bio: 'Sou legal 😎',
      following: [],
      role: 'user',
            strikes: 0,
      banned: false,
      banReason: '',
      bannedAt: 0,
      bannedBy: '',
      passwordHash: criarPasswordHash('arthur123'),
      createdAt: Date.now()
    }
  ];

  usersDb.get('users').push(...usuarios).write();

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

  console.log('✅ Dados iniciais criados!');
  console.log('👤 Admin: @admin (senha: admin123)');
  console.log('👤 Usuários: @alice, @bob, @arthur (senha: nome + 123)');
} else {
  console.log('ℹ️ Banco já possui dados, seed ignorado.');
}
