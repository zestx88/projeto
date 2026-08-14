// ============================================================
// TADASHI - script.js
// Frontend com autenticação por token (Bearer) + Socket.io
// ============================================================

// ---------- ESTADO GLOBAL ----------
let socket = null;
let authToken = null;
let usuarioAtual = null;
let todosUsuarios = [];
let posts = [];
let mensagens = [];
let contatoMensagemAtual = null;
let imagemSelecionada = null;
let videoSelecionado = null;
let perfilSelecionadoId = null;
let mobile = false;
let postsExibidos = 10;
let paginaAtual = 'inicio';
let notificacoes = [];
let socketConfigurado = false;
let todosUsuariosAdmin = [];
let adminUserFiltro = '';

const TOKEN_KEY = 'tadashi_token';
const MAX_STRIKES = 3;

// ---------- DOM ----------
const telaLogin = document.getElementById('tela-login');
const listaUsuariosEl = document.getElementById('lista-usuarios');
const formLogin = document.getElementById('form-login');
const inputLoginHandle = document.getElementById('input-login-handle');
const inputLoginSenha = document.getElementById('input-login-senha');
const loginErroEl = document.getElementById('login-erro');
const btnCriarConta = document.getElementById('btn-criar-conta');
const modalCriarConta = document.getElementById('modal-criar-conta');
const btnFecharCadastro = document.getElementById('btn-fechar-cadastro');
const btnCancelarCadastro = document.getElementById('btn-cancelar-cadastro');
const formCriarConta = document.getElementById('form-criar-conta');
const inputNomeCadastro = document.getElementById('input-nome-cadastro');
const inputHandleCadastro = document.getElementById('input-handle-cadastro');
const inputBioCadastro = document.getElementById('input-bio-cadastro');
const inputSenhaCadastro = document.getElementById('input-senha-cadastro');
const inputConfirmarSenhaCadastro = document.getElementById('input-confirmar-senha-cadastro');
const appEl = document.getElementById('app');

const headerAvatar = document.getElementById('header-avatar');
const headerHandle = document.getElementById('header-handle');
const btnTema = document.getElementById('btn-tema');
const btnSair = document.getElementById('btn-sair');

const compositorAvatar = document.getElementById('compositor-avatar');
const inputPost = document.getElementById('input-post');
const contadorCaracteres = document.getElementById('contador-caracteres');
const btnPostar = document.getElementById('btn-postar');
const btnAddImagem = document.getElementById('btn-add-imagem');
const btnAddVideo = document.getElementById('btn-add-video');
const previewWrap = document.getElementById('preview-imagem-wrap');
const previewImagem = document.getElementById('preview-imagem');
const btnRemoverImagem = document.getElementById('btn-remover-imagem');
const previewVideoWrap = document.getElementById('preview-video-wrap');
const previewVideo = document.getElementById('preview-video');
const btnRemoverVideo = document.getElementById('btn-remover-video');
const btnAddVideoArquivo = document.getElementById('input-arquivo-video');
const btnAddImagemArquivo = document.getElementById('input-arquivo-imagem');

const listaPostsEl = document.getElementById('lista-posts');
const listaVideosEl = document.getElementById('lista-videos');
const carregandoMaisEl = document.getElementById('carregando-mais');
const sugestoesUsuariosEl = document.getElementById('sugestoes-usuarios');
const toastContainer = document.getElementById('toast-container');

const navItens = document.querySelectorAll('.nav-item[data-pagina]');
const paginas = {
  inicio: document.getElementById('pagina-inicio'),
  explorar: document.getElementById('pagina-explorar'),
  videos: document.getElementById('pagina-videos'),
  perfil: document.getElementById('pagina-perfil'),
  notificacoes: document.getElementById('pagina-notificacoes'),
  mensagens: document.getElementById('pagina-mensagens'),
  admin: document.getElementById('pagina-admin')
};

const inputBusca = document.getElementById('input-busca');
const listaBuscaEl = document.getElementById('lista-busca');

// ===== DOM do painel admin =====
const navAdmin = document.getElementById('nav-admin');
const btnAdminReports = document.getElementById('btn-admin-reports');
const btnAdminUsers = document.getElementById('btn-admin-users');
const btnAdminPosts = document.getElementById('btn-admin-posts');
const tabReports = document.getElementById('admin-tabpanel-reports');
const tabUsers = document.getElementById('admin-tabpanel-users');
const tabPosts = document.getElementById('admin-tabpanel-posts');
const listaReports = document.getElementById('lista-reports');
const listaAdminUsers = document.getElementById('lista-admin-users');
const listaAdminPosts = document.getElementById('lista-admin-posts');

// ===== Painel admin: abas extras =====
const btnAdminStats = document.getElementById('btn-admin-stats');
const btnAdminAnuncio = document.getElementById('btn-admin-anuncio');
const tabStats = document.getElementById('admin-tabpanel-stats');
const tabAnuncio = document.getElementById('admin-tabpanel-anuncio');
const adminStatsEl = document.getElementById('admin-stats');
const adminBuscaUsuarios = document.getElementById('admin-busca-usuarios');
const adminAnuncioTexto = document.getElementById('admin-anuncio-texto');
const btnAdminAnuncioEnviar = document.getElementById('btn-admin-anuncio-enviar');

const perfilAvatar = document.getElementById('perfil-avatar');
const btnMudarAvatar = document.getElementById('btn-mudar-avatar');
const inputAvatarArquivo = document.getElementById('input-avatar-arquivo');
const perfilNome = document.getElementById('perfil-nome');
const perfilHandle = document.getElementById('perfil-handle');
const perfilBio = document.getElementById('perfil-bio');
const perfilSeguindo = document.getElementById('perfil-seguindo');
const perfilSeguidores = document.getElementById('perfil-seguidores');
const perfilPostsQtd = document.getElementById('perfil-posts-qtd');
const listaPostsPerfilEl = document.getElementById('lista-posts-perfil');

const listaNotificacoesEl = document.getElementById('lista-notificacoes');
const badgeNotif = document.getElementById('badge-notif');

const listaContatosEl = document.getElementById('lista-contatos');
const conversaHeaderEl = document.getElementById('conversa-header');
const listaMensagensEl = document.getElementById('lista-mensagens');
const formMensagem = document.getElementById('form-mensagem');
const inputMensagem = document.getElementById('input-mensagem');

// ===== Mídia nas mensagens =====
const btnMsgImagem = document.getElementById('btn-msg-imagem');
const inputMsgImagem = document.getElementById('input-msg-imagem');
const btnMsgVideo = document.getElementById('btn-msg-video');
const inputMsgVideo = document.getElementById('input-msg-video');
const btnMsgAudio = document.getElementById('btn-msg-audio');
const inputMsgAudio = document.getElementById('input-msg-audio');
let midiaMensagem = { imagem: null, video: null, audio: null };

// ===== Marcar pessoas (menção) =====
const btnMencionar = document.getElementById('btn-mencionar');
const modalMencao = document.getElementById('modal-mencao');
const btnFecharMencao = document.getElementById('btn-fechar-mencao');
const inputMencaoBusca = document.getElementById('input-mencao-busca');
const listaMencao = document.getElementById('lista-mencao');

// ===== Enviar vídeo para amigo =====
const modalEnviarVideo = document.getElementById('modal-enviar-video');
const btnFecharEnviarVideo = document.getElementById('btn-fechar-enviar-video');
const listaEnviarVideo = document.getElementById('lista-enviar-video');

// ===== Chamada de voz =====
const callOverlay = document.getElementById('call-overlay');
const callAvatar = document.getElementById('call-avatar');
const callStatusEl = document.getElementById('call-status');
const callInfoEl = document.getElementById('call-info');
const callBtnMute = document.getElementById('call-btn-mute');
const callBtnEnd = document.getElementById('call-btn-end');
const callBtnAceitar = document.getElementById('call-btn-aceitar');
const callBtnRecusar = document.getElementById('call-btn-recusar');
let peer = null;
let streamLocal = null;
let chamadaAtiva = false;
let callIdAtual = null;
let callContatoId = null;   // contato envolvido na chamada atual
let callDirecao = null;     // 'out' (criando) ou 'in' (recebendo)
let callMudo = false;
let sinalPendenteIn = [];   // buffer de sinais WebRTC de chamadas recebidas ainda não aceitas

// ============================================================
// HTTP helpers
// ============================================================
function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function api(url, options = {}) {
  const opts = { ...options };
  opts.headers = authHeaders(opts.headers || {});

  const resp = await fetch(url, opts);
  let data = null;
  const text = await resp.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Resposta inválida do servidor.' };
  }

  if (resp.status === 401 && authToken) {
    limparSessaoLocal();
    mostrarTelaLogin();
    throw new Error(data?.error || 'Sessão expirada.');
  }

  return { resp, data };
}

function salvarToken(token) {
  authToken = token;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function limparSessaoLocal() {
  pararChamadaVoz();
  authToken = null;
  usuarioAtual = null;
  perfilSelecionadoId = null;
  posts = [];
  mensagens = [];
  notificacoes = [];
  localStorage.removeItem(TOKEN_KEY);
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketConfigurado = false;
  }
}

// ============================================================
// INIT
// ============================================================
init();

async function init() {
  verificarDispositivo();
  aplicarTemaSalvo();
  configurarEventos();
  await carregarUsuarios();

  const tokenSalvo = localStorage.getItem(TOKEN_KEY);
  if (tokenSalvo) {
    authToken = tokenSalvo;
    try {
      const { resp, data } = await api('/api/me');
      if (resp.ok && data?.id) {
        await entrarComoUsuario(data, tokenSalvo);
        return;
      }
    } catch {
      // token inválido
    }
    limparSessaoLocal();
  }

  mostrarTelaLogin();
}

function mostrarTelaLogin() {
  appEl.classList.add('hidden');
  telaLogin.classList.remove('hidden');
  btnMudarAvatar.classList.add('hidden');
}

async function carregarUsuarios() {
  const { resp, data } = await api('/api/users');
  if (!resp.ok) {
    todosUsuarios = [];
    listaUsuariosEl.innerHTML = '<div class="notificacao-vazia">Não foi possível carregar usuários.</div>';
    return;
  }

  todosUsuarios = Array.isArray(data) ? data : [];

  listaUsuariosEl.innerHTML = todosUsuarios.map((u) => `
    <button type="button" class="usuario-card" data-id="${u.id}">
      <img class="avatar" src="${escaparAttr(u.avatar)}" alt="${escaparAttr(u.name)}">
      <div>
        <div class="usuario-card-nome">${escaparHtml(u.name)}</div>
        <div class="usuario-card-handle">${escaparHtml(u.handle)}</div>
      </div>
    </button>
  `).join('');

  listaUsuariosEl.querySelectorAll('.usuario-card').forEach((card) => {
    card.addEventListener('click', () => {
      const usuario = todosUsuarios.find((u) => u.id === card.dataset.id);
      if (!usuario) return;
      inputLoginHandle.value = usuario.handle;
      inputLoginSenha.focus();
      limparErroLogin();
    });
  });
}

