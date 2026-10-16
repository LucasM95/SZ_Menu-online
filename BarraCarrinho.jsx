import { ShoppingBag } from 'lucide-react';
import { formatarMoeda } from '../utils';

export default function BarraCarrinho({ quantidade, subtotal, onAbrir }) {
  return (
    <div className="barra-carrinho">
      <button type="button" className="barra-carrinho__btn" onClick={onAbrir}>
        <span className="barra-carrinho__qtd">
          <ShoppingBag size={18} aria-hidden="true" />
          {quantidade} {quantidade === 1 ? 'item' : 'itens'}
        </span>
        <span>Ver carrinho</span>
        <span className="barra-carrinho__valor">{formatarMoeda(subtotal)}</span>
      </button>
    </div>
  );
}
