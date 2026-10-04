// ---------- Dinheiro ----------

export const formatarMoeda = (valor) => {
  const n = Number(valor);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Evita resíduos de ponto flutuante (ex.: 45.300000000000004)
export const arredondar = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

// Aceita "100", "100,50", "1.000,00", "1.000" e "100.50"
export function parseMoeda(texto) {
  let s = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- Telefone ----------

export const apenasDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

export function mascaraTelefone(valor) {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ---------- Carrinho ----------

export const precoUnitario = (item) =>
  arredondar(item.precoBase + item.adicionais.reduce((acc, ad) => acc + ad.preco * ad.quantidade, 0));

export const totalItem = (item) => arredondar(precoUnitario(item) * item.quantidade);

export const contarItens = (carrinho) => carrinho.reduce((acc, item) => acc + item.quantidade, 0);

// Atualiza nomes e preços do carrinho salvo com o cardápio atual e
// remove o que saiu do cardápio.
export function sincronizarCarrinho(carrinho, produtos, adicionais) {
  return carrinho
    .map((item) => {
      const produto = produtos.find((p) => p.id === item.produtoId);
      if (!produto) return null;
      const ads = produto.aceitaAdicionais
        ? (item.adicionais || [])
            .map((ad) => {
              const atual = adicionais.find((a) => a.id === ad.id);
              return atual ? { ...ad, nome: atual.nome, preco: atual.preco } : null;
            })
            .filter(Boolean)
        : [];
      return { ...item, nome: produto.nome, precoBase: produto.preco, adicionais: ads, observacao: item.observacao || '' };
    })
    .filter(Boolean);
}

// ---------- Pagamento ----------

export const PAGAMENTO_INICIAL = { multiplos: false, unicoId: null, trocoPara: '', valores: {} };

export function montarFormasPagamento(pagamento, total) {
  if (!pagamento.multiplos) {
    return pagamento.unicoId ? [{ idtipopgto: pagamento.unicoId, valor: total }] : [];
  }
  return Object.entries(pagamento.valores)
    .map(([id, texto]) => ({ idtipopgto: Number(id), valor: arredondar(parseMoeda(texto)) }))
    .filter((fp) => fp.valor > 0);
}

export function somaPagamentos(pagamento, total) {
  return arredondar(montarFormasPagamento(pagamento, total).reduce((acc, fp) => acc + fp.valor, 0));
}

export function trocoParaValor(pagamento, tipos) {
  if (pagamento.multiplos || !pagamento.trocoPara.trim()) return null;
  const tipo = tipos.find((t) => t.id === pagamento.unicoId);
  if (!tipo?.dinheiro) return null;
  const valor = parseMoeda(pagamento.trocoPara);
  return Number.isNaN(valor) ? null : arredondar(valor);
}

// Retorna a mensagem de erro, ou '' se estiver tudo certo
export function validarPagamento(pagamento, tipos, total) {
  if (!pagamento.multiplos) {
    if (!pagamento.unicoId) return 'Escolha uma forma de pagamento.';
    const tipo = tipos.find((t) => t.id === pagamento.unicoId);
    if (tipo?.dinheiro && pagamento.trocoPara.trim()) {
      const valor = parseMoeda(pagamento.trocoPara);
      if (Number.isNaN(valor)) return 'Digite o valor do troco só com números, por exemplo 100,00.';
      if (valor < total) return `O troco precisa ser para ${formatarMoeda(total)} ou mais.`;
    }
    return '';
  }

  if (montarFormasPagamento(pagamento, total).length === 0) {
    return 'Informe o valor de pelo menos uma forma de pagamento.';
  }
  const soma = somaPagamentos(pagamento, total);
  if (Math.abs(soma - total) > 0.009) {
    return `A soma dos pagamentos (${formatarMoeda(soma)}) precisa ser igual ao total (${formatarMoeda(total)}).`;
  }
  return '';
}

export function descreverPagamento(pagamento, tipos, total) {
  const nome = (id) => tipos.find((t) => t.id === id)?.descricao || 'Pagamento';
  if (!pagamento.multiplos) {
    if (!pagamento.unicoId) return '';
    const troco = trocoParaValor(pagamento, tipos);
    let texto = `${nome(pagamento.unicoId)}: ${formatarMoeda(total)}`;
    if (troco !== null && troco > total) {
      texto += `\nTroco para ${formatarMoeda(troco)} (levar ${formatarMoeda(troco - total)})`;
    }
    return texto;
  }
  return montarFormasPagamento(pagamento, total)
    .map((fp) => `${nome(fp.idtipopgto)}: ${formatarMoeda(fp.valor)}`)
    .join('\n');
}

// ---------- Armazenamento local ----------

export function lerStorage(chave, padrao) {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? JSON.parse(valor) : padrao;
  } catch {
    return padrao;
  }
}

export function salvarStorage(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* modo anônimo ou armazenamento cheio: segue sem salvar */
  }
}