// ============================================================
// LOGIN / LOGOUT / SESSÃO
// ============================================================
async function entrarComoUsuario(usuario, token) {
  usuarioAtual = usuario;
  perfilSelecionadoId = usuario.id;
  salvarToken(token);

  // Atualiza cache local do usuário logado
  const idx = todosUsuarios.findIndex((u) => u.id === usuario.id);
  if (idx !== -1) todosUsuarios[idx] = { ...todosUsuarios[idx], ...usuario };
  else todosUsuarios.push(usuario);

  telaLogin.classList.add('hidden');
  appEl.classList.remove('hidden');
  navAdmin.classList.toggle('hidden', !ehStaff(usuario));
  btnMudarAvatar.classList.remove('hidden');

  headerAvatar.src = usuario.avatar;
  headerHandle.textContent = usuario.handle;
  compositorAvatar.src = usuario.avatar;

  conectarSocket();
  renderizarSugestoes();
  await Promise.all([
    carregarFeedInicial(),
    carregarMensagens(),
    carregarNotificacoes()
  ]);
}

function conectarSocket() {
  if (!authToken) return;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketConfigurado = false;
  }

  socket = io({
    auth: { token: authToken },
    reconnection: true,
    reconnectionAttempts: 10
  });

  configurarSocket();
}

async function sair() {
  try {
    if (authToken) {
      await api('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }
  } catch {
    // ignora erro de rede no logout
  }
  limparSessaoLocal();
  mostrarTelaLogin();
  await carregarUsuarios();
}

// ============================================================
// MENSAGENS
// ============================================================
async function carregarMensagens() {
  if (!usuarioAtual || !authToken) return;

  const { resp, data } = await api('/api/messages');
  if (!resp.ok) {
    mensagens = [];
    return;
  }
  mensagens = Array.isArray(data) ? data : [];
  renderizarContatos();
  renderizarConversa();
}

function renderizarContatos() {
  if (!usuarioAtual) return;

  const contatos = todosUsuarios.filter((u) => u.id !== usuarioAtual.id);

  if (!contatos.length) {
    listaContatosEl.innerHTML = '<div class="notificacao-vazia">Ainda não há usuários para conversar.</div>';
    return;
  }

  if (!contatoMensagemAtual || !contatos.some((u) => u.id === contatoMensagemAtual)) {
    contatoMensagemAtual = contatos[0].id;
  }

  listaContatosEl.innerHTML = contatos.map((u) => `
    <button type="button" class="contato-card ${u.id === contatoMensagemAtual ? 'ativo' : ''}" data-contato="${u.id}">
      <img class="avatar avatar-sm" src="${escaparAttr(u.avatar)}" alt="${escaparAttr(u.name)}">
      <div>
        <div class="contato-nome">${escaparHtml(u.name)}</div>
        <div class="contato-handle">${escaparHtml(u.handle)}</div>
      </div>
    </button>
  `).join('');

  listaContatosEl.querySelectorAll('[data-contato]').forEach((botao) => {
    botao.addEventListener('click', () => {
      contatoMensagemAtual = botao.dataset.contato;
      renderizarContatos();
      renderizarConversa();
    });
  });
}

function renderizarConversa() {
  if (!usuarioAtual || !contatoMensagemAtual) {
    listaMensagensEl.innerHTML = '<div class="notificacao-vazia">Selecione um contato para conversar.</div>';
    conversaHeaderEl.innerHTML = '';
    return;
  }

  const contato = todosUsuarios.find((u) => u.id === contatoMensagemAtual);
  if (!contato) return;

  conversaHeaderEl.innerHTML = `
    <img class="avatar avatar-sm" src="${escaparAttr(contato.avatar)}" alt="${escaparAttr(contato.name)}">
    <div class="conversa-info">
      <div class="conversa-nome">${escaparHtml(contato.name)}</div>
      <div class="conversa-handle">${escaparHtml(contato.handle)}</div>
    </div>
    <button id="btn-chamada" class="btn-icone" title="Chamada de voz">📞</button>
  `;

  conversaHeaderEl.querySelector('#btn-chamada')?.addEventListener('click', () => {
    iniciarChamadaVoz(contato.id);
  });

  const conversa = mensagens
    .filter((m) =>
      (m.fromId === usuarioAtual.id && m.toId === contato.id) ||
      (m.fromId === contato.id && m.toId === usuarioAtual.id)
    )
    .sort((a, b) => a.createdAt - b.createdAt);

  listaMensagensEl.innerHTML = conversa.length
    ? conversa.map((m) => `\
      <div class="mensagem-item ${m.fromId === usuarioAtual.id ? 'mine' : ''}">
        <div class="mensagem-bala">${conteudoMensagem(m)}</div>
        <div class="mensagem-data">${tempoRelativo(m.createdAt)}</div>
      </div>
    `).join('')
    : '<div class="notificacao-vazia">Nenhuma mensagem ainda. Comece a conversa.</div>';

  listaMensagensEl.scrollTop = listaMensagensEl.scrollHeight;
}

// Monta o conteúdo de uma mensagem (texto, imagem, vídeo ou áudio)
function conteudoMensagem(m) {
  let html = '';
  if (m.imagem) html += `<img class="msg-midia msg-img" src="${escaparAttr(m.imagem)}" alt="foto">`;
  if (m.video) html += `<video class="msg-midia msg-video" controls playsinline src="${escaparAttr(m.video)}"></video>`;
  if (m.audio) html += `<audio class="msg-midia msg-audio" controls src="${escaparAttr(m.audio)}"></audio>`;
  if (m.texto) html += `<div class="msg-texto">${formatarMencoes(escaparHtml(m.texto))}</div>`;
  if (!html) html = '<div class="msg-texto">💬</div>';
  return html;
}

// Transforma @handle em link clicável (espera texto já escapado)
function formatarMencoes(textoEscapado) {
  return String(textoEscapado).replace(
    /@([a-zA-Z0-9_]{2,30})/g,
    (m, handle) => `<span class="mencao-link" data-mencao="${m}">${m}</span>`
  );
}

// ============================================================
// FEED / POSTS
// ============================================================
async function carregarFeedInicial() {
  const { resp, data } = await api('/api/posts');
  if (!resp.ok) {
    posts = [];
    renderizarFeed();
    return;
  }
  posts = Array.isArray(data) ? data : [];
  postsExibidos = 10;
  renderizarFeed();
}

function renderizarFeed() {
  if (!usuarioAtual) return;
  const visiveis = posts.slice(0, postsExibidos);
  listaPostsEl.innerHTML = visiveis.map((p) => templatePost(p)).join('');
  ligarEventosDosPostsEm(listaPostsEl);
  carregandoMaisEl.classList.toggle('hidden', postsExibidos >= posts.length);

  if (paginaAtual === 'videos') renderizarVideos();
  if (paginaAtual === 'explorar') renderizarBusca(inputBusca.value.trim().toLowerCase());
  if (paginaAtual === 'perfil' && perfilSelecionadoId) {
    // re-render leve dos posts do perfil a partir do cache quando possível
  }
}

function templatePost(p) {
  const jaCurtiu = (p.likes || []).includes(usuarioAtual.id);
  const totalComentarios = (p.comentarios || []).length;

  const labelRepost = p.repostBy
    ? `<div class="post-repost-label">🔁 Repostado por ${p.repostBy.id === usuarioAtual.id ? 'você' : escaparHtml(p.repostBy.name)}</div>`
    : '';

  const imagemHtml = p.imagem
    ? `<img class="post-imagem" src="${escaparAttr(p.imagem)}" alt="imagem do post" onerror="this.style.display='none'">`
    : '';

  const videoHtml = p.video
    ? `<video class="post-video" controls playsinline preload="metadata" src="${escaparAttr(p.video)}" aria-label="Vídeo do post"></video>`
    : '';

  const podeDeletar =
    p.authorId === usuarioAtual.id ||
    (p.repostBy && p.repostBy.id === usuarioAtual.id) ||
    usuarioAtual.role === 'admin';

  const comentariosHtml = (p.comentarios || []).map((c) => `
    <div class="comentario-item"><strong>${escaparHtml(c.autor)}</strong> ${formatarMencoes(escaparHtml(c.texto))}</div>
  `).join('');

  return `
    <article class="post" data-id="${escaparAttr(p.id)}">
      ${labelRepost}
      <img class="avatar post-avatar-link" data-user="${escaparAttr(p.authorId)}" src="${escaparAttr(p.authorAvatar)}" alt="${escaparAttr(p.authorName)}">
      <div class="post-corpo">
        <div class="post-cabecalho">
          <span class="post-nome post-avatar-link" data-user="${escaparAttr(p.authorId)}">${escaparHtml(p.authorName)}</span>
          <span class="post-handle">${escaparHtml(p.authorHandle)}</span>
          <span class="post-tempo">· ${tempoRelativo(p.createdAt)}</span>
        </div>
        <div class="post-texto">${formatarMencoes(escaparHtml(p.texto))}</div>
        ${imagemHtml}
        ${videoHtml}
        <div class="post-acoes">
          <button type="button" class="post-acao comentario" data-acao="comentario">
            💬 <span>${totalComentarios}</span>
          </button>
          <button type="button" class="post-acao repost ${p.repostBy && p.repostBy.id === usuarioAtual.id ? 'repostado' : ''}" data-acao="repost">
            🔁
          </button>
          <button type="button" class="post-acao like ${jaCurtiu ? 'curtido' : ''}" data-acao="like">
            <span class="icone-coracao">${jaCurtiu ? '❤️' : '🤍'}</span> <span class="qtd-likes">${(p.likes || []).length}</span>
          </button>
          ${p.authorId !== usuarioAtual.id ? '<button type="button" class="post-acao reportar" data-acao="reportar" title="Reportar">🚩</button>' : ''}
          ${podeDeletar ? '<button type="button" class="post-acao deletar" data-acao="deletar">🗑️</button>' : '<span></span>'}
        </div>
        <div class="post-comentarios hidden" data-comentarios>
          ${comentariosHtml}
          <form class="form-comentario">
            <input type="text" maxlength="280" placeholder="Postar sua resposta">
            <button type="submit">Responder</button>
          </form>
        </div>
      </div>
    </article>
  `;
}

function ligarEventosDosPostsEm(container) {
  if (!socket || !usuarioAtual) return;

  container.querySelectorAll('.post').forEach((el) => {
    const postId = el.dataset.id;

    el.querySelector('[data-acao="like"]')?.addEventListener('click', () => {
      socket.emit('curtir', { postId });
    });

    el.querySelector('[data-acao="repost"]')?.addEventListener('click', () => {
      socket.emit('repostar', { postId });
    });

    const btnDeletar = el.querySelector('[data-acao="deletar"]');
    if (btnDeletar) {
      btnDeletar.addEventListener('click', () => {
        if (confirm('Deletar este post?')) {
          socket.emit('deletarPost', { postId });
        }
      });
    }

    el.querySelector('[data-acao="comentario"]')?.addEventListener('click', () => {
      el.querySelector('[data-comentarios]')?.classList.toggle('hidden');
    });

    // Botão reportar post
    const btnReportar = el.querySelector('[data-acao="reportar"]');
    if (btnReportar) {
      btnReportar.addEventListener('click', () => {
        const motivo = prompt('Motivo da denúncia (ex: conteúdo ofensivo, spam):') || '';
        if (motivo.trim()) {
          socket.emit('reportarPost', { postId, motivo });
          mostrarToast('Denúncia enviada.');
        }
      });
    }

    const form = el.querySelector('.form-comentario');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const texto = input.value.trim();
      if (!texto) return;
      socket.emit('comentar', { postId, texto });
      input.value = '';
    });
  });
}

