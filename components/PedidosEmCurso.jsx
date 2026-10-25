import { useState } from 'react';
import { Ban, Bike, ChefHat, ChevronDown, Clock, MessageCircle, PartyPopper, Store, UtensilsCrossed } from 'lucide-react';
import { formatarMoeda, linkWhatsapp } from '../utils';

const PASSOS = {
  entrega: ['Recebido', 'Em preparo', 'Saiu para entrega', 'Entregue'],
  retirada: ['Recebido', 'Em preparo', 'Retirado'],
  mesa: [], // mesa: só mostra que a loja recebeu (sem etapas)
};

/**
 * Como cada status aparece para o cliente.
 * "Recebido" só depois que o PDV da loja puxou o pedido; antes disso, "Aguardando a loja".
 * pendente = a etapa atual ainda não aconteceu (barra apagada).
 */
function situacao(pedido) {
  const status = (pedido.status || '').trim().toLowerCase();
  const modo = pedido.modo || 'entrega';
  if (status === 'cancelado') return { titulo: 'Pedido cancelado', Icone: Ban, nivel: -1 };
  if (modo === 'mesa') {
    return pedido.recebido
      ? { titulo: `Pedido recebido · Mesa ${pedido.mesa ?? ''}`.trim(), Icone: UtensilsCrossed, nivel: 0 }
      : { titulo: 'Enviando para a loja…', Icone: Clock, nivel: 0, pendente: true };
  }
  const ultimo = PASSOS[modo].length - 1;
  if (status === 'baixado') {
    return modo === 'retirada'
      ? { titulo: 'Pedido retirado. Bom apetite!', Icone: PartyPopper, nivel: ultimo }
      : { titulo: 'Pedido entregue. Bom apetite!', Icone: PartyPopper, nivel: ultimo };
  }
  if (status === 'em rota de entrega' && modo === 'entrega') {
    return { titulo: 'Saiu para entrega', Icone: Bike, nivel: 2 };
  }
  if (!pedido.recebido) {
    return { titulo: 'Aguardando a loja', Icone: Clock, nivel: 0, pendente: true };
  }
  return {
    titulo: modo === 'retirada' ? 'Em preparo · retire no balcão' : 'Em preparo',
    Icone: modo === 'retirada' ? Store : ChefHat,
    nivel: 1,
  };
}

export const pedidoFinalizado = (p) => ['baixado', 'cancelado'].includes((p.status || '').trim().toLowerCase());

export function CartaoAcompanhamento({ pedido, comContato = true }) {
  const [aberto, setAberto] = useState(false);
  const { titulo, Icone, nivel, pendente } = situacao(pedido);
  const cancelado = nivel < 0;
  const passos = PASSOS[pedido.modo] || PASSOS.entrega;
  const contato = pedido.whatsappLoja
    ? linkWhatsapp(pedido.whatsappLoja, `Olá! Gostaria de saber sobre o meu pedido nº ${pedido.id}.`)
    : null;

  return (
    <div className={`acomp ${cancelado ? 'acomp--cancelado' : ''}`}>
      <div className="acomp__topo">
        <span className="acomp__icone" aria-hidden="true">
          <Icone size={22} />
        </span>
        <div className="acomp__titulo" aria-live="polite">
          <strong>{titulo}</strong>
          <span>
            Pedido nº {pedido.id} · {pedido.hora} · {formatarMoeda(pedido.total)}
          </span>
        </div>
      </div>

      {cancelado ? (
        <p className="acomp__aviso">A loja cancelou este pedido. Se tiver alguma dúvida, fale com a gente pelo WhatsApp.</p>
      ) : passos.length > 0 ? (
        <ol className="acomp__etapas" style={{ '--etapas': passos.length }} aria-label="Andamento do pedido">
          {passos.map((passo, i) => (
            <li
              key={passo}
              className={i < nivel ? 'feita' : i === nivel ? (pendente ? 'atual pendente' : 'feita atual') : ''}
            >
              {passo}
            </li>
          ))}
        </ol>
      ) : pendente ? (
        <p className="acomp__aviso">Assim que o caixa receber, seu pedido vai para a cozinha.</p>
      ) : (
        <p className="acomp__aviso">O caixa já recebeu. Seu pedido chega na mesa em breve.</p>
      )}

      {aberto && (
        <div className="acomp__detalhe">
          <ul>
            {pedido.itens.map((item, i) => (
              <li key={i}>
                {item.qtde}x {item.nome}
                {item.promocao && <em> ({item.promocao})</em>}
                {item.adicionais.length > 0 && <small> + {item.adicionais.join(', ')}</small>}
              </li>
            ))}
          </ul>
          <p>
            {pedido.desconto > 0 && <>Desconto: −{formatarMoeda(pedido.desconto)} · </>}
            {pedido.modo === 'entrega' || !pedido.modo ? <>Entrega: {formatarMoeda(pedido.taxaEntrega)} · </> : null}
            <strong>Total: {formatarMoeda(pedido.total)}</strong>
          </p>
          <p>
            Pagamento: {pedido.pagamentos.join(' + ') || '—'}
            {pedido.troco > 0 && ` · troco de ${formatarMoeda(pedido.troco)}`}
          </p>
        </div>
      )}

      <div className="acomp__acoes">
        <button type="button" className="acomp__btn" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          {aberto ? 'Esconder pedido' : 'Ver pedido'}
          <ChevronDown size={16} aria-hidden="true" className={aberto ? 'gira' : ''} />
        </button>
        {comContato && contato && (
          <a className="acomp__btn acomp__btn--wpp" href={contato} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> Falar com a loja
          </a>
        )}
      </div>
    </div>
  );
}

// Lista no topo da identificação e do cardápio: só pedidos ainda em curso
export default function PedidosEmCurso({ pedidos }) {
  const emCurso = (pedidos || []).filter((p) => !pedidoFinalizado(p));
  if (!emCurso.length) return null;
  return (
    <section className="acomp-lista" aria-label="Seus pedidos em andamento">
      <h2 className="acomp-lista__titulo">
        {emCurso.length === 1 ? 'Você tem um pedido em andamento' : `Você tem ${emCurso.length} pedidos em andamento`}
      </h2>
      <ul>
        {emCurso.map((p) => (
          <li key={p.id}>
            <CartaoAcompanhamento pedido={p} />
          </li>
        ))}
      </ul>
      <p className="acomp-lista__rodape">Pode fazer um novo pedido normalmente aqui embaixo.</p>
    </section>
  );
}
