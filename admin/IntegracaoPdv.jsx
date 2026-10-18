import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { consultarChaveIntegracao, gerarChaveIntegracao, situacaoIntegracao } from './adminApi';

// Verde: conversou há pouco. O PDV chama a nuvem a cada ~15 s quando está ligado.
function situacao(info) {
  if (!info.temChave) return { cor: 'cinza', texto: 'Sem chave: o PDV desta loja ainda não está integrado.' };
  if (info.minutosDesdeContato == null) return { cor: 'amarelo', texto: 'Chave gerada, mas o PDV ainda não se conectou.' };
  if (info.minutosDesdeContato <= 2) return { cor: 'verde', texto: 'PDV conectado e recebendo os pedidos do site.' };
  const m = info.minutosDesdeContato;
  const quando = m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `em ${info.ultimoContato}`;
  return { cor: 'vermelho', texto: `PDV sem conexão. Última vez ${quando}. Confira se o PDV está aberto e com internet.` };
}

export default function IntegracaoPdv({ token, onSessaoExpirada }) {
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState('');
  const [chave, setChave] = useState(''); // só é buscada quando o usuário pede
  const [mostrar, setMostrar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(() => {
    situacaoIntegracao(token)
      .then((r) => {
        setInfo(r);
        setErro('');
      })
      .catch((err) => (err.status === 401 ? onSessaoExpirada() : setErro(err.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Atualiza a situação a cada 30 s enquanto a aba está aberta
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  const gerar = async () => {
    const aviso = info?.temChave
      ? 'Gerar uma NOVA chave?\n\nA chave atual para de funcionar na hora: o PDV desta loja só volta a receber pedidos depois que você colar a nova chave nele.'
      : 'Gerar a chave de integração do PDV desta loja?';
    if (!window.confirm(aviso)) return;
    setGerando(true);
    setCopiado(false);
    try {
      const r = await gerarChaveIntegracao(token);
      setChave(r.chave);
      setMostrar(true);
      carregar();
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else setErro(err.message);
    } finally {
      setGerando(false);
    }
  };

  // Busca a chave guardada (criptografada) só quando o usuário pede para ver ou copiar
  const obterChave = async () => {
    if (chave) return chave;
    try {
      const r = await consultarChaveIntegracao(token);
      setChave(r.chave);
      return r.chave;
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else setErro(err.message);
      return '';
    }
  };

  const alternarMostrar = async () => {
    if (mostrar) {
      setMostrar(false);
      return;
    }
    if (await obterChave()) setMostrar(true);
  };

  const copiar = async () => {
    const valor = await obterChave();
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      // navegador sem permissão: mostra e seleciona para copiar com Ctrl+C
      setMostrar(true);
      setTimeout(() => {
        const campo = document.getElementById('chave-pdv');
        campo?.select();
        document.execCommand('copy');
      }, 0);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  if (!info) return erro ? <p className="adm-erro">{erro}</p> : null;
  const { cor, texto } = situacao(info);

  return (
    <section className="adm-integ">
      <div className="adm-integ__topo">
        <MonitorSmartphone size={20} aria-hidden="true" />
        <strong>Integração com o PDV (filial {info.filial})</strong>
        <button type="button" className="adm-btn adm-btn--icone" onClick={carregar} aria-label="Atualizar situação">
          <RefreshCw size={14} aria-hidden="true" />
        </button>
      </div>

      <p className={`adm-integ__status adm-integ__status--${cor}`} role="status">
        <span className="adm-integ__bolinha" aria-hidden="true" /> {texto}
      </p>
      {info.chaveCriadaEm && <p className="adm-suave">Chave atual gerada em {info.chaveCriadaEm}.</p>}

      {info.podeGerar && (info.podeConsultar || chave) && (
        <div className="adm-integ__chave">
          <label htmlFor="chave-pdv">Chave da loja</label>
          <div className="adm-integ__chave-linha">
            <input
              id="chave-pdv"
              readOnly
              type={mostrar ? 'text' : 'password'}
              value={mostrar ? chave : '●'.repeat(24)}
              onFocus={(e) => mostrar && e.target.select()}
            />
            <button
              type="button"
              className="adm-btn"
              onClick={alternarMostrar}
              aria-label={mostrar ? 'Ocultar chave' : 'Mostrar chave'}
            >
              {mostrar ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {mostrar ? 'Ocultar' : 'Mostrar'}
            </button>
            <button type="button" className="adm-btn adm-btn--primario" onClick={copiar}>
              {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copiado ? 'Copiada' : 'Copiar'}
            </button>
          </div>
          <p className="adm-dica">
            No PDV: Configurações › aba <strong>Cardápio Online</strong> › cole em <strong>Chave da Loja</strong>, clique em
            Testar Conexão e depois em Salvar. Não envie a chave por WhatsApp ou e-mail.
          </p>
        </div>
      )}

      {info.podeGerar && info.temChave && !info.podeConsultar && !chave && (
        <p className="adm-dica">
          A chave atual foi gerada antes da consulta existir e não pode ser exibida. Gere uma nova para poder consultá-la
          sempre (depois cole a nova no PDV).
        </p>
      )}

      {erro && <p className="adm-erro">{erro}</p>}

      {info.podeGerar ? (
        <button type="button" className="adm-btn" onClick={gerar} disabled={gerando}>
          <KeyRound size={16} aria-hidden="true" />
          {gerando ? 'Gerando…' : info.temChave ? 'Gerar nova chave' : 'Gerar chave'}
        </button>
      ) : (
        <p className="adm-dica">Só o administrador (tipo de acesso 1) pode gerar a chave.</p>
      )}
    </section>
  );
}
