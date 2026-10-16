import { ArrowLeft } from 'lucide-react';
import { formatarMoeda, totalItem } from '../utils';

export default function Revisao({
  cliente,
  carrinho,
  subtotal,
  taxaEntrega,
  total,
  descricaoPagamento,
  enviando,
  erro,
  onVoltar,
  onConfirmar,
}) {
  return (
    <section className="card card--medio">
      <div className="card__topo">
        <h2 className="titulo-secao">Confira antes de enviar</h2>
        <button type="button" className="link-voltar" onClick={onVoltar} disabled={enviando}>
          <ArrowLeft size={16} aria-hidden="true" /> Editar
        </button>
      </div>

      <div className="pilha">
        <div className="resumo-bloco">
          <h3 className="subtitulo">Entrega</h3>
          <p className="resumo-bloco__forte">{cliente.nome}</p>
          <p>{cliente.telefone}</p>
          <p>
            {cliente.ruaNumero}, {cliente.cidade}
          </p>
          {cliente.referencia && <p className="texto-suave">Referência: {cliente.referencia}</p>}
        </div>

        <div className="resumo-bloco">
          <h3 className="subtitulo">Itens</h3>
          <ul className="resumo-itens">
            {carrinho.map((item) => (
              <li key={item.cartItemId}>
                <div>
                  <span>
                    {item.quantidade}x {item.nome}
                  </span>
                  {item.adicionais.map((ad) => (
                    <small key={ad.id}>
                      + {ad.quantidade}x {ad.nome}
                    </small>
                  ))}
                  {item.observacao && <small>Obs.: {item.observacao}</small>}
                </div>
                <span className="resumo-itens__valor">{formatarMoeda(totalItem(item))}</span>
              </li>
            ))}
          </ul>
          <div className="totais totais--sem-fundo">
            <div className="totais__linha">
              <span>Subtotal</span>
              <span>{formatarMoeda(subtotal)}</span>
            </div>
            <div className="totais__linha">
              <span>Entrega</span>
              <span>{formatarMoeda(taxaEntrega)}</span>
            </div>
          </div>
        </div>

        <div className="resumo-bloco">
          <h3 className="subtitulo">Pagamento</h3>
          <p className="resumo-bloco__forte quebra-linha">{descricaoPagamento}</p>
        </div>

        <div className="total-destaque">
          <span>Total a pagar</span>
          <span>{formatarMoeda(total)}</span>
        </div>

        {erro && <p className="erro-inline" role="alert">{erro}</p>}

        <button type="button" className="btn-primario" onClick={onConfirmar} disabled={enviando}>
          {enviando ? 'Enviando pedido…' : 'Enviar pedido'}
        </button>
      </div>
    </section>
  );
}