function atualizarPostNoCache(postAtualizado) {
  const idx = posts.findIndex((p) => p.id === postAtualizado.id);
  if (idx !== -1) posts[idx] = postAtualizado;
}

function patchPostNoDom(postAtualizado) {
  // Atualização leve: se o post estiver visível, re-renderiza só ele
  document.querySelectorAll(`.post[data-id="${cssEscape(postAtualizado.id)}"]`).forEach((el) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = templatePost(postAtualizado);
    const novo = wrapper.firstElementChild;
    el.replaceWith(novo);
    ligarEventosDosPostsEm(novo.parentElement || document.body);
  });
}

function cssEscape(valor) {
  if (window.CSS && CSS.escape) return CSS.escape(String(valor));
  return String(valor).replace(/"/g, '\\"');
}

// ============================================================
// SOCKET.IO
// ============================================================
function configurarSocket() {
  if (!socket || socketConfigurado) return;
  socketConfigurado = true;

  socket.on('connect_error', (err) => {
    console.warn('Socket auth/connect error:', err?.message || err);
    if (String(err?.message || '').includes('autenticado')) {
      limparSessaoLocal();
      mostrarTelaLogin();
      mostrarToast('Sessão expirada. Entre novamente.');
    }
  });

  socket.on('erroAcao', ({ error }) => {
    if (error) mostrarToast(error);
  });

  socket.on('postCriado', (post) => {
    posts.unshift(post);
    postsExibidos++;
    if (usuarioAtual) renderizarFeed();
  });

  socket.on('postAtualizado', (postAtualizado) => {
    atualizarPostNoCache(postAtualizado);
    if (!usuarioAtual) return;

    // Atualiza DOM de forma mais leve quando possível
    const visivel = document.querySelector(`.post[data-id="${cssEscape(postAtualizado.id)}"]`);
    if (visivel) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = templatePost(postAtualizado);
      const novo = wrapper.firstElementChild;
      const parent = visivel.parentElement;
      visivel.replaceWith(novo);
      // religa eventos só neste post
      novo.querySelector('[data-acao="like"]')?.addEventListener('click', () => socket.emit('curtir', { postId: postAtualizado.id }));
      novo.querySelector('[data-acao="repost"]')?.addEventListener('click', () => socket.emit('repostar', { postId: postAtualizado.id }));
      const btnDel = novo.querySelector('[data-acao="deletar"]');
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          if (confirm('Deletar este post?')) socket.emit('deletarPost', { postId: postAtualizado.id });
        });
      }
      novo.querySelector('[data-acao="comentario"]')?.addEventListener('click', () => {
        novo.querySelector('[data-comentarios]')?.classList.toggle('hidden');
      });
      const form = novo.querySelector('.form-comentario');
      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const texto = input.value.trim();
        if (!texto) return;
        socket.emit('comentar', { postId: postAtualizado.id, texto });
        input.value = '';
      });
      // mantém comentários abertos se estavam
      if (visivel.querySelector('[data-comentarios]') && !visivel.querySelector('[data-comentarios]').classList.contains('hidden')) {
        novo.querySelector('[data-comentarios]')?.classList.remove('hidden');
      }
    } else if (paginaAtual === 'inicio') {
      renderizarFeed();
    }

    if (paginaAtual === 'videos') renderizarVideos();
    if (paginaAtual === 'perfil' && perfilSelecionadoId) abrirPerfil(perfilSelecionadoId);
  });

  socket.on('usuarioAtualizado', ({ id, avatar, name, handle }) => {
    const idx = todosUsuarios.findIndex((u) => u.id === id);
    if (idx !== -1) {
      todosUsuarios[idx] = { ...todosUsuarios[idx], avatar, name, handle };
    }

    if (usuarioAtual && usuarioAtual.id === id) {
      usuarioAtual = { ...usuarioAtual, avatar, name, handle };
      headerAvatar.src = avatar;
      compositorAvatar.src = avatar;
      if (perfilSelecionadoId === id) perfilAvatar.src = avatar;
    }

    posts = posts.map((p) => {
      if (p.authorId !== id) return p;
      return { ...p, authorAvatar: avatar, authorName: name, authorHandle: handle };
    });

    if (usuarioAtual) {
      renderizarSugestoes();
      renderizarFeed();
      renderizarContatos();
      renderizarConversa();
      if (paginaAtual === 'perfil') abrirPerfil(perfilSelecionadoId || usuarioAtual.id);
    }
  });

  socket.on('mensagemCriada', (mensagem) => {
    if (!usuarioAtual) return;
    if (mensagem.fromId !== usuarioAtual.id && mensagem.toId !== usuarioAtual.id) return;

    if (!mensagens.some((m) => m.id === mensagem.id)) {
      mensagens.push(mensagem);
    }
    renderizarContatos();
    renderizarConversa();
  });

  socket.on('postDeletado', ({ postId }) => {
    posts = posts.filter((p) => p.id !== postId);
    document.querySelectorAll(`.post[data-id="${cssEscape(postId)}"]`).forEach((el) => el.remove());
    if (paginaAtual === 'videos') renderizarVideos();
    if (paginaAtual === 'admin' && !tabPosts.classList.contains('hidden')) renderizarAdminPosts();
  });

  // Evento recebido diretamente na sala do usuário banido
  socket.on('usuarioBanido', ({ motivo, strikes }) => {
    if (usuarioAtual) {
      const msg = strikes
        ? `Conta banida (${strikes} strikes): ${motivo}`
        : `Conta banida: ${motivo}`;
      alert(msg);
      limparSessaoLocal();
      mostrarTelaLogin();
      mostrarToast('Sua conta foi banida.');
    }
  });

  // Conta excluída por um administrador
  socket.on('contaExcluida', ({ motivo }) => {
    if (usuarioAtual) {
      alert(motivo || 'Sua conta foi excluída.');
      limparSessaoLocal();
      mostrarTelaLogin();
      mostrarToast('Sua conta foi excluída.');
    }
  });

  // Novo reporte criado (admin recebe em tempo real)
  socket.on('reporteCriado', () => {
    if (paginaAtual === 'admin') carregarReportsAdmin();
  });

  socket.on('notificacao', (payload) => {
    if (!usuarioAtual) return;

    // Aceita formato novo (objeto completo) e antigo ({paraUserId, mensagem})
    const paraUserId = payload.paraUserId;
    if (paraUserId && paraUserId !== usuarioAtual.id) return;

    const item = {
      id: payload.id || `local_${Date.now()}`,
      mensagem: payload.mensagem,
      createdAt: payload.createdAt || Date.now(),
      lida: paginaAtual === 'notificacoes',
      tipo: payload.tipo || 'geral'
    };

    notificacoes.unshift(item);
    if (paginaAtual !== 'notificacoes') {
      mostrarToast(item.mensagem);
    }
    atualizarBadgeNotificacoes();
    if (paginaAtual === 'notificacoes') renderizarNotificacoes();
  });

  socket.on('seguidorAtualizado', ({ userId, alvoId, following }) => {
    const usuario = todosUsuarios.find((u) => u.id === userId);
    if (usuario && Array.isArray(following)) {
      usuario.following = following;
    } else if (usuario) {
      // fallback: toggle local
      if (!usuario.following) usuario.following = [];
      const ja = usuario.following.includes(alvoId);
      usuario.following = ja
        ? usuario.following.filter((id) => id !== alvoId)
        : [...usuario.following, alvoId];
    }

    if (usuarioAtual && usuarioAtual.id === userId && Array.isArray(following)) {
      usuarioAtual = { ...usuarioAtual, following };
    }

    if (!usuarioAtual) return;
    renderizarSugestoes();
    if (paginaAtual === 'explorar') renderizarBusca(inputBusca.value.trim().toLowerCase());
    if (paginaAtual === 'perfil') {
      abrirPerfil(perfilSelecionadoId || usuarioAtual.id);
    }
  });

  // ===== Chamada de voz: eventos de sinalização =====
  socket.on('chamadaVozEntrada', ({ callId, fromName, fromHandle, fromAvatar }) => {
    if (chamadaAtiva) {
      // já ocupado: reporta como recusado
      socket.emit('chamadaVozResposta', { toId: usuarioAtual.id, aceita: false, callId });
      return;
    }
    callIdAtual = callId;
    callDirecao = 'in';
    callContatoId = null; // o id do chamador não vem; usamos handle para achar
    chamadaAtiva = true;
    callAvatar.src = fromAvatar || '';
    callInfoEl.textContent = `${fromName} (@${(fromHandle || '').replace(/^@/, '')})`;
    callStatusEl.textContent = 'Chamada recebida...';
    callBtnRecusar.classList.remove('hidden');
    callBtnAceitar.classList.remove('hidden');
    callBtnMute.classList.add('hidden');
    callBtnEnd.classList.add('hidden');
    callOverlay.classList.remove('hidden');
    // Guarda quem chamou para sinalização
    const chamador = todosUsuarios.find((u) => u.handle.toLowerCase() === (fromHandle || '').toLowerCase());
    if (chamador) callContatoId = chamador.id;
  });

  socket.on('chamadaVozAceita', ({ callId }) => {
    callIdAtual = callId;
    callStatusEl.textContent = 'Conectando...';
    callBtnRecusar.classList.add('hidden');
    callBtnAceitar.classList.add('hidden');
    callBtnMute.classList.remove('hidden');
    callBtnEnd.classList.remove('hidden');
  });

  socket.on('chamadaVozRejeitada', ({ callId }) => {
    if (callId && callIdAtual && callId !== callIdAtual) return;
    mostrarToast('Chamada recusada.');
    pararChamadaVoz();
  });

  socket.on('sinalVoz', async ({ fromId, descricao, candidato }) => {
    // Só processamos sinal da chamada ativa com o contato certo
    if (!chamadaAtiva || !callContatoId) return;

    // Chamada recebida ainda não aceita: guarda os sinais até criar o peer
    if (callDirecao === 'in' && !peer) {
      if (descricao || candidato) sinalPendenteIn.push({ descricao, candidato });
      return;
    }

    if (!peer) {
      try {
        await criarPeerVoz(callContatoId, callDirecao);
      } catch (err) {
        mostrarToast('Não foi possível iniciar a chamada.');
        pararChamadaVoz();
        return;
      }
    }

    try {
      if (descricao) {
        await peer.setRemoteDescription(descricao);
        if (descricao.type === 'offer') {
          const resposta = await peer.createAnswer();
          await peer.setLocalDescription(resposta);
          socket.emit('sinalVoz', {
            toId: callContatoId,
            fromId: usuarioAtual.id,
            descricao: peer.localDescription,
            candidato: null
          });
        }
      }
      if (candidato) {
        try { await peer.addIceCandidate(candidato); } catch (err) { /* ignora ICE inválido */ }
      }
    } catch (err) {
      console.warn('Erro WebRTC sinal:', err);
    }
  });

  socket.on('chamadaEncerrada', ({ fromId }) => {
    if (fromId && callContatoId && fromId !== callContatoId) return;
    mostrarToast('Chamada encerrada.');
    pararChamadaVoz();
  });
}

