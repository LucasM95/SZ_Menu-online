import { Flame, Plus } from 'lucide-react';
import { formatarMoeda, fotoUrl } from '../utils';

function resumoItens(itens) {
  return itens.map((i) => `${i.qtde}x ${i.nome}`).join(' + ');
}

export default function Promocoes({ promocoes, onEscolher }) {
  if (!promocoes?.length) return null;

  return (
    <section className="promocoes" aria-labelledby="titulo-promocoes">
      <h2 id="titulo-promocoes" className="promocoes__titulo">
        <Flame size={22} aria-hidden="true" /> Promoções
      </h2>

      <div className="promocoes__faixa">
        {promocoes.map((promo) => {
          const foto = fotoUrl(promo.foto);
          return (
            <article key={promo.id} className="promo">
              <div className="promo__foto">
                {foto && <img src={foto} alt="" loading="lazy" decoding="async" width="600" height="600" />}
                {promo.descontoPercentual > 0 && (
                  <span className="promo__selo">-{promo.descontoPercentual}%</span>
                )}
              </div>

              <div className="promo__corpo">
                <h3 className="promo__nome">{promo.nome}</h3>
                <p className="promo__itens">{promo.descricao || resumoItens(promo.itens)}</p>

                {promo.validade.length > 0 && (
                  <ul className="promo__validade">
                    {promo.validade.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                )}

                <div className="promo__precos">
                  <span className="promo__de">
                    de <s>{formatarMoeda(promo.precoDe)}</s>
                  </span>
                  <span className="promo__por">
                    <small>por</small> {formatarMoeda(promo.precoPor)}
                  </span>
                </div>

                <button
                  type="button"
                  className="promo__btn"
                  onClick={() => onEscolher(promo)}
                  aria-label={`Adicionar promoção ${promo.nome}`}
                >
                  <Plus size={18} aria-hidden="true" /> Quero essa
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
