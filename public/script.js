// ============================================================
// TADASHI - script.js
// Frontend puro (sem frameworks). Responsável por:
// - Tela de login (escolha de perfil entre os 5 usuários)
// - Conexão Socket.io e escuta de eventos em tempo real
// - Renderização do feed, posts, likes, reposts, comentários
// - Dark mode com localStorage
// - Toasts de notificação e scroll infinito simulado
// ============================================================

// ---------- ESTADO GLOBAL DA APLICAÇÃO ----------
const socket = io(); // conecta automaticamente ao servidor Socket.io

let usuarioAtual = null;   // usuário logado (objeto completo)
let todosUsuarios = [];    // lista dos 5 usuários pré-cadastrados
let posts = [];            // cache local dos posts renderizados
let mensagens = [];        // cache local das mensagens privadas
let contatoMensagemAtual = null;
let imagemSelecionada = null; // base64 da imagem do post em criação
let videoSelecionado = null; // base64 do vídeo do post em criação
let perfilSelecionadoId = null; // perfil que está sendo renderizado no momento
let mobile = false;

// quantidade de posts exibidos por "página" no scroll infinito simulado
let postsExibidos = 10;

// controla qual "página" interna está ativa: inicio | explorar | perfil | notificacoes
let paginaAtual = 'inicio';

// histórico de notificações recebidas nesta sessão (para o badge e a página de notificações)
let notificacoes = [];

// ---------- REFERÊNCIAS DO DOM ----------
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

const listaPostsEl = document.getElementById('lista-posts');
const listaVideosEl = document.getElementById('lista-videos');
const carregandoMaisEl = document.getElementById('carregando-mais');
const sugestoesUsuariosEl = document.getElementById('sugestoes-usuarios');
const toastContainer = document.getElementById('toast-container');

const btnAddImagemArquivo = document.getElementById('input-arquivo-imagem');

// navegação entre páginas
const navItens = document.querySelectorAll('.nav-item[data-pagina]');
const paginas = {
  inicio: document.getElementById('pagina-inicio'),
  explorar: document.getElementById('pagina-explorar'),
  videos: document.getElementById('pagina-videos'),
  perfil: document.getElementById('pagina-perfil'),
  notificacoes: document.getElementById('pagina-notificacoes'),
  mensagens: document.getElementById('pagina-mensagens')
};

// página Explorar
const inputBusca = document.getElementById('input-busca');
const listaBuscaEl = document.getElementById('lista-busca');

// página Perfil
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

// página Notificações
const listaNotificacoesEl = document.getElementById('lista-notificacoes');
const badgeNotif = document.getElementById('badge-notif');

// página Mensagens
const paginaMensagens = document.getElementById('pagina-mensagens');
const listaContatosEl = document.getElementById('lista-contatos');
const conversaHeaderEl = document.getElementById('conversa-header');
const listaMensagensEl = document.getElementById('lista-mensagens');
const formMensagem = document.getElementById('form-mensagem');
const inputMensagem = document.getElementById('input-mensagem');

// ============================================================
// INICIALIZAÇÃO
// ============================================================
init();

async function init() {
  verificarDispositivo();    // identifica mobile/desktop para layout e UI
  aplicarTemaSalvo();       // recupera dark/light do localStorage
  await carregarUsuarios(); // busca os 5 usuários da API
  configurarEventos();      // liga todos os listeners de clique/input
  configurarSocket();       // liga os listeners de eventos em tempo real

  // se já havia um usuário logado nesta sessão do navegador, entra direto
  const salvoId = sessionStorage.getItem('tadashi_user_id');
  if (salvoId) {
    const usuario = todosUsuarios.find((u) => u.id === salvoId);
    if (usuario) entrarComoUsuario(usuario);
  }
}