// ============================================================
// EVENTOS UI
// ============================================================
function configurarEventos() {
  inputPost.addEventListener('input', atualizarEstadoCompositor);

  btnAddImagem.addEventListener('click', () => btnAddImagemArquivo.click());
  btnAddImagemArquivo.addEventListener('change', () => {
    const arquivo = btnAddImagemArquivo.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem.');
      return;
    }
    if (arquivo.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande (máx. 5 MB).');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      imagemSelecionada = leitor.result;
      previewImagem.src = imagemSelecionada;
      previewWrap.classList.remove('hidden');
      atualizarEstadoCompositor();
    };
    leitor.readAsDataURL(arquivo);
  });

  btnRemoverImagem.addEventListener('click', () => {
    imagemSelecionada = null;
    previewWrap.classList.add('hidden');
    previewImagem.src = '';
    btnAddImagemArquivo.value = '';
    atualizarEstadoCompositor();
  });

  btnAddVideo.addEventListener('click', () => btnAddVideoArquivo.click());
  btnAddVideoArquivo.addEventListener('change', () => {
    const arquivo = btnAddVideoArquivo.files[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith('video/')) {
      alert('Por favor selecione um arquivo de vídeo.');
      return;
    }
    if (arquivo.size > 40 * 1024 * 1024) {
      alert('Vídeo muito grande (máx. 40 MB).');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => {
      videoSelecionado = leitor.result;
      previewVideo.src = videoSelecionado;
      previewVideoWrap.classList.remove('hidden');
      atualizarEstadoCompositor();
    };
    leitor.readAsDataURL(arquivo);
  });

  btnRemoverVideo.addEventListener('click', () => {
    videoSelecionado = null;
    previewVideoWrap.classList.add('hidden');
    previewVideo.src = '';
    btnAddVideoArquivo.value = '';
    atualizarEstadoCompositor();
  });

  btnMudarAvatar.addEventListener('click', () => {
    if (!usuarioAtual) return;
    inputAvatarArquivo.click();
  });

  inputAvatarArquivo.addEventListener('change', async () => {
    const arquivo = inputAvatarArquivo.files[0];
    if (!arquivo || !usuarioAtual) return;

    if (!arquivo.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem para o perfil.');
      return;
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      alert('Avatar muito grande (máx. 2 MB).');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = async () => {
      const avatarBase64 = leitor.result;
      try {
        const { resp, data } = await api('/api/users/me/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: avatarBase64 })
        });

        if (!resp.ok) {
          alert(data?.error || 'Não foi possível atualizar a foto de perfil.');
          return;
        }

        usuarioAtual = { ...usuarioAtual, avatar: data.avatar };
        const idx = todosUsuarios.findIndex((u) => u.id === usuarioAtual.id);
        if (idx !== -1) todosUsuarios[idx] = { ...todosUsuarios[idx], avatar: data.avatar };

        headerAvatar.src = data.avatar;
        compositorAvatar.src = data.avatar;
        perfilAvatar.src = data.avatar;

        if (paginaAtual === 'perfil') abrirPerfil(usuarioAtual.id);
        renderizarSugestoes();
        renderizarContatos();
        renderizarConversa();
        mostrarToast('Foto de perfil atualizada.');
      } catch (err) {
        alert(err.message || 'Erro ao atualizar avatar.');
      }
    };
    leitor.readAsDataURL(arquivo);
  });

  btnPostar.addEventListener('click', () => {
    const texto = inputPost.value.trim();
    if (!usuarioAtual || !socket) return;
    if (!texto && !imagemSelecionada && !videoSelecionado) return;

    socket.emit('novoPost', {
      texto,
      imagem: imagemSelecionada,
      video: videoSelecionado
    });

    inputPost.value = '';
    contadorCaracteres.textContent = '280';
    contadorCaracteres.classList.remove('limite');
    btnPostar.disabled = true;
    imagemSelecionada = null;
    previewWrap.classList.add('hidden');
    btnAddImagemArquivo.value = '';
    videoSelecionado = null;
    previewVideoWrap.classList.add('hidden');
    previewVideo.src = '';
    btnAddVideoArquivo.value = '';
  });

  btnTema.addEventListener('click', alternarTema);
  btnSair.addEventListener('click', () => { sair(); });

  btnCriarConta.addEventListener('click', () => {
    modalCriarConta.classList.remove('hidden');
    inputNomeCadastro.focus();
  });

  btnFecharCadastro.addEventListener('click', fecharModalCadastro);
  btnCancelarCadastro.addEventListener('click', fecharModalCadastro);
  modalCriarConta.addEventListener('click', (e) => {
    if (e.target === modalCriarConta) fecharModalCadastro();
  });

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const handle = inputLoginHandle.value.trim();
    const password = inputLoginSenha.value;

    if (!handle || !password) {
      mostrarErroLogin('Informe handle e senha.');
      return;
    }

    try {
      const { resp, data } = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, password })
      });

      if (!resp.ok) {
        mostrarErroLogin(data?.error || 'Não foi possível entrar.');
        return;
      }

      await carregarUsuarios();
      await entrarComoUsuario(data.user, data.token);
      formLogin.reset();
      limparErroLogin();
    } catch (err) {
      mostrarErroLogin(err.message || 'Erro de conexão.');
    }
  });

  formMensagem.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputMensagem.value.trim();
    const temMidia = midiaMensagem.imagem || midiaMensagem.video || midiaMensagem.audio;
    if ((!texto && !temMidia) || !usuarioAtual || !contatoMensagemAtual) return;

    try {
      const { resp, data } = await api('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toId: contatoMensagemAtual,
          texto,
          imagem: midiaMensagem.imagem,
          video: midiaMensagem.video,
          audio: midiaMensagem.audio
        })
      });

      if (!resp.ok) {
        mostrarToast(data?.error || 'Não foi possível enviar a mensagem.');
        return;
      }

      inputMensagem.value = '';
      midiaMensagem = { imagem: null, video: null, audio: null };
      inputMsgImagem.value = '';
      inputMsgVideo.value = '';
      inputMsgAudio.value = '';
      // mensagem chega também via socket; se ainda não chegou, adiciona
      if (data?.id && !mensagens.some((m) => m.id === data.id)) {
        mensagens.push(data);
        renderizarConversa();
      }
    } catch (err) {
      mostrarToast(err.message || 'Erro ao enviar mensagem.');
    }
  });

  // ---- Mídia nas mensagens ----
  btnMsgImagem.addEventListener('click', () => inputMsgImagem.click());
  btnMsgVideo.addEventListener('click', () => inputMsgVideo.click());
  btnMsgAudio.addEventListener('click', () => inputMsgAudio.click());

  inputMsgImagem.addEventListener('change', () => lerMidiaMensagem(inputMsgImagem, 'imagem', 5));
  inputMsgVideo.addEventListener('change', () => lerMidiaMensagem(inputMsgVideo, 'video', 40));
  inputMsgAudio.addEventListener('change', () => lerMidiaMensagem(inputMsgAudio, 'audio', 5));

  // ---- Marcar pessoa (menção) ----
  btnMencionar.addEventListener('click', () => {
    abrirModalMencao();
  });
  btnFecharMencao.addEventListener('click', fecharModalMencao);
  modalMencao.addEventListener('click', (e) => {
    if (e.target === modalMencao) fecharModalMencao();
  });
  inputMencaoBusca.addEventListener('input', renderizarListaMencao);

  // ---- Enviar vídeo para amigo ----
  btnFecharEnviarVideo.addEventListener('click', fecharModalEnviarVideo);
  modalEnviarVideo.addEventListener('click', (e) => {
    if (e.target === modalEnviarVideo) fecharModalEnviarVideo();
  });
  listaEnviarVideo.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-enviar-id]');
    if (botao) enviarVideoParaAmigo(botao.dataset.enviarId);
  });

  // ---- Chamada de voz ----
  callBtnMute.addEventListener('click', alternarMudoChamada);
  callBtnEnd.addEventListener('click', encerrarChamada);
  callBtnAceitar.addEventListener('click', aceitarChamada);
  callBtnRecusar.addEventListener('click', recusarChamada);

  formCriarConta.addEventListener('submit', criarConta);

  navItens.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (item.dataset.pagina === 'perfil' && usuarioAtual) {
        perfilSelecionadoId = usuarioAtual.id;
      }
      irParaPagina(item.dataset.pagina);
    });
  });

  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-follow-id]')) return;

    const alvoPerfil = e.target.closest('[data-open-profile]');
    if (alvoPerfil) {
      perfilSelecionadoId = String(alvoPerfil.dataset.openProfile);
      abrirPerfil(perfilSelecionadoId);
      irParaPagina('perfil');
      return;
    }

    const alvo = e.target.closest('.post-avatar-link');
    if (alvo) {
      perfilSelecionadoId = String(alvo.dataset.user);
      abrirPerfil(perfilSelecionadoId);
      irParaPagina('perfil');
      return;
    }

    // Clique numa menção (@handle) abre o perfil do usuário
    const mencao = e.target.closest('.mencao-link');
    if (mencao && mencao.dataset.mencao) {
      const usuario = todosUsuarios.find((u) => u.handle.toLowerCase() === mencao.dataset.mencao.toLowerCase());
      if (usuario) {
        perfilSelecionadoId = usuario.id;
        abrirPerfil(usuario.id);
        irParaPagina('perfil');
      }
    }
  });

  inputBusca.addEventListener('input', () => {
    renderizarBusca(inputBusca.value.trim().toLowerCase());
  });

  window.addEventListener('resize', verificarDispositivo);

  // ----- Painel admin: alternar abas -----
  btnAdminStats.addEventListener('click', () => mudarAbaAdmin(btnAdminStats, tabStats));
  btnAdminReports.addEventListener('click', () => mudarAbaAdmin(btnAdminReports, tabReports));
  btnAdminUsers.addEventListener('click', () => mudarAbaAdmin(btnAdminUsers, tabUsers));
  btnAdminPosts.addEventListener('click', () => mudarAbaAdmin(btnAdminPosts, tabPosts));
  btnAdminAnuncio.addEventListener('click', () => mudarAbaAdmin(btnAdminAnuncio, tabAnuncio));

  adminBuscaUsuarios.addEventListener('input', () => {
    adminUserFiltro = adminBuscaUsuarios.value.trim().toLowerCase();
    carregarUsuariosAdmin();
  });

  btnAdminAnuncioEnviar.addEventListener('click', enviarAnuncioGlobal);

  window.addEventListener('scroll', () => {
    if (!usuarioAtual || paginaAtual !== 'inicio') return;
    const pertoDoFim = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
    if (pertoDoFim && postsExibidos < posts.length) {
      carregandoMaisEl.classList.remove('hidden');
      setTimeout(() => {
        postsExibidos += 10;
        renderizarFeed();
      }, 300);
    }
  });
}

