import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, EyeOff, ImageOff, LogOut, Pencil, Search, Trash2, Upload, X } from 'lucide-react';
import { carregarEmpresas } from '../api';
import { formatarMoeda, fotoUrl } from '../utils';
import {
  entrar,
  enviarFoto,
  lerSessao,
  listarProdutos,
  prepararImagem,
  removerFoto,
  salvarProduto,
  salvarSessao,
} from './adminApi';
import './admin.css';

// Nome do PDV em maiúsculas vira o texto sugerido: "X-TUDO" -> "X-tudo"
const sugestaoNome = (t) => (t && t === t.toUpperCase() ? t[0] + t.slice(1).toLowerCase() : t || '');

// ---------------------------------------------------------------- Login

function Login({ onEntrar }) {
  const [filiais, setFiliais] = useState([]);
  const [filial, setFilial] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    carregarEmpresas()
      .then((cidades) => {
        // Uma opção por filial, com as cidades que ela atende
        const mapa = new Map();
        cidades.forEach((c) => mapa.set(c.filial, [...(mapa.get(c.filial) || []), c.nome]));
        const lista = [...mapa.entries()].sort((a, b) => a[0] - b[0]).map(([f, nomes]) => ({ filial: f, nomes }));
        setFiliais(lista);
        if (lista.length === 1) setFilial(String(lista[0].filial));
      })
      .catch((e) => setErro(e.message));
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    if (!filial || !login.trim() || !senha) {
      setErro('Preencha a loja, o usuário e a senha.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      onEntrar(await entrar(Number(filial), login.trim(), senha));
    } catch (err) {
      setErro(err.message);
      setSenha('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="adm-login">
      <form className="adm-login__card" onSubmit={enviar} noValidate>
        <h1>Painel do cardápio</h1>
        <p className="adm-suave">Entre com o mesmo usuário e senha do PDV.</p>

        <label htmlFor="adm-filial">Loja</label>
        <select id="adm-filial" value={filial} onChange={(e) => setFilial(e.target.value)}>
          <option value="">Selecione…</option>
          {filiais.map((f) => (
            <option key={f.filial} value={f.filial}>
              Filial {f.filial}: {f.nomes.join(', ')}
            </option>
          ))}
        </select>

        <label htmlFor="adm-login">Usuário</label>
        <input id="adm-login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />

        <label htmlFor="adm-senha">Senha</label>
        <input
          id="adm-senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && <p className="adm-erro" role="alert">{erro}</p>}

        <button type="submit" className="adm-btn adm-btn--primario" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- Editor de um produto

function Editor({ produto, token, onSalvo, onFechar, onSessaoExpirada }) {
  const [form, setForm] = useState({
    nome: produto.nome,
    descricao: produto.descricao,
    secao: produto.secao,
    ordem: produto.ordem ?? '',
    visivel: produto.visivel,
  });
  const [foto, setFoto] = useState(produto.foto);
  const [status, setStatus] = useState({ tipo: '', texto: '' });
  const [ocupado, setOcupado] = useState(false);
  const arquivoRef = useRef(null);

  const campo = (nome) => (e) =>
    setForm((f) => ({ ...f, [nome]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const tratarErro = (err) => {
    if (err.status === 401) onSessaoExpirada();
    else setStatus({ tipo: 'erro', texto: err.message });
  };

  const salvar = async () => {
    setOcupado(true);
    setStatus({ tipo: '', texto: '' });
    try {
      const dados = { ...form, ordem: form.ordem === '' ? null : Number(form.ordem) };
      await salvarProduto(token, produto.codproduto, dados);
      onSalvo({ ...dados, foto });
      setStatus({ tipo: 'ok', texto: 'Salvo! Já aparece no cardápio.' });
    } catch (err) {
      tratarErro(err);
    } finally {
      setOcupado(false);
    }
  };

  const trocarFoto = async (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setOcupado(true);
    setStatus({ tipo: '', texto: 'Enviando foto…' });
    try {
      const imagem = await prepararImagem(arquivo);
      const r = await enviarFoto(token, produto.codproduto, imagem);
      setFoto(r.foto);
      onSalvo({ foto: r.foto });
      setStatus({ tipo: 'ok', texto: `Foto atualizada (${r.tamanhoKb} KB).` });
    } catch (err) {
      tratarErro(err);
    } finally {
      setOcupado(false);
    }
  };

  const tirarFoto = async () => {
    if (!window.confirm('Remover a foto deste produto?')) return;
    setOcupado(true);
    try {
      await removerFoto(token, produto.codproduto);
      setFoto(null);
      onSalvo({ foto: null });
      setStatus({ tipo: 'ok', texto: 'Foto removida.' });
    } catch (err) {
      tratarErro(err);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="adm-editor">
      <div className="adm-editor__foto">
        <div className="adm-foto adm-foto--grande">
          {fotoUrl(foto) ? <img src={fotoUrl(foto)} alt="" /> : <ImageOff size={28} aria-hidden="true" />}
        </div>
        <input ref={arquivoRef} type="file" accept="image/*" hidden onChange={trocarFoto} />
        <button type="button" className="adm-btn" onClick={() => arquivoRef.current?.click()} disabled={ocupado}>
          <Upload size={16} aria-hidden="true" /> {foto ? 'Trocar foto' : 'Enviar foto'}
        </button>
        {foto && (
          <button type="button" className="adm-btn adm-btn--perigo" onClick={tirarFoto} disabled={ocupado}>
            <Trash2 size={16} aria-hidden="true" /> Remover
          </button>
        )}
        <p className="adm-dica">Dica: PNG com fundo transparente fica mais bonito no fundo escuro do cardápio.</p>
      </div>

      <div className="adm-editor__campos">
        <label htmlFor={`n-${produto.codproduto}`}>Nome no site</label>
        <input
          id={`n-${produto.codproduto}`}
          value={form.nome}
          maxLength={150}
          placeholder={sugestaoNome(produto.nomePdv)}
          onChange={campo('nome')}
        />

        <label htmlFor={`d-${produto.codproduto}`}>Descrição (ingredientes)</label>
        <textarea
          id={`d-${produto.codproduto}`}
          rows={3}
          maxLength={500}
          value={form.descricao}
          placeholder="Ex.: Pão, hambúrguer 150g, cheddar, bacon e molho do Zé"
          onChange={campo('descricao')}
        />

        <div className="adm-linha">
          <div>
            <label htmlFor={`s-${produto.codproduto}`}>Seção</label>
            <input
              id={`s-${produto.codproduto}`}
              value={form.secao}
              maxLength={60}
              placeholder="Ex.: Artesanais"
              list="adm-secoes"
              onChange={campo('secao')}
            />
          </div>
          <div className="adm-linha__ordem">
            <label htmlFor={`o-${produto.codproduto}`}>Ordem</label>
            <input
              id={`o-${produto.codproduto}`}
              type="number"
              inputMode="numeric"
              min="0"
              value={form.ordem}
              onChange={campo('ordem')}
            />
          </div>
        </div>

        <label className="adm-check">
          <input type="checkbox" checked={form.visivel} onChange={campo('visivel')} />
          Mostrar no cardápio online
        </label>

        {status.texto && (
          <p className={status.tipo === 'erro' ? 'adm-erro' : 'adm-ok'} role="status">
            {status.texto}
          </p>
        )}

        <div className="adm-editor__acoes">
          <button type="button" className="adm-btn" onClick={onFechar} disabled={ocupado}>
            <X size={16} aria-hidden="true" /> Fechar
          </button>
          <button type="button" className="adm-btn adm-btn--primario" onClick={salvar} disabled={ocupado}>
            <Check size={16} aria-hidden="true" /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Lista de produtos

const FILTROS = [
  { id: 'todos', nome: 'Todos', teste: () => true },
  { id: 'semfoto', nome: 'Sem foto', teste: (p) => !p.foto && !p.adicional },
  { id: 'semdesc', nome: 'Sem descrição', teste: (p) => !p.descricao && !p.adicional },
  { id: 'escondidos', nome: 'Escondidos', teste: (p) => !p.visivel },
];

function Painel({ sessao, onSair }) {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [aberto, setAberto] = useState(null);

  const sessaoExpirada = () => onSair('Sua sessão expirou. Entre novamente.');

  useEffect(() => {
    listarProdutos(sessao.token)
      .then(setProdutos)
      .catch((err) => (err.status === 401 ? sessaoExpirada() : setErro(err.message)))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token]);

  const secoes = useMemo(() => [...new Set(produtos.map((p) => p.secao).filter(Boolean))].sort(), [produtos]);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const teste = FILTROS.find((f) => f.id === filtro).teste;
    const mapa = new Map();
    produtos
      .filter(teste)
      .filter((p) => !termo || `${p.nome} ${p.nomePdv} ${p.codproduto}`.toLowerCase().includes(termo))
      .forEach((p) => mapa.set(p.grupo, [...(mapa.get(p.grupo) || []), p]));
    return [...mapa.entries()];
  }, [produtos, busca, filtro]);

  const atualizar = (cod, mudancas) =>
    setProdutos((lista) => lista.map((p) => (p.codproduto === cod ? { ...p, ...mudancas } : p)));

  const contagem = (id) => produtos.filter(FILTROS.find((f) => f.id === id).teste).length;

  return (
    <div className="adm">
      <header className="adm-topo">
        <div>
          <strong>Painel do cardápio</strong>
          <span className="adm-suave">
            Filial {sessao.filial} · {sessao.nome}
          </span>
        </div>
        <button type="button" className="adm-btn" onClick={() => onSair('')}>
          <LogOut size={16} aria-hidden="true" /> Sair
        </button>
      </header>

      <main className="adm-conteudo">
        <div className="adm-barra">
          <div className="adm-busca">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nome ou código"
              aria-label="Buscar produto"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="adm-filtros" role="group" aria-label="Filtrar produtos">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`adm-filtro ${filtro === f.id ? 'adm-filtro--ativo' : ''}`}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.nome} <span>{contagem(f.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <datalist id="adm-secoes">
          {secoes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        {carregando && <p className="adm-suave">Carregando produtos…</p>}
        {erro && <p className="adm-erro">{erro}</p>}
        {!carregando && !erro && grupos.length === 0 && <p className="adm-suave">Nenhum produto encontrado.</p>}

        {grupos.map(([grupo, itens]) => (
          <section key={grupo} className="adm-grupo">
            <h2>{sugestaoNome(grupo)}</h2>
            <ul>
              {itens.map((p) => (
                <li key={p.codproduto} className={`adm-item ${aberto === p.codproduto ? 'adm-item--aberto' : ''}`}>
                  <button
                    type="button"
                    className="adm-item__resumo"
                    onClick={() => setAberto(aberto === p.codproduto ? null : p.codproduto)}
                    aria-expanded={aberto === p.codproduto}
                  >
                    <div className="adm-foto">
                      {fotoUrl(p.foto) ? (
                        <img src={fotoUrl(p.foto)} alt="" loading="lazy" />
                      ) : (
                        <ImageOff size={18} aria-hidden="true" />
                      )}
                    </div>
                    <div className="adm-item__texto">
                      <span className="adm-item__nome">{p.nome || sugestaoNome(p.nomePdv)}</span>
                      <span className="adm-suave">
                        #{p.codproduto} · {p.nomePdv}
                        {p.preco != null && ` · ${formatarMoeda(p.preco)}`}
                      </span>
                      <span className="adm-tags">
                        {!p.visivel && (
                          <span className="adm-tag adm-tag--cinza">
                            <EyeOff size={12} aria-hidden="true" /> Escondido
                          </span>
                        )}
                        {p.adicional && <span className="adm-tag">Adicional</span>}
                        {p.secao && <span className="adm-tag">{p.secao}</span>}
                        {!p.descricao && !p.adicional && <span className="adm-tag adm-tag--aviso">Sem descrição</span>}
                      </span>
                    </div>
                    <Pencil size={16} className="adm-item__icone" aria-hidden="true" />
                  </button>

                  {aberto === p.codproduto && (
                    <Editor
                      produto={p}
                      token={sessao.token}
                      onSalvo={(m) => atualizar(p.codproduto, m)}
                      onFechar={() => setAberto(null)}
                      onSessaoExpirada={sessaoExpirada}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Página

export default function Admin() {
  const [sessao, setSessao] = useState(lerSessao);
  const [aviso, setAviso] = useState('');

  // Página discreta: fora dos buscadores e com título próprio
  useEffect(() => {
    document.title = 'Painel · Sanduba do Zé';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const entrarNoPainel = (dados) => {
    salvarSessao(dados);
    setSessao(dados);
    setAviso('');
  };

  const sair = (mensagem) => {
    salvarSessao(null);
    setSessao(null);
    setAviso(mensagem);
  };

  if (!sessao) {
    return (
      <>
        {aviso && <p className="adm-aviso-topo">{aviso}</p>}
        <Login onEntrar={entrarNoPainel} />
      </>
    );
  }
  return <Painel sessao={sessao} onSair={sair} />;
}
