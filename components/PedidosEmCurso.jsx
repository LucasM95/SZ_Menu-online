import { useState } from 'react';
import { Ban, Bike, ChefHat, ChevronDown, MessageCircle, PartyPopper } from 'lucide-react';
import { formatarMoeda, linkWhatsapp } from '../utils';

const PASSOS = ['Recebido', 'Em preparo', 'Saiu para entrega', 'Entregue'];

// Como cada status aparece para o cliente
function situacao(status) {
  switch ((status || '').trim().toLowerCase()) {
    case 'em rota de entrega':
      return { titulo: 'Saiu para entrega', Icone: Bike, nivel: 2 };
    case 'baixado':
      return { titulo: 'Pedido entregue. Bom apetite!', Icone: PartyPopper, nivel: 3 };
    case 'cancelado':
      return { titulo: 'Pedido cancelado', Icone: Ban, nivel: -1 };
    default:
      return { titulo: 'Em preparo', Icone: ChefHat, nivel: 1 };
  }
}

export const pedidoFinalizado = (p) => ['baixado', 'cancelado'].includes((p.status || '').trim().toLowerCase());

export function CartaoAcompanhamento({ pedido, comContato = true }) {
  const [aberto, setAberto] = useState(false);
  const { titulo, Icone, nivel } = situacao(pedido.status);
  const cancelado = nivel < 0;
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
      ) : (
        <ol className="acomp__etapas" aria-label="Andamento do pedido">
          {PASSOS.map((passo, i) => (
            <li key={passo} className={i < nivel ? 'feita' : i === nivel ? 'feita atual' : ''}>
              {passo}
            </li>
          ))}
        </ol>
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
            Entrega: {formatarMoeda(pedido.taxaEntrega)} · <strong>Total: {formatarMoeda(pedido.total)}</strong>
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