function atualizarEstadoCompositor() {
  const restante = 280 - inputPost.value.length;
  contadorCaracteres.textContent = restante;
  contadorCaracteres.classList.toggle('limite', restante <= 20);
  const temTexto = inputPost.value.trim().length > 0;
  const temMidia = Boolean(imagemSelecionada || videoSelecionado);
  btnPostar.disabled = (!temTexto && !temMidia) || restante < 0;
}

// ============================================================
// CADASTRO
// ============================================================
function fecharModalCadastro() {
  modalCriarConta.classList.add('hidden');
  formCriarConta.reset();
}

async function criarConta(e) {
  e.preventDefault();

  const payload = {
    name: inputNomeCadastro.value.trim(),
    handle: inputHandleCadastro.value.trim(),
    bio: inputBioCadastro.value.trim(),
    password: inputSenhaCadastro.value
  };

  if (!payload.name || payload.name.length < 2) {
    alert('Informe um nome com pelo menos 2 caracteres.');
    return;
  }
  if (!payload.handle || payload.handle.replace(/^@/, '').length < 2) {
    alert('Informe um @handle válido.');
    return;
  }
  if (payload.password.length < 6) {
    alert('A senha deve ter pelo menos 6 caracteres.');
    return;
  }
  if (payload.password !== inputConfirmarSenhaCadastro.value) {
    alert('As senhas informadas não conferem.');
    return;
  }

  try {
    const { resp, data } = await api('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      alert(data?.error || 'Não foi possível criar a conta.');
      return;
    }

    await carregarUsuarios();
    await entrarComoUsuario(data.user, data.token);
    fecharModalCadastro();
    mostrarToast('Conta criada com sucesso!');
  } catch (err) {
    alert(err.message || 'Erro ao criar conta.');
  }
}

function mostrarErroLogin(mensagem) {
  loginErroEl.textContent = mensagem;
  loginErroEl.classList.remove('hidden');
}

function limparErroLogin() {
  loginErroEl.textContent = '';
  loginErroEl.classList.add('hidden');
}

// ============================================================
// TEMA
// ============================================================
function aplicarTemaSalvo() {
  const tema = localStorage.getItem('tadashi_tema');
  if (tema === 'dark') {
    document.body.classList.add('dark');
    btnTema.textContent = '☀️';
  }
}

function alternarTema() {
  const escuro = document.body.classList.toggle('dark');
  localStorage.setItem('tadashi_tema', escuro ? 'dark' : 'light');
  btnTema.textContent = escuro ? '☀️' : '🌙';
}

// ============================================================
// SUGESTÕES
// ============================================================
function renderizarSugestoes() {
  if (!usuarioAtual) return;

  const meuUsuario = todosUsuarios.find((u) => u.id === usuarioAtual.id) || usuarioAtual;
  const outros = todosUsuarios.filter((u) => u.id !== usuarioAtual.id).slice(0, 3);

  sugestoesUsuariosEl.innerHTML = outros.map((u) => {
    const jaSegue = (meuUsuario?.following || []).includes(u.id);
    return `
      <div class="sugestao-usuario">
        <div class="sugestao-usuario-info">
          <img class="avatar avatar-sm post-avatar-link" data-user="${escaparAttr(u.id)}" src="${escaparAttr(u.avatar)}" alt="${escaparAttr(u.name)}">
          <div>
            <div style="font-weight:700; font-size:14px;" class="post-avatar-link" data-user="${escaparAttr(u.id)}">${escaparHtml(u.name)}</div>
            <div style="color:var(--texto-secundario); font-size:13px;">${escaparHtml(u.handle)}</div>
          </div>
        </div>
        <button type="button" class="btn-seguir ${jaSegue ? 'seguindo' : ''}" data-follow-id="${escaparAttr(u.id)}">${jaSegue ? 'Deixar de seguir' : 'Seguir'}</button>
      </div>
    `;
  }).join('');

  sugestoesUsuariosEl.querySelectorAll('[data-follow-id]').forEach((botao) => {
    botao.addEventListener('click', () => {
      if (!socket) return;
      socket.emit('seguir', { alvoId: botao.dataset.followId });
    });
  });
}

function verificarDispositivo() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const mobileAgent = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  mobile = width <= 680 || coarsePointer || mobileAgent;
  document.body.classList.toggle('mobile-view', mobile);
  if (mobile) btnSair.classList.add('hidden');
  else btnSair.classList.remove('hidden');
}

// ============================================================
// PAINEL ADMIN
// ============================================================
function templateReportAdmin(r) {
  const targetUser = todosUsuarios.find((u) => u.id === r.targetUserId) || {};
  const reporter = r.deUserId !== 'sistema'
    ? (todosUsuarios.find((u) => u.id === r.deUserId) || {})
    : { name: 'Sistema', handle: 'automático' };
  const badgeClass = r.tipo === 'ofensivo' ? 'badge-automat' : 'badge-manual';
  const badgeText = r.tipo === 'ofensivo' ? '🚨 Auto' : '🚩 Manual';

  return `
    <div class="report-item" data-report-id="${escaparAttr(r.id)}">
      <div class="report-header">
        <span class="report-badge ${badgeClass}">${badgeText}</span>
        <span class="report-status ${r.resolvido ? 'resolvido' : 'pendente'}">${r.resolvido ? 'Resolvido' : 'Pendente'}</span>
      </div>
      <div class="report-motivo"><strong>Motivo:</strong> ${escaparHtml(r.motivo)}</div>
      <div class="report-info"><strong>Alvo:</strong> ${escaparHtml(targetUser.name || 'N/A')} ${escaparHtml(targetUser.handle || '')} ${targetUser.banned ? '🔴 BANIDO' : ''}</div>
      <div class="report-info"><strong>Reportado por:</strong> ${escaparHtml(reporter.name || 'N/A')}</div>
      ${!r.resolvido ? `
      <div class="report-acoes">
        <button class="btn btn-ban-report" data-user="${escaparAttr(r.targetUserId)}" data-report="${escaparAttr(r.id)}">Banir usuário</button>
        <button class="btn btn-resolver" data-report="${escaparAttr(r.id)}">Marcar resolvido</button>
      </div>` : ''}
    </div>
  `;
}

function ehStaff(u) {
  return u && (u.role === 'admin' || u.role === 'moderador');
}

function templateAdminUser(u) {
  const status = u.banned ? '🔴 Banido' : '🟢 Ativo';
  const ehAdmin = ehStaff(usuarioAtual) && usuarioAtual.role === 'admin';
  const ehMod = ehStaff(usuarioAtual);
  const rotuloCargo = u.role === 'admin' ? 'Admin' : (u.role === 'moderador' ? 'Moderador' : 'User');
  const acoes = [];

  if (ehMod && u.role !== 'admin') {
    if (u.banned) acoes.push(`<button class="btn btn-sm btn-unban-user" data-userid="${escaparAttr(u.id)}">Desbanir</button>`);
    else acoes.push(`<button class="btn btn-sm btn-ban-user" data-userid="${escaparAttr(u.id)}">Banir</button>`);
    acoes.push(`<button class="btn btn-sm btn-strike-user" data-userid="${escaparAttr(u.id)}">+1 Strike</button>`);
    if (u.strikes > 0) acoes.push(`<button class="btn btn-sm btn-remove-strike" data-userid="${escaparAttr(u.id)}">-1 Strike</button>`);
  }
  if (ehAdmin && u.role !== 'admin') {
    acoes.push(`<button class="btn btn-sm btn-del-user btn-danger" data-userdel="${escaparAttr(u.id)}">🗑️ Excluir</button>`);
    if (u.role === 'moderador') {
      acoes.push(`<button class="btn btn-sm btn-role-user" data-userid="${escaparAttr(u.id)}" data-role="user">👇 Rebaixar</button>`);
    } else {
      acoes.push(`<button class="btn btn-sm btn-role-user" data-userid="${escaparAttr(u.id)}" data-role="moderador">🛡️ Mod</button>`);
      acoes.push(`<button class="btn btn-sm btn-role-user" data-userid="${escaparAttr(u.id)}" data-role="admin">👑 Admin</button>`);
    }
  }

  return `
    <div class="admin-user-item" data-user="${escaparAttr(u.id)}">
      <img class="avatar avatar-sm" src="${escaparAttr(u.avatar)}" alt="avatar">
      <div class="admin-user-info">
        <strong>${escaparHtml(u.name)}</strong>
        <span>${escaparHtml(u.handle)}</span>
        <small>Strikes: ${u.strikes || 0}/${MAX_STRIKES} | Cargo: ${rotuloCargo}</small>
      </div>
      <span class="user-status ${u.banned ? 'banido' : 'ativo'}">${status}</span>
      <div class="admin-user-acoes">${acoes.join('')}</div>
    </div>
  `;
}

