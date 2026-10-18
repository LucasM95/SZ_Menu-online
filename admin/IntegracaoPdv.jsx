import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, MonitorSmartphone, RefreshCw } from 'lucide-react';
import { gerarChaveIntegracao, situacaoIntegracao } from './adminApi';

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
  const [chaveNova, setChaveNova] = useState('');
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
      setChaveNova(r.chave);
      carregar();
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else setErro(err.message);
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(chaveNova);
    } catch {
      // navegador sem permissão: seleciona o texto para copiar com Ctrl+C
      document.getElementById('chave-pdv')?.select();
      document.execCommand('copy');
    }
    setCopiado(true);
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

      {chaveNova && (
        <div className="adm-integ__chave">
          <label htmlFor="chave-pdv">Chave da loja (copie agora: ela não será mostrada de novo)</label>
          <div className="adm-integ__chave-linha">
            <input id="chave-pdv" readOnly value={chaveNova} onFocus={(e) => e.target.select()} />
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