// Busca a lista de usuários pré-cadastrados no backend e monta a tela de login
async function carregarUsuarios() {
  const resp = await fetch('/api/users');
  todosUsuarios = await resp.json();

  listaUsuariosEl.innerHTML = todosUsuarios.map((u) => `
    <button class="usuario-card" data-id="${u.id}">
      <img class="avatar" src="${u.avatar}" alt="${u.name}">
      <div>
        <div class="usuario-card-nome">${escaparHtml(u.name)}</div>
        <div class="usuario-card-handle">${escaparHtml(u.handle)}</div>
      </div>
    </button>
  `).join('');

  // cada card de usuário preenche o handle do formulário de login e leva o foco para a senha
  listaUsuariosEl.querySelectorAll('.usuario-card').forEach((card) => {
    card.addEventListener('click', () => {
      const usuario = todosUsuarios.find((u) => u.id === card.dataset.id);
      if (!usuario) return;
      inputLoginHandle.value = usuario.handle;
      inputLoginSenha.focus();
    });
  });
}

// ============================================================
// LOGIN / LOGOUT
// ============================================================

// Define o usuário logado, esconde a tela de login e carrega o feed
function entrarComoUsuario(usuario) {
  usuarioAtual = usuario;
  perfilSelecionadoId = usuario.id;
  sessionStorage.setItem('tadashi_user_id', usuario.id);

  telaLogin.classList.add('hidden');
  appEl.classList.remove('hidden');
  btnMudarAvatar.classList.remove('hidden');

  headerAvatar.src = usuario.avatar;
  headerHandle.textContent = usuario.handle;
  compositorAvatar.src = usuario.avatar;

  renderizarSugestoes();
  carregarFeedInicial();
  carregarMensagens();
}

// Sai da conta atual e volta para a tela de login
function sair() {
  usuarioAtual = null;
  perfilSelecionadoId = null;
  sessionStorage.removeItem('tadashi_user_id');
  btnMudarAvatar.classList.add('hidden');
  appEl.classList.add('hidden');
  telaLogin.classList.remove('hidden');
}

// ============================================================
// MENSAGENS PRIVADAS
// ============================================================