// ============================================================
// TOASTS
// ============================================================

// ============================================================
// FUNÇÕES DO PAINEL ADMIN
// ============================================================
async function carregarAdminPanel() {
  await Promise.all([
    carregarStatsAdmin(),
    carregarReportsAdmin(),
    carregarUsuariosAdmin()
  ]);
  if (!tabPosts.classList.contains('hidden')) renderizarAdminPosts();
}

async function carregarReportsAdmin() {
  const { resp, data } = await api('/api/admin/reports');
  if (!resp.ok) return;
  const reports = Array.isArray(data) ? data : [];
  listaReports.innerHTML = reports.length
    ? reports.map(templateReportAdmin).join('')
    : '<div class="admin-lista-vazia">Nenhum reporte pendente.</div>';

  listaReports.querySelectorAll('.btn-ban-report').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.user;
      const motivo = prompt('Motivo do banimento:') || 'Violação das regras';
      if (!motivo.trim()) return;
      const { resp } = await api(`/api/admin/users/${alvoId}/ban`, {
        method: 'POST', body: JSON.stringify({ motivo })
      });
      if (resp.ok) { mostrarToast('Usuário banido.'); carregarReportsAdmin(); carregarUsuariosAdmin(); }
    });
  });
  listaReports.querySelectorAll('.btn-resolver').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reportId = btn.dataset.report;
      const { resp } = await api(`/api/admin/reports/${reportId}/responder`, {
        method: 'POST', body: JSON.stringify({ resolver: true })
      });
      if (resp.ok) { mostrarToast('Reporte resolvido.'); carregarReportsAdmin(); }
    });
  });
}

async function carregarUsuariosAdmin() {
  const { resp, data } = await api('/api/admin/users');
  if (!resp.ok) return;
  todosUsuariosAdmin = Array.isArray(data) ? data : [];

  const filtro = adminUserFiltro;
  const usuarios = todosUsuariosAdmin.filter((u) =>
    !filtro || String(u.name).toLowerCase().includes(filtro) || String(u.handle).toLowerCase().includes(filtro)
  );

  listaAdminUsers.innerHTML = usuarios.length
    ? usuarios.map(templateAdminUser).join('')
    : '<div class="admin-lista-vazia">Nenhum usuário encontrado.</div>';

  ligarAcoesAdminUsuarios();
}

function ligarAcoesAdminUsuarios() {
  const atualizar = () => { carregarUsuariosAdmin(); carregarStatsAdmin(); };

  listaAdminUsers.querySelectorAll('.btn-ban-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userid;
      const motivo = prompt('Motivo do banimento:') || 'Violação das regras';
      if (!motivo.trim()) return;
      const { resp } = await api(`/api/admin/users/${alvoId}/ban`, {
        method: 'POST', body: JSON.stringify({ motivo })
      });
      if (resp.ok) { mostrarToast('Usuário banido.'); atualizar(); carregarReportsAdmin(); }
    });
  });
  listaAdminUsers.querySelectorAll('.btn-unban-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userid;
      const { resp } = await api(`/api/admin/users/${alvoId}/unban`, { method: 'POST' });
      if (resp.ok) { mostrarToast('Usuário desbanido.'); atualizar(); carregarReportsAdmin(); }
    });
  });
  listaAdminUsers.querySelectorAll('.btn-strike-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userid;
      const motivo = prompt('Motivo do strike:') || 'Violação das regras';
      if (!motivo.trim()) return;
      const { resp, data } = await api(`/api/admin/users/${alvoId}/strike`, {
        method: 'POST', body: JSON.stringify({ motivo })
      });
      if (resp.ok) { mostrarToast(`Strike aplicado (${data.strikes}/${MAX_STRIKES}).`); atualizar(); carregarReportsAdmin(); }
    });
  });
  listaAdminUsers.querySelectorAll('.btn-remove-strike').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userid;
      if (!confirm('Remover 1 strike deste usuário?')) return;
      const { resp } = await api(`/api/admin/users/${alvoId}/remove-strike`, { method: 'POST' });
      if (resp.ok) { mostrarToast('Strike removido.'); atualizar(); }
    });
  });
  listaAdminUsers.querySelectorAll('.btn-role-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userid;
      const role = btn.dataset.role;
      const rotulo = role === 'admin' ? 'administrador' : role === 'moderador' ? 'moderador' : 'usuário comum';
      if (!confirm(`Alterar o cargo deste usuário para ${rotulo}?`)) return;
      const { resp } = await api(`/api/admin/users/${alvoId}/role`, {
        method: 'POST', body: JSON.stringify({ role })
      });
      if (resp.ok) { mostrarToast(`Cargo alterado para ${rotulo}.`); atualizar(); }
    });
  });
  listaAdminUsers.querySelectorAll('.btn-del-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const alvoId = btn.dataset.userdel;
      const alvo = todosUsuarios.find((u) => u.id === alvoId);
      if (!confirm(`⚠️ Excluir PERMANENTEMENTE a conta ${alvo ? `@${alvo.handle}` : ''}? Todos os posts, mensagens e dados serão apagados.`)) return;
      const { resp } = await api(`/api/admin/users/${alvoId}/delete`, { method: 'POST' });
      if (resp.ok) {
        mostrarToast('🚫 Conta excluída.');
        todosUsuarios = todosUsuarios.filter((u) => u.id !== alvoId);
        renderizarContatos();
        renderizarSugestoes();
        atualizar();
      }
    });
  });
}

async function carregarStatsAdmin() {
  const { resp, data } = await api('/api/admin/stats');
  if (!resp.ok) return;
  const s = data || {};
  const cards = [
    ['👥 Usuários', s.totalUsuarios],
    ['📝 Posts', s.totalPosts],
    ['🎬 Posts c/ vídeo', s.totalPostsComVideo],
    ['💬 Mensagens', s.totalMensagens],
    ['🚩 Reports', s.totalReports],
    ['⏳ Reports pendentes', s.reportesPendentes],
    ['🚫 Banidos', s.totalBanidos],
    ['👑 Admins', s.totalAdmins],
    ['🛡️ Moderadores', s.totalModeradores],
    ['⚠️ Strikes (total)', s.totalStrikes]
  ];
  adminStatsEl.innerHTML = cards.map(([label, valor]) => `
    <div class="admin-stat-card">
      <span class="admin-stat-valor">${valor ?? 0}</span>
      <span class="admin-stat-label">${label}</span>
    </div>
  `).join('');
}

async function enviarAnuncioGlobal() {
  const mensagem = adminAnuncioTexto.value.trim();
  if (!mensagem) { mostrarToast('Digite o texto do anúncio.'); return; }
  const trecho = mensagem.length > 120 ? mensagem.slice(0, 120) + '…' : mensagem;
  if (!confirm(`Enviar este anúncio para todos os usuários?\n\n"${trecho}"`)) return;
  const { resp, data } = await api('/api/admin/announcement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensagem })
  });
  if (resp.ok) {
    mostrarToast(`📢 Anúncio enviado para ${data.destinatarios || 0} usuário(s).`);
    adminAnuncioTexto.value = '';
  } else {
    mostrarToast(data?.error || 'Não foi possível enviar o anúncio.');
  }
}

function mudarAbaAdmin(btn, painel) {
  const botoes = [btnAdminStats, btnAdminReports, btnAdminUsers, btnAdminPosts, btnAdminAnuncio];
  const paineis = [tabStats, tabReports, tabUsers, tabPosts, tabAnuncio];
  botoes.forEach((b) => b.classList.remove('btn-admin-ativo'));
  paineis.forEach((p) => p.classList.add('hidden'));
  btn.classList.add('btn-admin-ativo');
  painel.classList.remove('hidden');

  if (painel === tabStats) carregarStatsAdmin();
  if (painel === tabUsers) carregarUsuariosAdmin();
  if (painel === tabPosts) renderizarAdminPosts();
  if (painel === tabReports) carregarReportsAdmin();
}

function renderizarAdminPosts() {
  listaAdminPosts.innerHTML = posts.length
    ? posts.map(templatePost).join('')
    : '<div class="admin-lista-vazia">Nenhum post encontrado.</div>';
  ligarEventosDosPostsEm(listaAdminPosts);
}
function mostrarToast(mensagem) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensagem;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function irParaPagina(nome) {
  paginaAtual = nome;
  Object.entries(paginas).forEach(([chave, el]) => el.classList.toggle('hidden', chave !== nome));
  navItens.forEach((item) => item.classList.toggle('nav-ativo', item.dataset.pagina === nome));

  if (nome === 'perfil') {
    const id = perfilSelecionadoId || usuarioAtual?.id;
    if (id) abrirPerfil(id);
  }
  if (nome === 'videos') renderizarVideos();
  if (nome === 'explorar') renderizarBusca(inputBusca.value.trim().toLowerCase());
    if (nome === 'mensagens' && usuarioAtual) carregarMensagens();
  if (nome === 'notificacoes') marcarNotificacoesLidas();
  if (nome === 'admin' && usuarioAtual && ehStaff(usuarioAtual)) carregarAdminPanel();
}

// ============================================================
// PERFIL
// ============================================================
async function abrirPerfil(userId) {
  if (!usuarioAtual) return;

  let usuario = todosUsuarios.find((u) => u.id === userId);
  if (!usuario) {
    await carregarUsuarios();
    usuario = todosUsuarios.find((u) => u.id === userId);
  }
  if (!usuario) return;

  perfilSelecionadoId = usuario.id;
  perfilAvatar.src = usuario.avatar;
  perfilAvatar.dataset.userId = usuario.id;
  perfilNome.textContent = usuario.name;
  perfilHandle.textContent = usuario.handle;
  perfilBio.textContent = usuario.bio || '';
  perfilSeguindo.textContent = (usuario.following || []).length;

  const seguidores = todosUsuarios.filter((u) => (u.following || []).includes(usuario.id)).length;
  perfilSeguidores.textContent = seguidores;

  // botão mudar avatar só no próprio perfil
  btnMudarAvatar.classList.toggle('hidden', usuario.id !== usuarioAtual.id);

  const { resp, data } = await api(`/api/posts/usuario/${userId}`);
  const postsDoPerfil = resp.ok && Array.isArray(data) ? data : [];
  perfilPostsQtd.textContent = postsDoPerfil.length;

  listaPostsPerfilEl.innerHTML = postsDoPerfil.length
    ? postsDoPerfil.map((p) => templatePost(p)).join('')
    : '<div class="notificacao-vazia">Nenhum post ainda.</div>';

  ligarEventosDosPostsEm(listaPostsPerfilEl);

  const botaoExistente = document.getElementById('btn-seguir-perfil');
  if (botaoExistente) botaoExistente.remove();

  if (usuario.id !== usuarioAtual.id) {
    const meuUsuario = todosUsuarios.find((u) => u.id === usuarioAtual.id) || usuarioAtual;
    const jaSegue = (meuUsuario.following || []).includes(usuario.id);

    const btn = document.createElement('button');
    btn.id = 'btn-seguir-perfil';
    btn.type = 'button';
    btn.className = `btn-seguir ${jaSegue ? 'seguindo' : ''}`;
    btn.style.marginTop = '10px';
    btn.textContent = jaSegue ? 'Deixar de seguir' : 'Seguir';
    btn.addEventListener('click', () => {
      if (!socket) return;
      socket.emit('seguir', { alvoId: usuario.id });
    });
    document.querySelector('.cabecalho-perfil').appendChild(btn);
  }
}

