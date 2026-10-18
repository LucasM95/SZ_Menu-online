import { useState } from 'react';
import { ArrowLeft, Check, Minus, Plus } from 'lucide-react';
import { formatarMoeda, mascaraMoeda, somaPagamentos, totalItem, validarPagamento } from '../utils';

export default function Checkout({
  carrinho,
  onAlterarQuantidade,
  onRemover,
  onObservacao,
  cidade,
  subtotal,
  taxaEntrega,
  total,
  tiposPagamento,
  pagamento,
  setPagamento,
  avisoExterno,
  lojaFechada = false,
  onVoltar,
  onRevisar,
}) {
  const [erro, setErro] = useState('');
  const tipoUnico = tiposPagamento.find((t) => t.id === pagamento.unicoId);
  const somaMultiplos = pagamento.multiplos ? somaPagamentos(pagamento, total) : 0;
  const diferenca = Math.round((total - somaMultiplos) * 100) / 100;

  const revisar = () => {
    if (lojaFechada) return;
    if (carrinho.length === 0) {
      setErro('Seu carrinho está vazio.');
      return;
    }
    const msg = validarPagamento(pagamento, tiposPagamento, total);
    if (msg) {
      setErro(msg);
      return;
    }
    setErro('');
    onRevisar();
  };

  const mensagem = erro || avisoExterno;

  return (
    <section className="card card--medio">
      <div className="card__topo">
        <h2 className="titulo-secao">Seu pedido</h2>
        <button type="button" className="link-voltar" onClick={onVoltar}>
          <ArrowLeft size={16} aria-hidden="true" /> Cardápio
        </button>
      </div>

      {carrinho.length === 0 ? (
        <div className="estado-carga">
          <p className="estado-carga__titulo">Seu carrinho está vazio.</p>
          <button type="button" className="btn-primario" onClick={onVoltar}>
            Escolher no cardápio
          </button>
        </div>
      ) : (
        <div className="pilha">
          <ul className="carrinho-lista">
            {carrinho.map((item) => (
              <li key={item.cartItemId} className="carrinho-item">
                <div className="carrinho-item__topo">
                  <span className="carrinho-item__nome">
                    {item.promocaoId && <span className="tag-promo">Promoção</span>}
                    {item.nome}
                  </span>
                  <span className="preco">{formatarMoeda(totalItem(item))}</span>
                </div>

                {item.itensPromocao && (
                  <ul className="carrinho-item__adicionais carrinho-item__adicionais--promo">
                    {item.itensPromocao.map((i) => (
                      <li key={i.nome}>
                        {i.qtde * item.quantidade}x {i.nome}
                      </li>
                    ))}
                  </ul>
                )}

                {item.adicionais.length > 0 && (
                  <ul className="carrinho-item__adicionais">
                    {item.adicionais.map((ad) => (
                      <li key={ad.id}>
                        + {ad.quantidade}x {ad.nome} ({formatarMoeda(ad.preco * ad.quantidade)})
                      </li>
                    ))}
                  </ul>
                )}

                <div className="carrinho-item__acoes">
                  <div className="qtd">
                    <button type="button" onClick={() => onAlterarQuantidade(item.cartItemId, -1)} aria-label={`Diminuir ${item.nome}`}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span>{item.quantidade}</span>
                    <button type="button" onClick={() => onAlterarQuantidade(item.cartItemId, 1)} aria-label={`Aumentar ${item.nome}`}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" className="btn-remover" onClick={() => onRemover(item.cartItemId)}>
                    Remover
                  </button>
                </div>

                <input
                  className="input input--pequeno"
                  type="text"
                  placeholder="Observação (ex.: sem cebola)"
                  aria-label={`Observação para ${item.nome}`}
                  maxLength={500}
                  value={item.observacao}
                  onChange={(e) => onObservacao(item.cartItemId, e.target.value)}
                />
              </li>
            ))}
          </ul>

          <div className="totais">
            <div className="totais__linha">
              <span>Subtotal</span>
              <span>{formatarMoeda(subtotal)}</span>
            </div>
            <div className="totais__linha">
              <span>Entrega ({cidade})</span>
              <span>{formatarMoeda(taxaEntrega)}</span>
            </div>
            <div className="totais__linha totais__linha--geral">
              <span>Total</span>
              <span>{formatarMoeda(total)}</span>
            </div>
          </div>

          <div>
            <div className="pagamento-topo">
              <h3 className="subtitulo">Pagamento</h3>
              <label className="check-multiplos">
                <input
                  type="checkbox"
                  checked={pagamento.multiplos}
                  onChange={(e) => setPagamento({ multiplos: e.target.checked, unicoId: null, trocoPara: '', valores: {} })}
                />
                Dividir em mais de uma forma
              </label>
            </div>

            {tiposPagamento.length === 0 ? (
              <p className="erro-inline">
                Nenhuma forma de pagamento disponível no momento. Fale com a gente pelo WhatsApp.
              </p>
            ) : !pagamento.multiplos ? (
              <>
                <div className="opcoes-pgto">
                  {tiposPagamento.map((tp) => {
                    const ativo = pagamento.unicoId === tp.id;
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        className={`opcao-pgto ${ativo ? 'opcao-pgto--ativa' : ''}`}
                        aria-pressed={ativo}
                        onClick={() =>
                          setPagamento((p) => ({ ...p, unicoId: tp.id, trocoPara: tp.dinheiro ? p.trocoPara : '' }))
                        }
                      >
                        {ativo && <Check size={16} aria-hidden="true" />}
                        {tp.descricao}
                      </button>
                    );
                  })}
                </div>

                {tipoUnico?.dinheiro && (
                  <div className="bloco-troco">
                    <label className="campo__rotulo" htmlFor="troco">
                      Troco para quanto? <span className="campo__opcional">(deixe em branco se não precisar)</span>
                    </label>
                    <div className="campo-moeda">
                      <span>R$</span>
                      <input
                        id="troco"
                        className="input"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={pagamento.trocoPara}
                        onChange={(e) => setPagamento((p) => ({ ...p, trocoPara: mascaraMoeda(e.target.value) }))}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="multiplos">
                {tiposPagamento.map((tp) => (
                  <div key={tp.id} className="multiplos__linha">
                    <label htmlFor={`pgto-${tp.id}`}>{tp.descricao}</label>
                    <div className="campo-moeda campo-moeda--compacto">
                      <span>R$</span>
                      <input
                        id={`pgto-${tp.id}`}
                        className="input input--pequeno"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={pagamento.valores[tp.id] || ''}
                        onChange={(e) =>
                          setPagamento((p) => ({
                            ...p,
                            valores: { ...p.valores, [tp.id]: mascaraMoeda(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
                <p className={`status-soma ${Math.abs(diferenca) < 0.01 ? 'status-soma--ok' : ''}`}>
                  {Math.abs(diferenca) < 0.01
                    ? 'Valores conferem com o total.'
                    : diferenca > 0
                      ? `Faltam ${formatarMoeda(diferenca)}`
                      : `Passou ${formatarMoeda(-diferenca)} do total`}
                </p>
              </div>
            )}
          </div>

          {mensagem && <p className="erro-inline" role="alert">{mensagem}</p>}

          <button type="button" className="btn-primario" onClick={revisar} disabled={lojaFechada}>
            {lojaFechada ? 'Loja fechada no momento' : 'Revisar pedido'}
          </button>
        </div>
      )}
    </section>
  );
}
