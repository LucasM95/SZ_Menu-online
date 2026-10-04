import { useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { formatarMoeda } from '../utils';

export default function Cardapio({ categorias, produtos, onEscolher, onAlterarDados }) {
  // Esconde abas de categorias que não têm nenhum produto à venda
  const categoriasComProdutos = useMemo(
    () => categorias.filter((cat) => produtos.some((p) => p.categoriaId === cat.id)),
    [categorias, produtos]
  );

  const [categoriaAtiva, setCategoriaAtiva] = useState(() => categoriasComProdutos[0]?.id ?? null);
  const ativa = categoriasComProdutos.some((c) => c.id === categoriaAtiva)
    ? categoriaAtiva
    : categoriasComProdutos[0]?.id;

  const produtosFiltrados = produtos.filter((p) => p.categoriaId === ativa);

  return (
    <section>
      <button type="button" className="link-voltar" onClick={onAlterarDados}>
        <ArrowLeft size={16} aria-hidden="true" /> Alterar dados de entrega
      </button>

      {categoriasComProdutos.length === 0 ? (
        <div className="card card--estreito estado-carga">
          <p className="estado-carga__titulo">O cardápio está vazio no momento.</p>
          <p className="texto-suave">Volte mais tarde ou chame a gente no WhatsApp.</p>
        </div>
      ) : (
        <>
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

          <div className="grade-produtos">
            {produtosFiltrados.map((prod) => (
              <article key={prod.id} className="produto">
                <div>
                  <h3 className="produto__nome">{prod.nome}</h3>
                  {prod.descricao && <p className="produto__desc">{prod.descricao}</p>}
                </div>
                <div className="produto__rodape">
                  <span className="preco">{formatarMoeda(prod.preco)}</span>
                  <button
                    type="button"
                    className="btn-adicionar"
                    onClick={() => onEscolher(prod)}
                    aria-label={`Adicionar ${prod.nome}`}
                  >
                    <Plus size={16} aria-hidden="true" /> Adicionar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
