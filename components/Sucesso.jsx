import { CheckCircle, MessageCircle } from 'lucide-react';
import { CartaoAcompanhamento, pedidoFinalizado } from './PedidosEmCurso';

export default function Sucesso({ pedidoId, linkWhatsapp, acompanhamento, naMesa = false, semTelefone = false, onNovoPedido }) {
  // Mesa: quando a mesa é fechada no caixa (ou no app de fechamento), o cartão some
  const mesaFechada = naMesa && acompanhamento && pedidoFinalizado(acompanhamento);
  return (
    <section className="card card--estreito sucesso">
      <CheckCircle size={56} className="sucesso__icone" aria-hidden="true" />
      <h2 className="titulo-secao">Pedido registrado!</h2>
      <p className="sucesso__numero">Pedido nº {pedidoId}</p>

      {/* Acompanhamento ao vivo: atualiza sozinho enquanto a tela estiver aberta */}
      {naMesa && semTelefone ? (
        // Sem WhatsApp não há como acompanhar: o pedido já foi enviado para o caixa
        <p className="texto-suave">Seu pedido foi enviado para o caixa e chega na sua mesa em breve.</p>
      ) : mesaFechada ? (
        <p className="texto-suave">Mesa fechada. Obrigado pela visita!</p>
      ) : (
        <div className="sucesso__acomp">
          {acompanhamento ? (
            <CartaoAcompanhamento pedido={acompanhamento} comContato={false} />
          ) : (
            <p className="texto-suave">Buscando o andamento do seu pedido…</p>
          )}
          <p className="sucesso__dica">Esta tela atualiza sozinha. Pode deixar aberta para acompanhar.</p>
        </div>
      )}

      {linkWhatsapp ? (
        <>
          <p className="texto-suave">
            Caso queira entrar em contato, envie o resumo do pedido para a nossa loja pelo WhatsApp. A mensagem já vai pronta.
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
