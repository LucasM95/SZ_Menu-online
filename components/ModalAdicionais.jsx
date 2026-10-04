import { useEffect, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { arredondar, formatarMoeda } from '../utils';

function Contador({ valor, min = 0, onMudar, rotulo }) {
  return (
    <div className="qtd">
      <button type="button" onClick={() => onMudar(Math.max(min, valor - 1))} aria-label={`Diminuir ${rotulo}`} disabled={valor <= min}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span aria-live="polite">{valor}</span>
      <button type="button" onClick={() => onMudar(valor + 1)} aria-label={`Aumentar ${rotulo}`}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ModalAdicionais({ produto, adicionais, onFechar, onConfirmar }) {
  const [selecionados, setSelecionados] = useState({});
  const [observacao, setObservacao] = useState('');
  const [quantidade, setQuantidade] = useState(1);

  // Fecha com Esc e impede a página de rolar por trás do modal
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [onFechar]);

  const escolhidos = adicionais
    .filter((ad) => (selecionados[ad.id] || 0) > 0)
    .map((ad) => ({ id: ad.id, nome: ad.nome, preco: ad.preco, quantidade: selecionados[ad.id] }));

  const precoUnit = produto.preco + escolhidos.reduce((acc, ad) => acc + ad.preco * ad.quantidade, 0);
  const totalModal = arredondar(precoUnit * quantidade);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <div className="modal__topo">
          <div>
            <h3 id="modal-titulo" className="modal__titulo">{produto.nome}</h3>
            <p className="texto-suave">{formatarMoeda(produto.preco)}</p>
          </div>
          <button type="button" className="btn-fechar" onClick={onFechar} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <h4 className="subtitulo">Adicionais</h4>
        <ul className="adicionais-lista">
          {adicionais.map((ad) => (
            <li key={ad.id} className="adicional">
              <div>
                <span className="adicional__nome">{ad.nome}</span>
                <span className="adicional__preco">+ {formatarMoeda(ad.preco)}</span>
              </div>
              <Contador
                valor={selecionados[ad.id] || 0}
                rotulo={ad.nome}
                onMudar={(v) => setSelecionados((prev) => ({ ...prev, [ad.id]: v }))}
              />
            </li>
          ))}
        </ul>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="obs-item">Alguma observação?</label>
          <input
            id="obs-item"
            className="input"
            type="text"
            placeholder="Ex.: sem cebola, carne bem passada"
            maxLength={500}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        <div className="modal__rodape">
          <Contador valor={quantidade} min={1} rotulo="quantidade" onMudar={setQuantidade} />
          <button
            type="button"
            className="btn-primario modal__confirmar"
            onClick={() => onConfirmar({ quantidade, adicionais: escolhidos, observacao: observacao.trim() })}
          >
            Adicionar {formatarMoeda(totalModal)}
          </button>
        </div>
      </div>
    </div>
  );
}