async function carregarMensagens() {
  if (!usuarioAtual) return;

  const resp = await fetch(`/api/messages/${usuarioAtual.id}`);
  mensagens = await resp.json();
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
    <button class="contato-card ${u.id === contatoMensagemAtual ? 'ativo' : ''}" data-contato="${u.id}">
      <img class="avatar avatar-sm" src="${u.avatar}" alt="${u.name}">
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
    <img class="avatar avatar-sm" src="${contato.avatar}" alt="${escaparHtml(contato.name)}">
    <div>
      <div class="conversa-nome">${escaparHtml(contato.name)}</div>
      <div class="conversa-handle">${escaparHtml(contato.handle)}</div>
    </div>
  `;

  const conversa = mensagens.filter((m) =>
    (m.fromId === usuarioAtual.id && m.toId === contato.id) ||
    (m.fromId === contato.id && m.toId === usuarioAtual.id)
  ).sort((a, b) => a.createdAt - b.createdAt);

  listaMensagensEl.innerHTML = conversa.length
    ? conversa.map((m) => `
      <div class="mensagem-item ${m.fromId === usuarioAtual.id ? 'mine' : ''}">
        <div class="mensagem-bala">${escaparHtml(m.texto)}</div>
        <div class="mensagem-data">${tempoRelativo(m.createdAt)}</div>
      </div>
    `).join('')
    : '<div class="notificacao-vazia">Nenhuma mensagem ainda. Comece a conversa.</div>';

  listaMensagensEl.scrollTop = listaMensagensEl.scrollHeight;
}

// Busca todos os posts existentes via REST (carga inicial) e renderiza
async function carregarFeedInicial() {
  const resp = await fetch('/api/posts');
  posts = await resp.json(); // já vem ordenado do mais novo para o mais antigo
  postsExibidos = 10;
  renderizarFeed();
}

// Renderiza a lista de posts no DOM, respeitando o limite do "scroll infinito"
function renderizarFeed() {
  const visiveis = posts.slice(0, postsExibidos);
  listaPostsEl.innerHTML = visiveis.map((p) => templatePost(p)).join('');
  ligarEventosDosPostsEm(listaPostsEl);

  // mostra/esconde o indicador de "carregando mais"
  carregandoMaisEl.classList.toggle('hidden', postsExibidos >= posts.length);
}

// Gera o HTML de um único post (usado tanto para posts normais quanto reposts)
function templatePost(p) {
  const jaCurtiu = p.likes.includes(usuarioAtual.id);
  const totalComentarios = (p.comentarios || []).length;

  const labelRepost = p.repostBy
    ? `<div class="post-repost-label">🔁 Repostado por ${p.repostBy.id === usuarioAtual.id ? 'você' : escaparHtml(p.repostBy.name)}</div>`
    : '';

  const imagemHtml = p.imagem
    ? `<img class="post-imagem" src="${p.imagem}" alt="imagem do post" onerror="this.style.display='none'">`
    : '';

  const videoHtml = p.video
    ? `<video class="post-video" controls playsinline preload="auto" src="${p.video}" aria-label="Vídeo do post"></video>`
    : '';

  const podeDeletar = p.authorId === usuarioAtual.id;

  const comentariosHtml = (p.comentarios || []).map((c) => `
    <div class="comentario-item"><strong>${escaparHtml(c.autor)}</strong>${escaparHtml(c.texto)}</div>
  `).join('');

  return `
    <article class="post" data-id="${p.id}">
      ${labelRepost}
      <img class="avatar post-avatar-link" data-user="${p.authorId}" src="${p.authorAvatar}" alt="${p.authorName}">
      <div class="post-corpo">
        <div class="post-cabecalho">
          <span class="post-nome post-avatar-link" data-user="${p.authorId}">${escaparHtml(p.authorName)}</span>
          <span class="post-handle">${escaparHtml(p.authorHandle)}</span>
          <span class="post-tempo">· ${tempoRelativo(p.createdAt)}</span>
        </div>
        <div class="post-texto">${escaparHtml(p.texto)}</div>
        ${imagemHtml}
        ${videoHtml}
        <div class="post-acoes">
          <button class="post-acao comentario" data-acao="comentario">
            💬 <span>${totalComentarios}</span>
          </button>
          <button class="post-acao repost ${p.repostBy && p.repostBy.id === usuarioAtual.id ? 'repostado' : ''}" data-acao="repost">
            🔁
          </button>
          <button class="post-acao like ${jaCurtiu ? 'curtido' : ''}" data-acao="like">
            <span class="icone-coracao">${jaCurtiu ? '❤️' : '🤍'}</span> <span class="qtd-likes">${p.likes.length}</span>
          </button>
          ${podeDeletar ? `<button class="post-acao deletar" data-acao="deletar">🗑️</button>` : '<span></span>'}
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

// Liga os eventos de clique (like, repost, deletar, comentar) em cada post renderizado
// Recebe o container (feed principal, resultados de busca ou posts do perfil)
function ligarEventosDosPostsEm(container) {
  container.querySelectorAll('.post').forEach((el) => {
    const postId = el.dataset.id;

    el.querySelector('[data-acao="like"]').addEventListener('click', () => {
      socket.emit('curtir', { postId, userId: usuarioAtual.id });
    });

    el.querySelector('[data-acao="repost"]').addEventListener('click', () => {
      socket.emit('repostar', { postId, userId: usuarioAtual.id });
    });

    const btnDeletar = el.querySelector('[data-acao="deletar"]');
    if (btnDeletar) {
      btnDeletar.addEventListener('click', () => {
        if (confirm('Deletar este post?')) {
          socket.emit('deletarPost', { postId, userId: usuarioAtual.id });
        }
      });
    }

    // abre/fecha a área de comentários
    el.querySelector('[data-acao="comentario"]').addEventListener('click', () => {
      el.querySelector('[data-comentarios]').classList.toggle('hidden');
    });

    // envia um novo comentário
    const form = el.querySelector('.form-comentario');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const texto = input.value.trim();
      if (!texto) return;
      socket.emit('comentar', { postId, userId: usuarioAtual.id, texto });
      input.value = '';
    });
  });
}