// ============================================================
// VÍDEOS
// ============================================================
function renderizarVideos() {
  if (!usuarioAtual) return;
  const videos = posts.filter((p) => Boolean(p.video) && !(p.repostBy && p.originalId));

  if (!videos.length) {
    listaVideosEl.innerHTML = '<div class="notificacao-vazia">Ainda não há vídeos publicados.</div>';
    return;
  }

  listaVideosEl.innerHTML = videos.map((p) => `
    <div class="tiktok-video" data-post-id="${escaparAttr(p.id)}">
      <video class="tiktok-player" src="${escaparAttr(p.video)}" loop muted playsinline preload="metadata"></video>
      <div class="tiktok-escurecer"></div>
      <div class="tiktok-overlay">
        <div class="tiktok-info">
          <div class="tiktok-usuario">@${escaparHtml(String(p.authorHandle || '').replace(/^@/, ''))}</div>
          <div class="tiktok-legenda">${formatarMencoes(escaparHtml(p.texto || ''))}</div>
        </div>
        <div class="tiktok-lateral">
          <button type="button" class="tiktok-btn" data-acao="like" title="Curtir">❤️<span class="tiktok-qtd">${(p.likes || []).length}</span></button>
          <button type="button" class="tiktok-btn" data-acao="mudo" title="Som">🔊</button>
          <button type="button" class="tiktok-btn" data-acao="compartilhar" title="Compartilhar">🔗</button>
          <button type="button" class="tiktok-btn" data-acao="enviar-amigo" title="Enviar para amigo">📤</button>
        </div>
      </div>
    </div>
  `).join('');

  ligarAcoesTikTok(listaVideosEl);
  configurarTikTokFeed(listaVideosEl);
}

function ligarAcoesTikTok(container) {
  if (!socket || !usuarioAtual) return;

  container.querySelectorAll('.tiktok-video').forEach((item) => {
    const postId = item.dataset.postId;
    const post = posts.find((p) => p.id === postId);
    const player = item.querySelector('video');
    const btnMudo = item.querySelector('[data-acao="mudo"]');
    const btnLike = item.querySelector('[data-acao="like"]');

    btnMudo?.addEventListener('click', () => {
      if (!player) return;
      player.muted = !player.muted;
      btnMudo.textContent = player.muted ? '🔇' : '🔊';
      if (!player.muted) player.play().catch(() => {});
      else player.pause();
    });

    btnLike?.addEventListener('click', () => {
      socket.emit('curtir', { postId });
    });

    item.querySelector('[data-acao="compartilhar"]')?.addEventListener('click', () => {
      compartilharVideoExterno(post);
    });

    item.querySelector('[data-acao="enviar-amigo"]')?.addEventListener('click', () => {
      abrirModalEnviarVideo(post);
    });
  });
}

