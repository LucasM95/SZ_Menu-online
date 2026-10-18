import { useMemo, useState } from 'react';
import { ArrowLeft, Clock, Plus } from 'lucide-react';
import { formatarMoeda, fotoUrl } from '../utils';
import Promocoes from './Promocoes';

// "Abre hoje às 18:00" -> "Abre hoje às 18:00."
const frase = (t) => (t && !/[.!?]$/.test(t) ? `${t}.` : t);

// Agrupa os produtos de uma categoria pelas seções (Artesanais, Tradicionais...),
// mantendo a ordem. Itens sem seção vão para "Outros" quando há outras seções.
function agruparPorSecao(produtos) {
  const grupos = [];
  produtos.forEach((p) => {
    const nome = p.secao || '';
    let grupo = grupos.find((g) => g.nome === nome);
    if (!grupo) {
      grupo = { nome, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(p);
  });
  const temSecoes = grupos.some((g) => g.nome);
  return grupos.map((g) => ({ ...g, nome: g.nome || (temSecoes ? 'Outros' : '') }));
}

function CardProduto({ produto, onEscolher, fechado }) {
  const foto = fotoUrl(produto.foto);
  return (
    <article className={`produto ${foto ? 'produto--com-foto' : ''}`}>
      {foto && (
        <div className="produto__foto">
          <img src={foto} alt="" loading="lazy" decoding="async" width="600" height="600" />
        </div>
      )}
      <div className="produto__info">
        <h4 className="produto__nome">{produto.nome}</h4>
        {produto.descricao && <p className="produto__desc">{produto.descricao}</p>}
        <div className="produto__rodape">
          <span className="preco">{formatarMoeda(produto.preco)}</span>
          <button
            type="button"
            className="btn-adicionar"
            onClick={() => onEscolher(produto)}
            disabled={fechado}
            aria-label={`Adicionar ${produto.nome}`}
          >
            <Plus size={16} aria-hidden="true" />
            <span className="btn-adicionar__texto">Adicionar</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ItemLista({ produto, onEscolher, fechado }) {
  return (
    <li className="item-lista">
      <div className="item-lista__texto">
        <span className="item-lista__nome">{produto.nome}</span>
        {produto.descricao && <span className="item-lista__desc">{produto.descricao}</span>}
      </div>
      <span className="preco">{formatarMoeda(produto.preco)}</span>
      <button
        type="button"
        className="btn-mais"
        onClick={() => onEscolher(produto)}
        disabled={fechado}
        aria-label={`Adicionar ${produto.nome}`}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function Cardapio({ categorias, produtos, promocoes, loja, onEscolher, onEscolherPromocao, onAlterarDados }) {
  const fechado = Boolean(loja && !loja.aberta);
  // Esconde abas de categorias sem nenhum produto à venda
  const categoriasComProdutos = useMemo(
    () => categorias.filter((cat) => produtos.some((p) => p.categoriaId === cat.id)),
    [categorias, produtos]
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState(() => categoriasComProdutos[0]?.id ?? null);
  const ativa = categoriasComProdutos.some((c) => c.id === categoriaAtiva)
    ? categoriaAtiva
    : categoriasComProdutos[0]?.id;

  const secoes = useMemo(
    () => agruparPorSecao(produtos.filter((p) => p.categoriaId === ativa)),
    [produtos, ativa]
  );

  return (
    <section>
      <button type="button" className="link-voltar" onClick={onAlterarDados}>
        <ArrowLeft size={16} aria-hidden="true" /> Alterar dados de entrega
      </button>

      {categoriasComProdutos.length === 0 ? (
        <div className="card card--estreito estado-carga">
          <p className="estado-carga__titulo">O cardápio online desta loja ainda não está disponível.</p>
          <p className="texto-suave">Fale com a gente pelo WhatsApp para fazer seu pedido.</p>
        </div>
      ) : (
        <>
          {fechado && (
            <div className="aviso-fechado" role="status">
              <Clock size={24} aria-hidden="true" />
              <div>
                <strong>Fora do horário de atendimento</strong>
                <p>{frase(loja.mensagem) || 'Volte mais tarde para fazer seu pedido.'} Você pode olhar o cardápio à vontade.</p>
                {loja.horarios.length > 0 && (
                  <ul>
                    {loja.horarios.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <Promocoes promocoes={promocoes} onEscolher={onEscolherPromocao} fechado={fechado} />

          <nav className="categorias" aria-label="Categorias">
            {categoriasComProdutos.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`categoria-btn ${ativa === cat.id ? 'categoria-btn--ativa' : ''}`}
                aria-pressed={ativa === cat.id}
                onClick={() => setCategoriaAtiva(cat.id)}
              >
                {cat.nome}
              </button>
            ))}
          </nav>

          {secoes.map((secao) => {
            // Seção com alguma foto vira grade de cards; sem fotos, lista compacta
            const comFotos = secao.itens.some((p) => p.foto);
            return (
              <div key={secao.nome || 'geral'} className="secao">
                {secao.nome && <h3 className="secao__titulo">{secao.nome}</h3>}
                {comFotos ? (
                  <div className="grade-produtos">
                    {secao.itens.map((p) => (
                      <CardProduto key={p.id} produto={p} onEscolher={onEscolher} fechado={fechado} />
                    ))}
                  </div>
                ) : (
                  <ul className="lista-compacta">
                    {secao.itens.map((p) => (
                      <ItemLista key={p.id} produto={p} onEscolher={onEscolher} fechado={fechado} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