// ============================================================
// SOCKET.IO - EVENTOS RECEBIDOS DO SERVIDOR (TEMPO REAL)
// ============================================================
function configurarSocket() {

  // Um novo post (ou repost) foi criado por qualquer usuário -> insere no topo do feed
  socket.on('postCriado', (post) => {
    posts.unshift(post);
    postsExibidos++; // garante que o post novo apareça mesmo respeitando o "limite" do scroll
    if (usuarioAtual) renderizarFeed();

    // notificação de repost (a checagem de "é sobre meu post" acontece no evento 'notificacao')
  });

  // Um post foi atualizado (like ou comentário novo) -> substitui no cache e re-renderiza
  socket.on('postAtualizado', (postAtualizado) => {
    const idx = posts.findIndex((p) => p.id === postAtualizado.id);
    if (idx !== -1) posts[idx] = postAtualizado;
    if (usuarioAtual) renderizarFeed();
  });

  // Um usuário atualizou sua foto de perfil -> atualiza o cache e o feed e o perfil
  socket.on('usuarioAtualizado', ({ id, avatar, name, handle }) => {
    const idx = todosUsuarios.findIndex((u) => u.id === id);
    if (idx !== -1) {
      todosUsuarios[idx] = { ...todosUsuarios[idx], avatar, name, handle };
    }

    if (usuarioAtual && usuarioAtual.id === id) {
      usuarioAtual = { ...usuarioAtual, avatar, name, handle };
      headerAvatar.src = avatar;
      compositorAvatar.src = avatar;
      perfilAvatar.src = avatar;
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
      if (paginaAtual === 'perfil') abrirPerfil(usuarioAtual.id);
    }
  });

  // Nova mensagem privada -> atualiza o cache do cliente e re-renderiza conversa atual
  socket.on('mensagemCriada', (mensagem) => {
    mensagens.push(mensagem);
    if (usuarioAtual) {
      renderizarContatos();
      renderizarConversa();
    }
  });

  // Um post foi deletado -> remove do cache e re-renderiza
  socket.on('postDeletado', ({ postId }) => {
    posts = posts.filter((p) => p.id !== postId);
    if (usuarioAtual) renderizarFeed();
  });

  // Notificação simples (like, repost ou novo seguidor) -> mostra toast + guarda no histórico
  socket.on('notificacao', ({ paraUserId, mensagem }) => {
    if (usuarioAtual && paraUserId === usuarioAtual.id) {
      mostrarToast(mensagem);
      notificacoes.unshift({ mensagem, createdAt: Date.now(), lida: paginaAtual === 'notificacoes' });
      atualizarBadgeNotificacoes();
      if (paginaAtual === 'notificacoes') renderizarNotificacoes();
    }
  });

  // Alguém seguiu/deixou de seguir outra pessoa -> atualiza botões "Seguir" em tela e o perfil aberto
  socket.on('seguidorAtualizado', ({ userId, alvoId }) => {
    const usuario = todosUsuarios.find((u) => u.id === userId);
    if (usuario) {
      // mantém a lista local de "following" sincronizada (usada para desenhar os botões)
      fetch('/api/users').then((r) => r.json()).then((lista) => {
        todosUsuarios = lista;
        if (usuarioAtual) {
          renderizarSugestoes();
          if (paginaAtual === 'explorar') {
            renderizarBusca(inputBusca.value.trim().toLowerCase());
          }
          const perfilAtual = usuarioAtual.id;
          if (paginaAtual === 'perfil' && (userId === usuarioAtual.id || alvoId === usuarioAtual.id)) {
            abrirPerfil(document.getElementById('perfil-avatar').dataset.userId || perfilAtual);
          }
        }
      });
    }
  });
}