function configurarTikTokFeed(container) {
  const items = container.querySelectorAll('.tiktok-video');
  if (!items.length) return;
  const players = Array.from(items).map((v) => v.querySelector('video'));

  function tocarVisivel() {
    const centro = window.innerHeight / 2;
    let alvo = items[0], melhor = Infinity;
    items.forEach((v) => {
      const r = v.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - centro);
      if (dist < melhor) { melhor = dist; alvo = v; }
    });
    players.forEach((vid, i) => {
      if (items[i] === alvo) {
        // mantém o estado de som/mudo atual do vídeo
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }

  const rolagem = container.closest('.pagina') || window;
  (rolagem === window ? window : container).addEventListener('scroll', tocarVisivel);
  window.addEventListener('touchmove', tocarVisivel);
  requestAnimationFrame(() => {
    players.forEach((vid) => vid.play().catch(() => {}));
  });
}

// Compartilha o vídeo FORA da rede (Web Share / copiar link)
async function compartilharVideoExterno(post) {
  const url = `${location.origin}${post.video}`;
  const titulo = `Vídeo no Tadashi por ${post.authorName || 'alguém'}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: titulo, text: post.texto || '', url });
      return;
    }
  } catch (e) { /* usuário cancelou ou sem suporte */ }
  try {
    await navigator.clipboard.writeText(url);
    mostrarToast('🔗 Link do vídeo copiado!');
  } catch (e) {
    prompt('Copie o link do vídeo:', url);
  }
}

// Envia o vídeo para um amigo DENTRO da rede (vira mensagem no chat)
let videoParaEnviar = null;
function abrirModalEnviarVideo(post) {
  if (!usuarioAtual) return;
  videoParaEnviar = post;
  const amigos = todosUsuarios.filter((u) => u.id !== usuarioAtual.id);
  listaEnviarVideo.innerHTML = amigos.length
    ? amigos.map((u) => `
      <button type="button" class="mencao-item" data-enviar-id="${u.id}">
        <img class="avatar avatar-sm" src="${escaparAttr(u.avatar)}" alt="">
        <div>
          <div class="mencao-nome">${escaparHtml(u.name)}</div>
          <div class="mencao-handle">${escaparHtml(u.handle)}</div>
        </div>
      </button>`).join('')
    : '<div class="notificacao-vazia">Nenhum amigo para enviar.</div>';
  modalEnviarVideo.classList.remove('hidden');
}

function fecharModalEnviarVideo() {
  modalEnviarVideo.classList.add('hidden');
  videoParaEnviar = null;
}

async function enviarVideoParaAmigo(amigoId) {
  if (!videoParaEnviar) return;
  try {
    const { resp, data } = await api('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toId: amigoId, video: videoParaEnviar.video, texto: '' })
    });
    fecharModalEnviarVideo();
    if (!resp.ok) {
      mostrarToast(data?.error || 'Não foi possível enviar o vídeo.');
      return;
    }
    mostrarToast('📤 Vídeo enviado para o amigo!');
    if (data?.id && !mensagens.some((m) => m.id === data.id)) {
      mensagens.push(data);
      renderizarConversa();
    }
  } catch (err) {
    mostrarToast(err.message || 'Erro ao enviar vídeo.');
  }
}

// ============================================================
// EXPLORAR
// ============================================================
function renderizarBusca(termo) {
  if (!termo) {
    listaBuscaEl.innerHTML = '<div class="notificacao-vazia">Digite algo para buscar posts, pessoas, nomes ou @handles.</div>';
    return;
  }

  const busca = termo.toLowerCase();

  const resultadosPosts = posts.filter((p) =>
    (p.texto || '').toLowerCase().includes(busca) ||
    (p.authorName || '').toLowerCase().includes(busca) ||
    (p.authorHandle || '').toLowerCase().includes(busca)
  );

  const resultadosUsuarios = todosUsuarios.filter((u) =>
    (u.name || '').toLowerCase().includes(busca) ||
    (u.handle || '').toLowerCase().includes(busca) ||
    (u.bio || '').toLowerCase().includes(busca)
  );

  const htmlUsuarios = resultadosUsuarios.length
    ? `<section class="resultados-pessoas">
        <div class="titulo-busca">Pessoas</div>
        ${resultadosUsuarios.map((u) => templateUsuarioBusca(u)).join('')}
      </section>`
    : '';

  const htmlPosts = resultadosPosts.length
    ? `<section class="resultados-posts">
        <div class="titulo-busca">Posts</div>
        ${resultadosPosts.map((p) => templatePost(p)).join('')}
      </section>`
    : '';

  const existeResultado = resultadosPosts.length || resultadosUsuarios.length;
  listaBuscaEl.innerHTML = existeResultado
    ? `${htmlUsuarios}${htmlPosts}`
    : '<div class="notificacao-vazia">Nenhum resultado encontrado.</div>';

  ligarEventosDosPostsEm(listaBuscaEl);

  listaBuscaEl.querySelectorAll('[data-follow-id]').forEach((botao) => {
    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!socket || !usuarioAtual) return;
      socket.emit('seguir', { alvoId: botao.dataset.followId });
    });
  });
}

function templateUsuarioBusca(u) {
  if (!usuarioAtual) return '';
  const meuUsuario = todosUsuarios.find((x) => x.id === usuarioAtual.id) || usuarioAtual;
  const jaSegue = (meuUsuario?.following || []).includes(u.id);
  const souEu = u.id === usuarioAtual.id;

  return `<article class="resultado-pessoa" data-open-profile="${escaparAttr(u.id)}">
    <div class="resultado-pessoa-topo">
      <img class="avatar avatar-sm" src="${escaparAttr(u.avatar)}" alt="${escaparAttr(u.name)}" data-open-profile="${escaparAttr(u.id)}">
      <div class="resultado-pessoa-texto" data-open-profile="${escaparAttr(u.id)}">
        <div class="resultado-pessoa-nome">${escaparHtml(u.name)}</div>
        <div class="resultado-pessoa-handle">${escaparHtml(u.handle)}</div>
      </div>
      ${souEu ? '' : `<button type="button" class="btn-seguir ${jaSegue ? 'seguindo' : ''}" data-follow-id="${escaparAttr(u.id)}">${jaSegue ? 'Deixar de seguir' : 'Seguir'}</button>`}
    </div>
    <div class="resultado-pessoa-bio" data-open-profile="${escaparAttr(u.id)}">${escaparHtml(u.bio || 'Novo membro do Tadashi.')}</div>
  </article>`;
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================
async function carregarNotificacoes() {
  if (!usuarioAtual || !authToken) return;
  try {
    const { resp, data } = await api('/api/notifications');
    if (!resp.ok) {
      notificacoes = [];
      atualizarBadgeNotificacoes();
      return;
    }
    notificacoes = (Array.isArray(data) ? data : []).map((n) => ({
      id: n.id,
      mensagem: n.mensagem,
      createdAt: n.createdAt,
      lida: Boolean(n.lida),
      tipo: n.tipo
    }));
    atualizarBadgeNotificacoes();
    if (paginaAtual === 'notificacoes') renderizarNotificacoes();
  } catch {
    notificacoes = [];
  }
}

async function marcarNotificacoesLidas() {
  notificacoes.forEach((n) => { n.lida = true; });
  atualizarBadgeNotificacoes();
  renderizarNotificacoes();
  try {
    await api('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  } catch {
    // silencioso
  }
}

function renderizarNotificacoes() {
  listaNotificacoesEl.innerHTML = notificacoes.length
    ? notificacoes.map((n) => `
        <div class="notificacao-item ${n.lida ? '' : 'nao-lida'}">🔔 <span>${escaparHtml(n.mensagem)} · ${tempoRelativo(n.createdAt)}</span></div>
      `).join('')
    : '<div class="notificacao-vazia">Nenhuma notificação ainda.</div>';
}

function atualizarBadgeNotificacoes() {
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  badgeNotif.textContent = naoLidas > 99 ? '99+' : String(naoLidas);
  badgeNotif.classList.toggle('hidden', naoLidas === 0);
}

// ============================================================
// UTILS
// ============================================================
// ============================================================
// MÍDIA NAS MENSAGENS
// ============================================================
function lerMidiaMensagem(input, tipo, limiteMb) {
  const arquivo = input.files[0];
  if (!arquivo) return;

  const prefixo = tipo === 'imagem' ? 'image' : (tipo === 'video' ? 'video' : 'audio');
  if (!arquivo.type.startsWith(prefixo + '/')) {
    mostrarToast(`Selecione um arquivo de ${tipo}.`);
    input.value = '';
    return;
  }
  if (arquivo.size > limiteMb * 1024 * 1024) {
    mostrarToast(`${tipo === 'imagem' ? 'Imagem' : (tipo === 'video' ? 'Vídeo' : 'Áudio')} muito grande (máx. ${limiteMb} MB).`);
    input.value = '';
    return;
  }

  const leitor = new FileReader();
  leitor.onload = () => {
    midiaMensagem[tipo] = leitor.result;
    mostrarToast(`📎 ${tipo === 'imagem' ? 'Foto' : (tipo === 'video' ? 'Vídeo' : 'Áudio')} anexada(o). É só enviar.`);
    inputMensagem.focus();
  };
  leitor.readAsDataURL(arquivo);
}

// ============================================================
// MARCAR PESSOA (MENÇÃO)
// ============================================================
function abrirModalMencao() {
  if (!usuarioAtual) return;
  inputMencaoBusca.value = '';
  renderizarListaMencao();
  modalMencao.classList.remove('hidden');
  inputMencaoBusca.focus();
}

function fecharModalMencao() {
  modalMencao.classList.add('hidden');
}

function renderizarListaMencao() {
  if (!usuarioAtual) return;
  const busca = inputMencaoBusca.value.trim().toLowerCase();
  const usuarios = todosUsuarios
    .filter((u) => u.id !== usuarioAtual.id)
    .filter((u) => !busca || u.name.toLowerCase().includes(busca) || u.handle.toLowerCase().includes(busca));

  if (!usuarios.length) {
    listaMencao.innerHTML = '<div class="notificacao-vazia">Nenhum usuário encontrado.</div>';
    return;
  }

  listaMencao.innerHTML = usuarios.map((u) => `
    <button type="button" class="mencao-item" data-mencao-id="${u.id}">
      <img class="avatar avatar-sm" src="${escaparAttr(u.avatar)}" alt="">
      <div>
        <div class="mencao-nome">${escaparHtml(u.name)}</div>
        <div class="mencao-handle">${escaparHtml(u.handle)}</div>
      </div>
    </button>
  `).join('');

  listaMencao.querySelectorAll('[data-mencao-id]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const u = todosUsuarios.find((x) => x.id === botao.dataset.mencaoId);
      if (!u) return;
      const atual = inputPost.value;
      inputPost.value += (atual && !/ $/.test(atual) ? ' ' : '') + u.handle + ' ';
      fecharModalMencao();
      inputPost.focus();
      atualizarEstadoCompositor();
    });
  });
}

// ============================================================
// CHAMADA DE VOZ (WebRTC com sinalização via Socket.io)
// ============================================================
let callRemoteAudioEl = null;

async function iniciarChamadaVoz(contatoId) {
  if (!socket || !usuarioAtual) return;
  if (chamadaAtiva) {
    mostrarToast('Já existe uma chamada em andamento.');
    return;
  }
  const contato = todosUsuarios.find((u) => u.id === contatoId);
  if (!contato) return;

  streamLocal = null;
  try {
    streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    mostrarToast('Permissão de microfone negada.');
    return;
  }

  callDirecao = 'out';
  callContatoId = contatoId;
  chamadaAtiva = true;
  callAvatar.src = contato.avatar;
  callInfoEl.textContent = `${contato.name} (@${contato.handle.replace(/^@/, '')})`;
  callStatusEl.textContent = 'Chamando...';
  callBtnRecusar.classList.add('hidden');
  callBtnAceitar.classList.add('hidden');
  callBtnMute.classList.remove('hidden');
  callBtnEnd.classList.remove('hidden');
  callOverlay.classList.remove('hidden');

  try {
    await criarPeerVoz(contatoId, 'out');
    socket.emit('chamarVoz', { toId: contatoId });
  } catch (err) {
    console.warn(err);
    mostrarToast('Não foi possível iniciar a chamada.');
    pararChamadaVoz();
  }
}

async function criarPeerVoz(contatoId, direcao) {
  await pararRecursosPeerAtuais();
  const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  peer = new RTCPeerConnection(config);

  if (streamLocal && streamLocal.getAudioTracks().length) {
    streamLocal.getAudioTracks().forEach((t) => peer.addTrack(t, streamLocal));
  }

  if (!callRemoteAudioEl) {
    callRemoteAudioEl = new Audio();
    callRemoteAudioEl.autoplay = true;
  }

  peer.ontrack = (evento) => {
    if (evento.streams && evento.streams[0]) {
      callRemoteAudioEl.srcObject = evento.streams[0];
      callRemoteAudioEl.play().catch(() => {});
    }
  };

  peer.onicecandidate = (evento) => {
    if (evento.candidate && socket && callContatoId) {
      socket.emit('sinalVoz', {
        toId: callContatoId,
        fromId: usuarioAtual.id,
        descricao: null,
        candidato: evento.candidate
      });
    }
  };

  peer.onconnectionstatechange = () => {
    if (peer && ['failed', 'closed', 'disconnected'].includes(peer.connectionState)) {
      pararChamadaVoz();
    }
  };

  // Quem está ligando cria a oferta; quem atende aguarda receber
  if (direcao === 'out') {
    const oferta = await peer.createOffer();
    await peer.setLocalDescription(oferta);
    socket.emit('sinalVoz', {
      toId: callContatoId,
      fromId: usuarioAtual.id,
      descricao: peer.localDescription,
      candidato: null
    });
  }

  return peer;
}

async function aceitarChamada() {
  if (!chamadaAtiva || callDirecao !== 'in' || !callContatoId) return;
  callStatusEl.textContent = 'Conectando...';
  callBtnRecusar.classList.add('hidden');
  callBtnAceitar.classList.add('hidden');
  callBtnMute.classList.remove('hidden');
  callBtnEnd.classList.remove('hidden');

  try {
    streamLocal = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    mostrarToast('Permissão de microfone negada.');
    return;
  }

  try {
    await criarPeerVoz(callContatoId, 'in');
    socket.emit('chamadaVozResposta', { toId: callContatoId, aceita: true, callId: callIdAtual });
    // Aplica os sinais (offer/ICE) que chegaram enquanto aguardava a aceitação
    const pendentes = sinalPendenteIn;
    sinalPendenteIn = [];
    for (const sinal of pendentes) {
      try {
        if (sinal.descricao) {
          await peer.setRemoteDescription(sinal.descricao);
          if (sinal.descricao.type === 'offer') {
            const resposta = await peer.createAnswer();
            await peer.setLocalDescription(resposta);
            socket.emit('sinalVoz', {
              toId: callContatoId,
              fromId: usuarioAtual.id,
              descricao: peer.localDescription,
              candidato: null
            });
          }
        }
        if (sinal.candidato) await peer.addIceCandidate(sinal.candidato);
      } catch (err) { /* ignora */ }
    }
  } catch (err) {
    console.warn(err);
    mostrarToast('Não foi possível aceitar a chamada.');
    pararChamadaVoz();
  }
}

function recusarChamada() {
  if (callContatoId) {
    socket.emit('chamadaVozResposta', { toId: callContatoId, aceita: false, callId: callIdAtual });
  }
  pararChamadaVoz();
}

function encerrarChamada() {
  if (callContatoId) {
    socket.emit('encerrarChamada', { toId: callContatoId });
  }
  pararChamadaVoz();
}

function alternarMudoChamada() {
  if (!streamLocal) return;
  callMudo = !callMudo;
  streamLocal.getAudioTracks().forEach((t) => { t.enabled = !callMudo; });
  callBtnMute.textContent = callMudo ? '🔇' : '🎙️';
  callBtnMute.title = callMudo ? 'Ativar microfone' : 'Mutar';
}

async function pararRecursosPeerAtuais() {
  if (peer) {
    try { peer.close(); } catch (e) { /* ignora */ }
    peer = null;
  }
  if (streamLocal) {
    streamLocal.getTracks().forEach((t) => t.stop());
    streamLocal = null;
  }
  callMudo = false;
  callBtnMute.textContent = '🎙️';
  callBtnMute.title = 'Mutar';
}

function pararChamadaVoz() {
  pararRecursosPeerAtuais();
  chamadaAtiva = false;
  callDirecao = null;
  callIdAtual = null;
  callContatoId = null;
  sinalPendenteIn = [];
  callOverlay.classList.add('hidden');
  callBtnRecusar.classList.add('hidden');
  callBtnAceitar.classList.add('hidden');
  callBtnMute.classList.add('hidden');
  callBtnEnd.classList.add('hidden');
}

function tempoRelativo(timestamp) {
  const diffMs = Date.now() - timestamp;
  const seg = Math.floor(diffMs / 1000);
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  if (dias < 7) return `${dias}d`;
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

function escaparAttr(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


setInterval(() => {
  if (!usuarioAtual) return;
  document.querySelectorAll('.post').forEach((el) => {
    const post = posts.find((p) => p.id === el.dataset.id);
    if (!post) return;
    const tempoEl = el.querySelector('.post-tempo');
    if (tempoEl) tempoEl.textContent = `· ${tempoRelativo(post.createdAt)}`;
  });
}, 30000);
