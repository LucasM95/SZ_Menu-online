import { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, Bike, CheckCheck, ChevronDown, Clock, MessageCircle, Printer, QrCode, RefreshCw, Search, Undo2, X } from 'lucide-react';
import { apenasDigitos, formatarMoeda, linkWhatsapp } from '../utils';
import { listarPedidos, mudarStatusPedido } from './adminApi';
import { imprimirComanda } from './comanda';
import LeitorQr from './LeitorQr';

const ATUALIZAR_A_CADA = 30000; // 30 segundos
const ATRASO_MINUTOS = 45;

const FILTROS = [
  { id: 'todos', nome: 'Todos', teste: () => true },
  { id: 'andamento', nome: 'Em andamento', teste: (p) => p.status !== 'Em rota de entrega' },
  { id: 'rota', nome: 'Em rota', teste: (p) => p.status === 'Em rota de entrega' },
];

// Bipe curto quando chega pedido novo (o navegador só toca som depois de um clique na página)
function bipe() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25].forEach((atraso) => {
      const osc = ctx.createOscillator();
      const volume = ctx.createGain();
      osc.frequency.value = 880;
      volume.gain.setValueAtTime(0.25, ctx.currentTime + atraso);
      volume.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + atraso + 0.2);
      osc.connect(volume).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.2);
    });
  } catch {
    /* sem som disponível */
  }
}

// Sem acento e minúsculo: "João" e "JOAO" viram "joao"
const normalizar = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function combinaComBusca(pedido, termo) {
  if (!termo) return true;
  const digitos = termo.replace(/\D/g, '');
  if (normalizar(pedido.cliente).includes(termo) || normalizar(pedido.endereco).includes(termo)) return true;
  // número do pedido ou telefone (só dígitos, para "(62)9..." e "629..." funcionarem igual)
  return digitos.length > 0 && (String(pedido.id).includes(digitos) || String(pedido.wpp || '').replace(/\D/g, '').includes(digitos));
}

function tempoDecorrido(minutos) {
  if (minutos == null) return '';
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const h = Math.floor(minutos / 60);
  return `há ${h}h${String(minutos % 60).padStart(2, '0')}`;
}

function linkCliente(pedido) {
  const digitos = apenasDigitos(pedido.wpp);
  if (digitos.length < 10) return null;
  const primeiroNome = (pedido.cliente || '').trim().split(' ')[0];
  const texto =
    pedido.status === 'Em rota de entrega'
      ? `Olá, ${primeiroNome}! Seu pedido nº ${pedido.id} do Sanduba do Zé saiu para entrega e logo chega aí. 🛵`
      : `Olá, ${primeiroNome}! Aqui é do Sanduba do Zé, sobre o seu pedido nº ${pedido.id}.`;
  return linkWhatsapp(`55${digitos}`, texto);
}

