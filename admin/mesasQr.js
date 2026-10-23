import QRCode from 'qrcode';

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Link que o QR da mesa abre: o site já entra com a cidade e a mesa escolhidas. */
// Endereço público do site. Defina VITE_SITE_URL na Vercel (https://sandubadoze.com.br) para o QR
// sempre apontar para o domínio oficial, mesmo se o painel for aberto por outro endereço.
const SITE = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, '');

export function linkDaMesa(cidade, mesa) {
  return `${SITE}/?cidade=${encodeURIComponent(cidade)}&mesa=${mesa}`;
}

/** Abre uma página A4 com os QR Codes das mesas (6 por folha) para imprimir e colocar nas mesas. */
export async function imprimirQrMesas(cidade, qtdMesas) {
  // A janela é aberta antes de gerar os QR para o navegador não bloquear como pop-up
  const janela = window.open('', '_blank', 'width=900,height=700');
  if (!janela) {
    window.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
    return;
  }
  janela.document.write('<p style="font-family:Arial;padding:20px">Gerando os QR Codes…</p>');

  const cartoes = [];
  for (let mesa = 1; mesa <= qtdMesas; mesa += 1) {
    // Correção de erro alta: continua lendo mesmo com o papel um pouco sujo ou amassado
    const qr = await QRCode.toDataURL(linkDaMesa(cidade, mesa), { margin: 1, width: 420, errorCorrectionLevel: 'H' });
    cartoes.push(`<div class="cartao">
      <div class="marca">Sanduba do Zé</div>
      <div class="mesa">MESA ${mesa}</div>
      <img src="${qr}" alt="QR Code da mesa ${mesa}">
      <div class="chamada">Aponte a câmera do celular<br>e faça seu pedido daqui mesmo</div>
      <div class="cidade">${esc(cidade)}</div>
    </div>`);
  }

  janela.document.open();
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>QR Codes das mesas - ${esc(cidade)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #1c1917; }
  .folha { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .cartao { border: 2px dashed #a8a29e; border-radius: 6mm; padding: 6mm 4mm; text-align: center;
            height: 88mm; display: flex; flex-direction: column; align-items: center; justify-content: center;
            break-inside: avoid; page-break-inside: avoid; }
  .marca { font-size: 15px; font-weight: 700; letter-spacing: .5px; color: #b45309; }
  .mesa { font-size: 34px; font-weight: 900; margin: 1mm 0 2mm; }
  img { width: 46mm; height: 46mm; }
  .chamada { font-size: 13px; margin-top: 2mm; line-height: 1.3; }
  .cidade { font-size: 11px; color: #78716c; margin-top: 1mm; }
  .dica { font-size: 12px; color: #57534e; margin: 0 0 6mm; }
  @media print { .dica { display: none; } }
</style></head><body>
<p class="dica">Recorte na linha pontilhada. Cada QR abre o cardápio já na mesa certa de ${esc(cidade)}.</p>
<div class="folha">${cartoes.join('')}</div>
<script>window.onload = () => { window.print(); };</script>
</body></html>`);
  janela.document.close();
}
