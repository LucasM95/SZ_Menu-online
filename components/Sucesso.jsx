import { CheckCircle, MessageCircle } from 'lucide-react';

export default function Sucesso({ pedidoId, linkWhatsapp, onNovoPedido }) {
  return (
    <section className="card card--estreito sucesso">
      <CheckCircle size={56} className="sucesso__icone" aria-hidden="true" />
      <h2 className="titulo-secao">Pedido registrado!</h2>
      <p className="sucesso__numero">Pedido nº {pedidoId}</p>

      {linkWhatsapp ? (
        <>
          <p className="texto-suave">
            Para confirmar, envie o resumo do pedido para a nossa loja pelo WhatsApp. A mensagem já vai pronta.
          </p>
          <a className="btn-whatsapp" href={linkWhatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={20} aria-hidden="true" />
            Enviar pedido no WhatsApp
          </a>
        </>
      ) : (
        <p className="texto-suave">Já recebemos seu pedido e vamos começar o preparo.</p>
      )}

      <button type="button" className="btn-secundario" onClick={onNovoPedido}>
        Fazer outro pedido
      </button>
    </section>
  );
}
