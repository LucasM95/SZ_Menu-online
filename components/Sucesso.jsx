import { CheckCircle } from 'lucide-react';

export default function Sucesso({ pedidoId, onNovoPedido }) {
  return (
    <section className="card card--estreito sucesso">
      <CheckCircle size={56} className="sucesso__icone" aria-hidden="true" />
      <h2 className="titulo-secao">Pedido enviado!</h2>
      <p className="sucesso__numero">Pedido nº {pedidoId}</p>
      <p className="texto-suave">Já recebemos seu pedido e vamos começar o preparo. Qualquer dúvida, é só chamar no WhatsApp.</p>
      <button type="button" className="btn-primario" onClick={onNovoPedido}>
        Fazer outro pedido
      </button>
    </section>
  );
}
