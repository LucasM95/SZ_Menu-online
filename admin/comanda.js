import QRCode from 'qrcode';
import { formatarMoeda } from '../utils';

const esc = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Conteúdo do QR Code: "SZ:<filial>:<pedido>". O PDV pode imprimir o mesmo formato.
export const codigoQr = (filial, id) => `SZ:${filial}:${id}`;

// Abre a comanda pronta para impressora térmica (80 mm) com o QR Code do pedido
export async function imprimirComanda(pedido) {
  // A janela é aberta antes de gerar o QR para o navegador não bloquear como pop-up
  const janela = window.open('', '_blank', 'width=420,height=700');
  if (!janela) {
    window.alert('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
    return;
  }
  const qr = await QRCode.toDataURL(codigoQr(pedido.filial, pedido.id), { margin: 1, width: 220 });

  const itens = pedido.itens
    .map((i) => {
      const adicionais = i.adicionais.map((a) => `<div class="sub">+ ${a.qtde}x ${esc(a.nome)}</div>`).join('');
      const obs = i.obs.replace(/^Promoção:[^|]*\|?\s*/, '');
      return `<div class="item"><b>${i.qtde}x</b> ${esc(i.nome)}${i.promocao ? ` <i>(${esc(i.promocao)})</i>` : ''}</div>
        ${adicionais}${obs ? `<div class="sub">Obs.: ${esc(obs)}</div>` : ''}`;
    })
    .join('');

  const pagamentos = pedido.pagamentos.map((p) => `${esc(p.descricao)}: ${formatarMoeda(p.valor)}`).join('<br>');

  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Pedido ${pedido.id}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: Arial, sans-serif; font-size: 13px; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 22px; margin: 0 0 2px; text-align: center; }
  .centro { text-align: center; }
  .linha { border-top: 1px dashed #000; margin: 8px 0; }
  .item { margin-top: 4px; }
  .sub { padding-left: 14px; font-size: 12px; }
  .tot { display: flex; justify-content: space-between; }
  .forte { font-weight: bold; font-size: 15px; }
  img { width: 44mm; height: 44mm; display: block; margin: 6px auto 0; }
</style></head><body>
  <h1>Pedido nº ${pedido.id}</h1>
  <div class="centro">${esc(pedido.data)} às ${esc(pedido.hora)} · Cardápio online</div>
  <div class="linha"></div>
  <div><b>${esc(pedido.cliente)}</b></div>
  <div>${esc(pedido.wpp)}</div>
  <div>${esc(pedido.endereco)}</div>
  ${pedido.obs ? `<div>${esc(pedido.obs)}</div>` : ''}
  <div class="linha"></div>
  ${itens}
  <div class="linha"></div>
  <div class="tot"><span>Produtos</span><span>${formatarMoeda(pedido.totalpedido)}</span></div>
  ${pedido.adicionais > 0 ? `<div class="tot"><span>Adicionais</span><span>${formatarMoeda(pedido.adicionais)}</span></div>` : ''}
  ${pedido.desconto > 0 ? `<div class="tot"><span>Desconto</span><span>- ${formatarMoeda(pedido.desconto)}</span></div>` : ''}
  <div class="tot"><span>Entrega</span><span>${formatarMoeda(pedido.taxaEntrega)}</span></div>
  <div class="tot forte"><span>TOTAL</span><span>${formatarMoeda(pedido.total)}</span></div>
  <div class="linha"></div>
  <div>${pagamentos}</div>
  ${pedido.troco > 0 ? `<div class="forte">LEVAR TROCO: ${formatarMoeda(pedido.troco)}</div><div>Cliente paga com ${formatarMoeda(pedido.pgtoCliente)}</div>` : ''}
  <img src="${qr}" alt="">
  <div class="centro">Leia na saída para entrega</div>
  <script>window.onload = () => { window.print(); };</script>
</body></html>`);
  janela.document.close();
}
