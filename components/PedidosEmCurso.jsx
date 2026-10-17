import { useState } from 'react';
import { Bike, ChevronDown, ChefHat, MessageCircle } from 'lucide-react';
import { formatarMoeda, linkWhatsapp } from '../utils';

const ETAPAS = [
  { status: 'Em andamento', nome: 'Em preparo', Icone: ChefHat },
  { status: 'Em rota de entrega', nome: 'Saiu para entrega', Icone: Bike },
];

const PASSOS = ['Recebido', 'Em preparo', 'Saiu para entrega', 'Entregue'];

function Pedido({ pedido }) {
  const [aberto, setAberto] = useState(false);
  const emRota = pedido.status === 'Em rota de entrega';
  const { Icone, nome } = ETAPAS[emRota ? 1 : 0];
  const nivel = emRota ? 2 : 1; // posição atual em PASSOS
  const contato = pedido.whatsappLoja
    ? linkWhatsapp(pedido.whatsappLoja, `Olá! Gostaria de saber sobre o meu pedido nº ${pedido.id}.`)
    : null;

  return (
    <li className="acomp">
      <div className="acomp__topo">
        <span className="acomp__icone" aria-hidden="true">
          <Icone size={22} />
        </span>
        <div className="acomp__titulo">
          <strong>{nome}</strong>
          <span>
            Pedido nº {pedido.id} · {pedido.hora} · {formatarMoeda(pedido.total)}
          </span>
        </div>
      </div>

      <ol className="acomp__etapas" aria-label="Andamento do pedido">
        {PASSOS.map((passo, i) => (
          <li key={passo} className={i < nivel ? 'feita' : i === nivel ? 'feita atual' : ''}>
            {passo}
          </li>
        ))}
      </ol>

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
        {contato && (
          <a className="acomp__btn acomp__btn--wpp" href={contato} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden="true" /> Falar com a loja
          </a>
        )}
      </div>
    </li>
  );
}

export default function PedidosEmCurso({ pedidos }) {
  if (!pedidos?.length) return null;
  return (
    <section className="acomp-lista" aria-label="Seus pedidos em andamento">
      <h2 className="acomp-lista__titulo">
        {pedidos.length === 1 ? 'Você tem um pedido em andamento' : `Você tem ${pedidos.length} pedidos em andamento`}
      </h2>
      <ul>
        {pedidos.map((p) => (
          <Pedido key={p.id} pedido={p} />
        ))}
      </ul>
      <p className="acomp-lista__rodape">Pode fazer um novo pedido normalmente aqui embaixo.</p>
    </section>
  );
}