// ============================================================
// CRIAÇÃO DE POST (compositor no topo do feed)
// ============================================================
function configurarEventos() {

  // Contador de caracteres em tempo real + habilita/desabilita botão Postar
  inputPost.addEventListener('input', () => {
    const restante = 280 - inputPost.value.length;
    contadorCaracteres.textContent = restante;
    contadorCaracteres.classList.toggle('limite', restante <= 20);
    const temTexto = inputPost.value.trim().length > 0;
    const temMidia = Boolean(imagemSelecionada || videoSelecionado);
    btnPostar.disabled = (!temTexto && !temMidia) || restante < 0;
  });

  // Upload real de imagem: abre o seletor de arquivos do sistema operacional
  btnAddImagem.addEventListener('click', () => {
    btnAddImagemArquivo.click();
  });

  // Quando um arquivo é escolhido, converte para base64 (FileReader) e mostra o preview
  btnAddImagemArquivo.addEventListener('change', () => {
    const arquivo = btnAddImagemArquivo.files[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem.');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      imagemSelecionada = leitor.result; // string base64 (data:image/...;base64,...)
      previewImagem.src = imagemSelecionada;
      previewWrap.classList.remove('hidden');
      const temTexto = inputPost.value.trim().length > 0;
      const temMidia = Boolean(imagemSelecionada || videoSelecionado);
      btnPostar.disabled = (!temTexto && !temMidia);
    };
    leitor.readAsDataURL(arquivo);
  });

  btnRemoverImagem.addEventListener('click', () => {
    imagemSelecionada = null;
    previewWrap.classList.add('hidden');
    previewImagem.src = '';
    btnAddImagemArquivo.value = '';
    const temTexto = inputPost.value.trim().length > 0;
    const temMidia = Boolean(imagemSelecionada || videoSelecionado);
    btnPostar.disabled = (!temTexto && !temMidia);
  });

  btnAddVideo.addEventListener('click', () => {
    btnAddVideoArquivo.click();
  });

  btnAddVideoArquivo.addEventListener('change', () => {
    const arquivo = btnAddVideoArquivo.files[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('video/')) {
      alert('Por favor selecione um arquivo de vídeo.');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = () => {
      videoSelecionado = leitor.result;
      previewVideo.src = videoSelecionado;
      previewVideoWrap.classList.remove('hidden');
      const temTexto = inputPost.value.trim().length > 0;
      const temMidia = Boolean(imagemSelecionada || videoSelecionado);
      btnPostar.disabled = (!temTexto && !temMidia);
    };
    leitor.readAsDataURL(arquivo);
  });

  btnRemoverVideo.addEventListener('click', () => {
    videoSelecionado = null;
    previewVideoWrap.classList.add('hidden');
    previewVideo.src = '';
    btnAddVideoArquivo.value = '';
    const temTexto = inputPost.value.trim().length > 0;
    const temMidia = Boolean(imagemSelecionada || videoSelecionado);
    btnPostar.disabled = (!temTexto && !temMidia);
  });

  btnMudarAvatar.addEventListener('click', () => {
    inputAvatarArquivo.click();
  });

  inputAvatarArquivo.addEventListener('change', () => {
    const arquivo = inputAvatarArquivo.files[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith('image/')) {
      alert('Por favor selecione um arquivo de imagem para o perfil.');
      return;
    }

    const leitor = new FileReader();
    leitor.onload = async () => {
      const avatarBase64 = leitor.result;
      const resp = await fetch(`/api/users/${usuarioAtual.id}/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: avatarBase64 })
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        alert(data.error || 'Não foi possível atualizar a foto de perfil.');
        return;
      }

      const novoUsuario = await resp.json();
      usuarioAtual = { ...usuarioAtual, avatar: novoUsuario.avatar };

      const idx = todosUsuarios.findIndex((u) => u.id === usuarioAtual.id);
      if (idx !== -1) {
        todosUsuarios[idx] = { ...todosUsuarios[idx], avatar: novoUsuario.avatar };
      }

      headerAvatar.src = novoUsuario.avatar;
      compositorAvatar.src = novoUsuario.avatar;
      perfilAvatar.src = novoUsuario.avatar;

      if (paginaAtual === 'perfil') {
        abrirPerfil(usuarioAtual.id);
      }

      renderizarSugestoes();
      renderizarContatos();
      renderizarConversa();
      mostrarToast('Foto de perfil atualizada.');
    };

    leitor.readAsDataURL(arquivo);
  });

  // Envia o novo post via Socket.io (o servidor faz o broadcast para todos)
  btnPostar.addEventListener('click', () => {
    const texto = inputPost.value.trim();
    if (!usuarioAtual) return;
    if (!texto && !imagemSelecionada && !videoSelecionado) return;

    socket.emit('novoPost', {
      authorId: usuarioAtual.id,
      texto,
      imagem: imagemSelecionada,
      video: videoSelecionado
    });

    // limpa o compositor
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

  // Alterna entre tema claro/escuro e salva a preferência
  btnTema.addEventListener('click', alternarTema);

  // Logout
  btnSair.addEventListener('click', sair);

  btnMudarAvatar.classList.toggle('hidden', !usuarioAtual);

  // Cadastro de nova conta
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
    const password = inputLoginSenha.value.trim();

    if (!handle || !password) {
      mostrarErroLogin('Informe handle e senha.');
      return;
    }

    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle, password })
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      mostrarErroLogin(data.error || 'Não foi possível entrar.');
      return;
    }

    const usuario = todosUsuarios.find((u) => u.id === data.id);
    if (!usuario) {
      await carregarUsuarios();
    }

    const usuarioLogado = todosUsuarios.find((u) => u.id === data.id) || data;
    entrarComoUsuario(usuarioLogado);
    formLogin.reset();
    limparErroLogin();
  });

  formMensagem.addEventListener('submit', async (e) => {
    e.preventDefault();

    const texto = inputMensagem.value.trim();
    if (!texto || !usuarioAtual || !contatoMensagemAtual) return;

    const resp = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId: usuarioAtual.id,
        toId: contatoMensagemAtual,
        texto
      })
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      mostrarToast(data.error || 'Não foi possível enviar a mensagem.');
      return;
    }

    inputMensagem.value = '';
  });

  formCriarConta.addEventListener('submit', criarConta);

  // Navegação entre as páginas internas (Início, Explorar, Perfil, Notificações)
  navItens.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();

      if (item.dataset.pagina === 'perfil' && usuarioAtual) {
        perfilSelecionadoId = usuarioAtual.id;
      }

      irParaPagina(item.dataset.pagina);
    });
  });

  // Delegação de evento: clique no avatar ou nome de qualquer post leva ao perfil daquele autor
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-follow-id]')) {
      return;
    }

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
    }
  });

  // Busca em tempo real na página Explorar (filtra o cache local de posts)
  inputBusca.addEventListener('input', () => {
    renderizarBusca(inputBusca.value.trim().toLowerCase());
  });

  window.addEventListener('resize', () => {
    verificarDispositivo();
  });

  // Scroll infinito simulado: quando chegar perto do fim da página, revela mais posts do cache
  window.addEventListener('scroll', () => {
    if (!usuarioAtual) return;
    const pertoDoFim = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
    if (pertoDoFim && postsExibidos < posts.length) {
      carregandoMaisEl.classList.remove('hidden');
      setTimeout(() => {
        postsExibidos += 10;
        renderizarFeed();
      }, 500); // pequeno delay simulando carregamento
    }
  });
}

// ============================================================
// CRIAÇÃO DE CONTA
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
    password: inputSenhaCadastro.value.trim()
  };

  if (!payload.name || payload.name.length < 2) {
    alert('Informe um nome com pelo menos 2 caracteres.');
    return;
  }

  if (!payload.handle || payload.handle.length < 2) {
    alert('Informe um @handle válido.');
    return;
  }

  if (payload.password.length < 6) {
    alert('A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  if (payload.password !== inputConfirmarSenhaCadastro.value.trim()) {
    alert('As senhas informadas não conferem.');
    return;
  }

  const resp = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    alert(data.error || 'Não foi possível criar a conta.');
    return;
  }

  await carregarUsuarios();

  const novoUsuario = todosUsuarios.find((u) => u.id === data.id);
  if (novoUsuario) {
    entrarComoUsuario(novoUsuario);
  }

  fecharModalCadastro();
  mostrarToast('Conta criada com sucesso!');
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
// TEMA (DARK MODE) - persistido em localStorage
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
// SUGESTÕES DE USUÁRIOS (coluna direita)
// ============================================================
function renderizarSugestoes() {
  if (!usuarioAtual) return;

  const meuUsuario = todosUsuarios.find((u) => u.id === usuarioAtual.id);
  const outros = todosUsuarios.filter((u) => u.id !== usuarioAtual.id).slice(0, 3);

  sugestoesUsuariosEl.innerHTML = outros.map((u) => {
    const jaSegue = (meuUsuario?.following || []).includes(u.id);
    return `
      <div class="sugestao-usuario">
        <div class="sugestao-usuario-info">
          <img class="avatar avatar-sm" src="${u.avatar}" alt="${u.name}">
          <div>
            <div style="font-weight:700; font-size:14px;">${escaparHtml(u.name)}</div>
            <div style="color:var(--texto-secundario); font-size:13px;">${escaparHtml(u.handle)}</div>
          </div>
        </div>
        <button class="btn-seguir ${jaSegue ? 'seguindo' : ''}" data-follow-id="${u.id}">${jaSegue ? 'Deixar de seguir' : 'Seguir'}</button>
      </div>
    `;
  }).join('');

  sugestoesUsuariosEl.querySelectorAll('[data-follow-id]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const alvoId = botao.dataset.followId;
      socket.emit('seguir', { userId: usuarioAtual.id, alvoId });
    });
  });
}

function verificarDispositivo() {
  const width = window.innerWidth || document.documentElement.clientWidth;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const mobileAgent = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  mobile = width <= 680 || coarsePointer || mobileAgent;

  document.body.classList.toggle('mobile-view', mobile);

  if (mobile) {
    btnSair.classList.add('hidden');
  } else {
    btnSair.classList.remove('hidden');
  }
}

// ============================================================
// TOASTS DE NOTIFICAÇÃO
// ============================================================
function mostrarToast(mensagem) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = mensagem;
  toastContainer.appendChild(toast);

  // remove o elemento do DOM depois que a animação de saída terminar (~3s)
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// NAVEGAÇÃO ENTRE PÁGINAS (Início / Explorar / Perfil / Notificações)
// ============================================================
function irParaPagina(nome) {
  paginaAtual = nome;

  // mostra apenas a página escolhida
  Object.entries(paginas).forEach(([chave, el]) => el.classList.toggle('hidden', chave !== nome));

  // marca o item ativo na sidebar
  navItens.forEach((item) => item.classList.toggle('nav-ativo', item.dataset.pagina === nome));

  if (nome === 'perfil') {
    const perfilAOpen = perfilSelecionadoId || usuarioAtual?.id;
    if (perfilAOpen) abrirPerfil(perfilAOpen);
  }

  if (nome === 'videos') renderizarVideos();
  if (nome === 'explorar') renderizarBusca(inputBusca.value.trim().toLowerCase());
  if (nome === 'mensagens' && usuarioAtual) {
    carregarMensagens();
  }
  if (nome === 'notificacoes') {
    notificacoes.forEach((n) => (n.lida = true));
    atualizarBadgeNotificacoes();
    renderizarNotificacoes();
  }
}

// ============================================================
// PÁGINA: PERFIL (dados do usuário + posts dele)
// ============================================================
async function abrirPerfil(userId) {
  const usuario = todosUsuarios.find((u) => u.id === userId);
  if (!usuario) return;

  perfilAvatar.src = usuario.avatar;
  perfilAvatar.dataset.userId = usuario.id;
  perfilNome.textContent = usuario.name;
  perfilHandle.textContent = usuario.handle;
  perfilBio.textContent = usuario.bio || '';
  perfilSeguindo.textContent = (usuario.following || []).length;

  const seguidores = todosUsuarios.filter((u) => (u.following || []).includes(usuario.id)).length;
  perfilSeguidores.textContent = seguidores;

  const resp = await fetch(`/api/posts/usuario/${userId}`);
  const postsDoPerfil = await resp.json();
  perfilPostsQtd.textContent = postsDoPerfil.length;

  listaPostsPerfilEl.innerHTML = postsDoPerfil.length
    ? postsDoPerfil.map((p) => templatePost(p)).join('')
    : '<div class="notificacao-vazia">Nenhum post ainda.</div>';

  ligarEventosDosPostsEm(listaPostsPerfilEl);

  // se estamos vendo o perfil de outra pessoa, mostra o botão de Seguir dentro do cabeçalho
  const botaoExistente = document.getElementById('btn-seguir-perfil');
  if (botaoExistente) botaoExistente.remove();

  if (usuario.id !== usuarioAtual.id) {
    const meuUsuario = todosUsuarios.find((u) => u.id === usuarioAtual.id);
    const jaSegue = (meuUsuario.following || []).includes(usuario.id);

    const btn = document.createElement('button');
    btn.id = 'btn-seguir-perfil';
    btn.className = 'btn-seguir';
    btn.style.marginTop = '10px';
    btn.textContent = jaSegue ? 'Deixar de seguir' : 'Seguir';
    btn.addEventListener('click', () => {
      socket.emit('seguir', { userId: usuarioAtual.id, alvoId: usuario.id });
    });
    document.querySelector('.cabecalho-perfil').appendChild(btn);
  }
}

// ============================================================
// PÁGINA: VÍDEOS (feed só com postagens com vídeo)
// ============================================================
function renderizarVideos() {
  if (!usuarioAtual) return;

  const videos = posts.filter((p) => Boolean(p.video));

  listaVideosEl.innerHTML = videos.length
    ? videos.map((p) => templatePost(p)).join('')
    : '<div class="notificacao-vazia">Ainda não há vídeos publicados.</div>';

  ligarEventosDosPostsEm(listaVideosEl);
}

// ============================================================
// PÁGINA: EXPLORAR (busca por texto, nome ou @handle)
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

  const resultadosUsuarios = todosUsuarios.filter((u) => {
    return (u.name || '').toLowerCase().includes(busca) ||
      (u.handle || '').toLowerCase().includes(busca) ||
      (u.bio || '').toLowerCase().includes(busca);
  });

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
    botao.addEventListener('click', () => {
      const alvoId = botao.dataset.followId;
      if (!usuarioAtual) return;
      socket.emit('seguir', { userId: usuarioAtual.id, alvoId });
    });
  });
}

function templateUsuarioBusca(u) {
  if (!usuarioAtual) return '';

  const meuUsuario = todosUsuarios.find((x) => x.id === usuarioAtual.id);
  const jaSegue = (meuUsuario?.following || []).includes(u.id);

  return `<article class="resultado-pessoa" data-open-profile="${u.id}">
    <div class="resultado-pessoa-topo">
      <img class="avatar avatar-sm" src="${u.avatar}" alt="${escaparHtml(u.name)}" data-open-profile="${u.id}">
      <div class="resultado-pessoa-texto" data-open-profile="${u.id}">
        <div class="resultado-pessoa-nome">${escaparHtml(u.name)}</div>
        <div class="resultado-pessoa-handle">${escaparHtml(u.handle)}</div>
      </div>
      <button type="button" class="btn-seguir ${jaSegue ? 'seguindo' : ''}" data-follow-id="${u.id}">${jaSegue ? 'Deixar de seguir' : 'Seguir'}</button>
    </div>
    <div class="resultado-pessoa-bio" data-open-profile="${u.id}">${escaparHtml(u.bio || 'Novo membro do Tadashi.')}</div>
  </article>`;
}

// ============================================================
// PÁGINA: NOTIFICAÇÕES
// ============================================================
function renderizarNotificacoes() {
  listaNotificacoesEl.innerHTML = notificacoes.length
    ? notificacoes.map((n) => `
        <div class="notificacao-item">🔔 <span>${escaparHtml(n.mensagem)} · ${tempoRelativo(n.createdAt)}</span></div>
      `).join('')
    : '<div class="notificacao-vazia">Nenhuma notificação ainda.</div>';
}

function atualizarBadgeNotificacoes() {
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  badgeNotif.textContent = naoLidas;
  badgeNotif.classList.toggle('hidden', naoLidas === 0);
}

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================

// Converte um timestamp em texto relativo tipo "há 5 min", "há 2h", "há 3 dias"
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
  const data = new Date(timestamp);
  return data.toLocaleDateString('pt-BR');
}

// Escapa caracteres HTML para evitar injeção de código nos posts (segurança básica)
function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Atualiza o "tempo relativo" de todos os posts visíveis a cada 30s, sem precisar re-renderizar tudo
setInterval(() => {
  if (!usuarioAtual) return;
  document.querySelectorAll('.post').forEach((el) => {
    const post = posts.find((p) => p.id === el.dataset.id);
    if (!post) return;
    const tempoEl = el.querySelector('.post-tempo');
    if (tempoEl) tempoEl.textContent = `· ${tempoRelativo(post.createdAt)}`;
  });
}, 30000);