function CartaoPedido({ pedido, novo, ocupado, onStatus }) {
  const [aberto, setAberto] = useState(false);
  const emRota = pedido.status === 'Em rota de entrega';
  const atrasado = pedido.minutos != null && pedido.minutos >= ATRASO_MINUTOS;
  const wpp = linkCliente(pedido);

  const baixar = () => {
    if (window.confirm(`Baixar o pedido nº ${pedido.id}? Ele sai desta lista.`)) onStatus(pedido.id, 'Baixado');
  };

  const cancelar = () => {
    if (window.confirm(`CANCELAR o pedido nº ${pedido.id} de ${pedido.cliente}? Ele sai desta lista.`)) {
      onStatus(pedido.id, 'Cancelado');
    }
  };

  return (
    <li className={`adm-pedido ${novo ? 'adm-pedido--novo' : ''} ${emRota ? 'adm-pedido--rota' : ''}`}>
      <div className="adm-pedido__topo">
        <span className="adm-pedido__numero">#{pedido.id}</span>
        <span className={`adm-tag ${emRota ? 'adm-tag--rota' : 'adm-tag--andamento'}`}>{pedido.status}</span>
        {novo && <span className="adm-tag adm-tag--novo">Novo</span>}
        {pedido.hora && (
          <span className={`adm-pedido__tempo ${atrasado ? 'adm-pedido__tempo--atrasado' : ''}`}>
            <Clock size={14} aria-hidden="true" /> {pedido.hora}
            {pedido.minutos != null && ` · ${tempoDecorrido(pedido.minutos)}`}
          </span>
        )}
      </div>

      <div className="adm-pedido__cliente">
        <strong>{pedido.cliente}</strong>
        <span>{pedido.endereco}</span>
        {pedido.obs && <span className="adm-pedido__obs">{pedido.obs}</span>}
      </div>

      <div className="adm-pedido__resumo">
        <span className="adm-pedido__total">{formatarMoeda(pedido.total)}</span>
        <span className="adm-suave">
          {pedido.pagamentos.map((p) => p.descricao).join(' + ') || 'Pagamento não informado'}
          {pedido.troco > 0 && ` · troco de ${formatarMoeda(pedido.troco)}`}
        </span>
      </div>

      <button type="button" className="adm-pedido__expandir" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? 'Esconder itens' : `Ver itens (${pedido.itens.length})`}
        <ChevronDown size={16} aria-hidden="true" className={aberto ? 'gira' : ''} />
      </button>

      {aberto && (
        <div className="adm-pedido__detalhe">
          <ul className="adm-pedido__itens">
            {pedido.itens.map((item, i) => (
              <li key={i}>
                <div className="adm-pedido__item-linha">
                  <span>
                    <strong>{item.qtde}x</strong> {item.nome}
                    {item.promocao && <span className="adm-tag adm-tag--promo">{item.promocao}</span>}
                  </span>
                  <span>{formatarMoeda(item.total)}</span>
                </div>
                {item.adicionais.map((ad, j) => (
                  <div key={j} className="adm-pedido__sub">
                    + {ad.qtde}x {ad.nome} ({formatarMoeda(ad.total)})
                  </div>
                ))}
                {item.obs && !item.obs.startsWith('Promoção:') && <div className="adm-pedido__sub">Obs.: {item.obs}</div>}
                {item.obs.startsWith('Promoção:') && item.obs.includes(' | ') && (
                  <div className="adm-pedido__sub">Obs.: {item.obs.split(' | ').slice(1).join(' | ')}</div>
                )}
              </li>
            ))}
          </ul>

          <dl className="adm-pedido__contas">
            <div><dt>Produtos</dt><dd>{formatarMoeda(pedido.totalpedido)}</dd></div>
            {pedido.adicionais > 0 && <div><dt>Adicionais</dt><dd>{formatarMoeda(pedido.adicionais)}</dd></div>}
            {pedido.desconto > 0 && <div><dt>Desconto</dt><dd>− {formatarMoeda(pedido.desconto)}</dd></div>}
            <div><dt>Entrega</dt><dd>{formatarMoeda(pedido.taxaEntrega)}</dd></div>
            <div className="adm-pedido__contas-total"><dt>Total</dt><dd>{formatarMoeda(pedido.total)}</dd></div>
            {pedido.pagamentos.map((p, i) => (
              <div key={i}><dt>{p.descricao}</dt><dd>{formatarMoeda(p.valor)}</dd></div>
            ))}
            {pedido.troco > 0 && (
              <div className="adm-pedido__troco">
                <dt>Levar troco</dt>
                <dd>{formatarMoeda(pedido.troco)} (cliente paga com {formatarMoeda(pedido.pgtoCliente)})</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="adm-pedido__acoes">
        {wpp && (
          <a className="adm-btn adm-btn--wpp" href={wpp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> {emRota ? 'Avisar cliente' : 'Chamar cliente'}
          </a>
        )}
        {emRota ? (
          <button type="button" className="adm-btn" disabled={ocupado} onClick={() => onStatus(pedido.id, 'Em andamento')}>
            <Undo2 size={16} aria-hidden="true" /> Voltar
          </button>
        ) : (
          <button
            type="button"
            className="adm-btn adm-btn--rota"
            disabled={ocupado}
            onClick={() => onStatus(pedido.id, 'Em rota de entrega')}
          >
            <Bike size={16} aria-hidden="true" /> Saiu para entrega
          </button>
        )}
        <button type="button" className="adm-btn adm-btn--primario" disabled={ocupado} onClick={baixar}>
          <CheckCheck size={16} aria-hidden="true" /> Baixar
        </button>
      </div>

      <div className="adm-pedido__acoes-secundarias">
        <button type="button" className="adm-link" onClick={() => imprimirComanda(pedido)}>
          <Printer size={14} aria-hidden="true" /> Imprimir comanda
        </button>
        <button type="button" className="adm-link adm-link--perigo" disabled={ocupado} onClick={cancelar}>
          <Ban size={14} aria-hidden="true" /> Cancelar pedido
        </button>
      </div>
    </li>
  );
}

export default function Pedidos({ token, onSessaoExpirada }) {
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [ocupado, setOcupado] = useState(null);
  const [novos, setNovos] = useState(new Set());
  const conhecidos = useRef(null);
  // Guarda a função de sair numa ref para o intervalo não reiniciar a cada render
  const sairRef = useRef(onSessaoExpirada);
  sairRef.current = onSessaoExpirada;
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const [lendoQr, setLendoQr] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    try {
      const lista = await listarPedidos(token);
      const ids = new Set(lista.map((p) => p.id));
      if (conhecidos.current) {
        const chegaram = [...ids].filter((id) => !conhecidos.current.has(id));
        if (chegaram.length) {
          bipe();
          setNovos((n) => new Set([...n, ...chegaram]));
        }
      }
      conhecidos.current = ids;
      setPedidos(lista);
      setErro('');
      setAtualizadoEm(new Date());
    } catch (err) {
      if (err.status === 401) sairRef.current();
      else setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, [token]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, ATUALIZAR_A_CADA);
    return () => clearInterval(t);
  }, [carregar]);

  // Título da aba avisa quantos pedidos estão abertos
  useEffect(() => {
    document.title = `(${pedidos.length}) Pedidos · Sanduba do Zé`;
    return () => {
      document.title = 'Painel · Sanduba do Zé';
    };
  }, [pedidos.length]);

  const mudarStatus = async (id, status) => {
    setOcupado(id);
    try {
      await mudarStatusPedido(token, id, status);
      setNovos((n) => {
        const c = new Set(n);
        c.delete(id);
        return c;
      });
      setPedidos((lista) =>
        status === 'Baixado' || status === 'Cancelado'
          ? lista.filter((p) => p.id !== id)
          : lista.map((p) => (p.id === id ? { ...p, status } : p))
      );
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else window.alert(err.message);
    } finally {
      setOcupado(null);
    }
  };

  const termo = normalizar(busca.trim());
  const buscados = pedidos.filter((p) => combinaComBusca(p, termo));
  const visiveis = buscados.filter(FILTROS.find((f) => f.id === filtro).teste);

  return (
    <section>
      <div className="adm-pedidos__barra">
        <div className="adm-filtros" role="group" aria-label="Filtrar pedidos">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`adm-filtro ${filtro === f.id ? 'adm-filtro--ativo' : ''}`}
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
            >
              {f.nome} <span>{buscados.filter(f.teste).length}</span>
            </button>
          ))}
        </div>
        <div className="adm-pedidos__botoes">
          <button type="button" className="adm-btn adm-btn--rota" onClick={() => setLendoQr(true)}>
            <QrCode size={16} aria-hidden="true" /> Ler QR Code
          </button>
          <button type="button" className="adm-btn adm-btn--icone" onClick={carregar} aria-label="Atualizar agora">
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {lendoQr && (
        <LeitorQr
          token={token}
          onLido={carregar}
          onFechar={() => setLendoQr(false)}
          onSessaoExpirada={() => sairRef.current()}
        />
      )}
      <div className="adm-busca adm-busca--pedidos">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por cliente, nº do pedido, telefone ou endereço"
          aria-label="Buscar pedido"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button type="button" className="adm-busca__limpar" onClick={() => setBusca('')} aria-label="Limpar busca">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="adm-suave adm-explica">
        Atualiza sozinho a cada 30 segundos e apita quando chega pedido novo.
        {atualizadoEm && ` Última atualização: ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`}
      </p>

      {carregando && <p className="adm-suave">Carregando pedidos…</p>}
      {erro && <p className="adm-erro">{erro}</p>}
      {!carregando && !erro && visiveis.length === 0 && (
        <p className="adm-vazio">
          {termo ? `Nenhum pedido encontrado para "${busca.trim()}".` : 'Nenhum pedido aberto por aqui. 🎉'}
        </p>
      )}

      <ul className="adm-pedidos">
        {visiveis.map((p) => (
          <CartaoPedido key={p.id} pedido={p} novo={novos.has(p.id)} ocupado={ocupado === p.id} onStatus={mudarStatus} />
        ))}
      </ul>
    </section>
  );
}
