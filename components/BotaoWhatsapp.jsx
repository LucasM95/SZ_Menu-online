import { MessageCircle } from 'lucide-react';
import { linkWhatsapp } from '../utils';

// Botão flutuante para falar com a loja da cidade escolhida.
// O "key" com o nome da cidade (no App) faz a animação de entrada
// repetir quando o cliente troca de cidade.
export default function BotaoWhatsapp({ numero, cidade, acimaDaBarra }) {
  const mensagem = 'Olá! Vim pelo cardápio online e queria tirar uma dúvida.';

  return (
    <a
      className={`whatsapp-flutuante ${acimaDaBarra ? 'whatsapp-flutuante--acima-barra' : ''}`}
      href={linkWhatsapp(numero, mensagem)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Falar com a loja de ${cidade} no WhatsApp`}
      title={`Falar com a loja de ${cidade}`}
    >
      <MessageCircle size={28} aria-hidden="true" />
      <span className="whatsapp-flutuante__texto">Fale com a loja de {cidade}</span>
    </a>
  );
}
