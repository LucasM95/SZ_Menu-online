import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { acompanharPedidos, carregarCardapio, carregarEmpresas, enviarPedido } from './api';
import {
  PAGAMENTO_INICIAL,
  RECEBIMENTO_INICIAL,
  arredondar,
  contarItens,
  descreverPagamento,
  descreverRecebimento,
  lerStorage,
  linkWhatsapp,
  modosDaLoja,
  montarMensagemWhatsapp,
  montarFormasPagamento,
  salvarStorage,
  sincronizarCarrinho,
  totalItem,
  trocoParaValor,
  validarPagamento,
} from './utils';

import Header from './components/Header';
import Identificacao from './components/Identificacao';
import Cardapio from './components/Cardapio';
import ModalAdicionais from './components/ModalAdicionais';
import BarraCarrinho from './components/BarraCarrinho';
import BotaoWhatsapp from './components/BotaoWhatsapp';
import Checkout from './components/Checkout';
import Revisao from './components/Revisao';
import Sucesso from './components/Sucesso';
import PedidosEmCurso from './components/PedidosEmCurso';

const CLIENTE_VAZIO = { telefone: '', nome: '', cidade: '', ruaNumero: '', referencia: '' };

function lerClienteSalvo() {
  const salvo = lerStorage('sdz-cliente', null);
  return salvo && typeof salvo === 'object' ? { ...CLIENTE_VAZIO, ...salvo } : CLIENTE_VAZIO;
}

function lerCarrinhoSalvo() {
  const salvo = lerStorage('sdz-carrinho', []);
  // Cada item guarda a filial: códigos e preços mudam de uma loja para outra
  return Array.isArray(salvo) ? salvo.filter((i) => i && (i.produtoId || i.promocaoId) && i.filial) : [];
}

const CARDAPIO_VAZIO = { status: 'vazio', filial: null, dados: null, erro: '' };

// Entrega ou retirada ficam salvas para a próxima visita; a mesa nunca (vale só enquanto está na loja)
function lerRecebimentoSalvo() {
  const modo = lerStorage('sdz-modo', 'entrega');
  return { ...RECEBIMENTO_INICIAL, modo: modo === 'retirada' ? 'retirada' : 'entrega' };
}

// QR Code da mesa: https://sandubadoze.com.br/?cidade=Guap%C3%B3&mesa=5&t=<código da mesa>
function lerMesaDoLink() {
  try {
    const p = new URLSearchParams(window.location.search);
    const mesa = parseInt(p.get('mesa'), 10);
    const cidade = (p.get('cidade') || '').trim();
    const token = (p.get('t') || '').trim();
    return cidade && mesa > 0 && token ? { cidade, mesa, token } : null;
  } catch {
    return null;
  }
}

export default function App() {
  // Cidades atendidas (carregadas ao abrir o site)
  const [cidades, setCidades] = useState([]);
  const [statusCidades, setStatusCidades] = useState('carregando'); // carregando | erro | ok
  const [erroCidades, setErroCidades] = useState('');

  // Cardápio da filial da cidade escolhida (carregado ao avançar)
  const [cardapio, setCardapio] = useState(CARDAPIO_VAZIO);
  const dados = cardapio.dados;

  const [etapa, setEtapa] = useState('identificacao');
  const [cliente, setCliente] = useState(lerClienteSalvo);
  const [recebimento, setRecebimento] = useState(lerRecebimentoSalvo);
  const mesaDoLink = useRef(lerMesaDoLink());
  const [carrinho, setCarrinho] = useState(lerCarrinhoSalvo);
  const [pagamento, setPagamento] = useState(PAGAMENTO_INICIAL);

  const [produtoModal, setProdutoModal] = useState(null);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null); // { id, whatsapp }

  // Pedidos já feitos com este WhatsApp que ainda não foram entregues
  const [pedidosEmCurso, setPedidosEmCurso] = useState([]);
  const [versaoAcompanhamento, setVersaoAcompanhamento] = useState(0);

  const carrinhoRef = useRef(carrinho);
  carrinhoRef.current = carrinho;

  const cidadeAtual = cidades.find((c) => c.nome === cliente.cidade);
  const filialAtual = cidadeAtual?.filial ?? null;
  const lojaFechada = Boolean(cidadeAtual && !cidadeAtual.aberta);
  const avisoFechado = lojaFechada
    ? `Estamos fora do horário de atendimento em ${cidadeAtual.nome}. ${cidadeAtual.mensagem}`.trim()
    : '';

  // ---------- Carga das cidades ----------
  const carregarCidades = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setStatusCidades('carregando');
    try {
      const lista = await carregarEmpresas();
      setCidades(lista);
      // Veio pelo QR Code da mesa: cidade e mesa já escolhidas (uma vez só, ao abrir)
      const link = mesaDoLink.current;
      mesaDoLink.current = null;
      const lojaDoLink = link && lista.find((cid) => cid.nome === link.cidade);
      if (lojaDoLink && link.mesa <= (lojaDoLink.mesas || 0)) {
        setCliente((c) => ({ ...c, cidade: lojaDoLink.nome }));
        setRecebimento({ modo: 'mesa', mesa: link.mesa, mesaFixa: true, mesaToken: link.token });
      } else {
        // O cliente escolhe a cidade (ela define a filial e a taxa); só mantém a salva se ainda existir
        setCliente((c) => (lista.some((cid) => cid.nome === c.cidade) ? c : { ...c, cidade: '' }));
      }
      setStatusCidades('ok');
    } catch (err) {
      if (silencioso) return; // falha na atualização automática: mantém o que já tinha
      setErroCidades(err.message);
      setStatusCidades('erro');
    }
  }, []);

  // Recarrega a cada minuto: a loja pode abrir ou fechar com o site aberto
  useEffect(() => {
    carregarCidades();
    const t = setInterval(() => carregarCidades({ silencioso: true }), 60000);
    return () => clearInterval(t);
  }, [carregarCidades]);

  // ---------- Carga do cardápio da filial ----------
  const carregarFilial = useCallback(async (filial, { silencioso = false } = {}) => {
    if (!silencioso) setCardapio({ status: 'carregando', filial, dados: null, erro: '' });
    try {
      const novos = await carregarCardapio(filial);
      setCardapio({ status: 'ok', filial, dados: novos, erro: '' });

      // Itens de outra loja não valem aqui: códigos e preços são diferentes
      const atual = carrinhoRef.current;
      const daFilial = atual.filter((i) => i.filial === filial);
      if (daFilial.length < atual.length) {
        setAviso('Seu carrinho foi esvaziado: cada loja tem cardápio e preços próprios.');
      }
      setCarrinho(sincronizarCarrinho(daFilial, novos.produtos, novos.adicionais, novos.promocoes));
      setPagamento(PAGAMENTO_INICIAL);
    } catch (err) {
      if (!silencioso) setCardapio({ status: 'erro', filial, dados: null, erro: err.message });
      throw err;
    }
  }, []);

  const abrirCardapio = () => {
    if (filialAtual && (cardapio.filial !== filialAtual || cardapio.status === 'erro')) {
      carregarFilial(filialAtual).catch(() => {});
    }
    setEtapa('cardapio');
  };

  const escolherCidade = (nome) => {
    const nova = cidades.find((c) => c.nome === nome);
    const filialCarrinho = carrinho[0]?.filial;
    if (nova && carrinho.length > 0 && filialCarrinho !== nova.filial) {
      const confirmou = window.confirm(
        `A loja que atende ${nome} tem cardápio e preços próprios. Trocar de cidade vai esvaziar seu carrinho. Deseja continuar?`
      );
      if (!confirmou) return;
      setCarrinho([]);
    }
    setCliente((c) => ({ ...c, cidade: nome }));
  };

  // ---------- Acompanhamento de pedidos ----------
  // A cada 60 s no site; a cada 20 s na tela de sucesso, onde o cliente está de olho no pedido
  const digitosTelefone = cliente.telefone.replace(/\D/g, '');
  const idAcompanhado = etapa === 'sucesso' ? pedidoFinalizado?.id : null;
  useEffect(() => {
    if (digitosTelefone.length !== 11) {
      setPedidosEmCurso([]);
      return undefined;
    }
    let ativo = true;
    const buscar = () =>
      acompanharPedidos(digitosTelefone, idAcompanhado).then((lista) => {
        if (ativo) setPedidosEmCurso(lista);
      });
    buscar();
    const t = setInterval(buscar, idAcompanhado ? 20000 : 60000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [digitosTelefone, versaoAcompanhamento, idAcompanhado]);

  // A loja pode desligar a retirada ou as mesas: volta para entrega se a opção sumir
  const modosDisponiveis = modosDaLoja(cidadeAtual);
  useEffect(() => {
    if (!cidadeAtual) return;
    const modos = modosDaLoja(cidadeAtual);
    // Mesa só vale se veio pelo QR Code e a loja ainda tem essa mesa
    const mesaValida =
      recebimento.modo === 'mesa' && recebimento.mesaFixa && recebimento.mesa <= (cidadeAtual.mesas || 0);
    if (!modos.includes(recebimento.modo) && !mesaValida) setRecebimento(RECEBIMENTO_INICIAL);
  }, [cidadeAtual, recebimento.modo, recebimento.mesa]);

  // ---------- Persistência local ----------
  useEffect(() => salvarStorage('sdz-cliente', cliente), [cliente]);
  useEffect(() => {
    if (recebimento.modo !== 'mesa') salvarStorage('sdz-modo', recebimento.modo);
  }, [recebimento.modo]);
  useEffect(() => salvarStorage('sdz-carrinho', carrinho), [carrinho]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [etapa]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), aviso.length > 40 ? 4500 : 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---------- Totais ----------
  const subtotal = useMemo(() => arredondar(carrinho.reduce((acc, i) => acc + totalItem(i), 0)), [carrinho]);
  // Itens "só na mesa" (ex.: cervejas) aparecem só para quem está na mesa; grupo vazio some
  const cardapioDoModo = useMemo(() => {
    if (!dados) return { categorias: [], produtos: [], promocoes: [] };
    if (recebimento.modo === 'mesa') return dados;
    const produtos = dados.produtos.filter((p) => !p.soMesa);
    const comProduto = new Set(produtos.map((p) => p.categoriaId));
    return {
      categorias: dados.categorias.filter((c) => comProduto.has(c.id)),
      produtos,
      promocoes: dados.promocoes.filter((p) => !p.soMesa),
    };
  }, [dados, recebimento.modo]);

  // Saiu da mesa ("Não estou na loja") com algo "só na mesa" no carrinho: tira e avisa
  useEffect(() => {
    if (!dados || recebimento.modo === 'mesa') return;
    const soMesaProd = new Set(dados.produtos.filter((p) => p.soMesa).map((p) => p.id));
    const soMesaPromo = new Set(dados.promocoes.filter((p) => p.soMesa).map((p) => p.id));
    const proibido = (i) => (i.promocaoId ? soMesaPromo.has(i.promocaoId) : soMesaProd.has(i.produtoId));
    setCarrinho((c) => {
      if (!c.some(proibido)) return c;
      setAviso('Itens disponíveis só na mesa foram retirados do carrinho.');
      return c.filter((i) => !proibido(i));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, recebimento.modo]);

  // Texto do pagamento na revisão e na mensagem do WhatsApp
  const textoPagamento = () =>
    recebimento.modo === 'mesa'
      ? 'No caixa, ao fechar a mesa'
      : descreverPagamento(pagamento, dados?.tiposPagamento || [], total);

  // Retirada e mesa não pagam entrega
  const taxaEntrega = recebimento.modo === 'entrega' ? cidadeAtual?.taxa ?? 0 : 0;
  const total = arredondar(subtotal + taxaEntrega);

  // ---------- Carrinho ----------
  const adicionarAoCarrinho = (produto, { quantidade = 1, adicionais = [], observacao = '' } = {}) => {
    setCarrinho((prev) => [
      ...prev,
      {
        cartItemId: `${produto.id}-${Date.now()}`,
        produtoId: produto.id,
        filial: cardapio.filial,
        nome: produto.nome,
        precoBase: produto.preco,
        quantidade,
        adicionais,
        observacao,
      },
    ]);
    setAviso(`${produto.nome} adicionado`);
  };

  const adicionarPromocao = (promo) => {
    setCarrinho((prev) => {
      // Mesma promoção já no carrinho: só aumenta a quantidade
      const existente = prev.find((i) => i.promocaoId === promo.id);
      if (existente) {
        return prev.map((i) => (i === existente ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          cartItemId: `promo-${promo.id}-${Date.now()}`,
          promocaoId: promo.id,
          filial: cardapio.filial,
          nome: promo.nome,
          precoBase: promo.precoPor,
          precoDe: promo.precoDe,
          itensPromocao: promo.itens,
          quantidade: 1,
          adicionais: [],
          observacao: '',
        },
      ];
    });
    setAviso(`Promoção ${promo.nome} adicionada`);
  };

  const escolherProduto = (produto) => {
    if (produto.aceitaAdicionais && dados.adicionais.length > 0) {
      setProdutoModal(produto);
    } else {
      adicionarAoCarrinho(produto);
    }
  };

  const alterarQuantidade = (cartItemId, delta) => {
    setCarrinho((prev) =>
      prev
        .map((i) => (i.cartItemId === cartItemId ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0)
    );
  };

  const removerItem = (cartItemId) => setCarrinho((prev) => prev.filter((i) => i.cartItemId !== cartItemId));

  const alterarObservacao = (cartItemId, observacao) =>
    setCarrinho((prev) => prev.map((i) => (i.cartItemId === cartItemId ? { ...i, observacao } : i)));

  // ---------- Envio ----------
  const finalizarPedido = async () => {
    setErroEnvio('');
    if (lojaFechada) {
      setErroEnvio(avisoFechado);
      return;
    }
    // Mesa: o pagamento é escolhido no caixa, ao fechar a mesa
    const erro = recebimento.modo === 'mesa' ? '' : validarPagamento(pagamento, dados.tiposPagamento, total);
    if (erro) {
      setErroEnvio(erro);
      return;
    }

    const payload = {
      telefone: cliente.telefone,
      modo: recebimento.modo,
      mesa: recebimento.modo === 'mesa' ? recebimento.mesa : null,
      mesaToken: recebimento.modo === 'mesa' ? recebimento.mesaToken : '',
      cliente: {
        nome: cliente.nome.trim(),
        cidade: cliente.cidade,
        ruaNumero: cliente.ruaNumero.trim(),
        referencia: cliente.referencia.trim(),
      },
      itens: carrinho.map((i) =>
        i.promocaoId
          ? { promocao: i.promocaoId, quantidade: i.quantidade, observacao: (i.observacao || '').trim() }
          : {
              id: i.produtoId,
              quantidade: i.quantidade,
              observacao: (i.observacao || '').trim(),
              adicionais: i.adicionais.map((a) => ({ id: a.id, quantidade: a.quantidade })),
            }
      ),
      totalGeral: total,
      // Mesa: o pagamento é escolhido no caixa, ao fechar a mesa
      formasPagamento: recebimento.modo === 'mesa' ? [] : montarFormasPagamento(pagamento, total),
      trocoPara: recebimento.modo === 'mesa' ? null : trocoParaValor(pagamento, dados.tiposPagamento),
    };

    setEnviando(true);
    try {
      const resposta = await enviarPedido(payload);
      // Monta a mensagem antes de limpar o carrinho
      const mensagem = montarMensagemWhatsapp({
        pedidoId: resposta.idpedido,
        cliente,
        recebimento,
        carrinho,
        subtotal,
        taxaEntrega,
        total,
        descricaoPagamento: textoPagamento(),
      });
      setVersaoAcompanhamento((v) => v + 1);
      setPedidoFinalizado({
        id: resposta.idpedido,
        whatsapp: resposta.whatsapp ? linkWhatsapp(resposta.whatsapp, mensagem) : null,
      });
      setCarrinho([]);
      setPagamento(PAGAMENTO_INICIAL);
      setEtapa('sucesso');
    } catch (err) {
      setErroEnvio(err.message);
      if (err.status === 409) {
        // Preço ou produto mudou: recarrega o cardápio e volta para o carrinho
        await carregarFilial(cardapio.filial, { silencioso: true }).catch(() => {});
        setPagamento(PAGAMENTO_INICIAL);
        setEtapa('checkout');
      }
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Render ----------
  const cardapioPronto = cardapio.status === 'ok' && cardapio.filial === filialAtual;
  const mostrarBarra = etapa === 'cardapio' && cardapioPronto && carrinho.length > 0 && !lojaFechada;
  // Na tela de sucesso já existe o botão grande do WhatsApp
  const mostrarWhatsapp = statusCidades === 'ok' && etapa !== 'sucesso' && Boolean(cidadeAtual?.whatsapp);

  const telaCarregando = (texto) => (
    <div className="card card--estreito estado-carga" role="status">
      <div className="spinner" aria-hidden="true" />
      <p>{texto}</p>
      <p className="texto-suave">Na primeira visita do dia isso pode levar alguns segundos.</p>
    </div>
  );

  const telaErro = (texto, mensagem, tentar) => (
    <div className="card card--estreito estado-carga">
      <p className="estado-carga__titulo">{texto}</p>
      <p className="texto-suave">{mensagem}</p>
      <button type="button" className="btn-primario" onClick={tentar}>
        Tentar de novo
      </button>
    </div>
  );

  let conteudo;
  if (statusCidades === 'carregando') {
    conteudo = telaCarregando('Carregando…');
  } else if (statusCidades === 'erro') {
    conteudo = telaErro('Não foi possível abrir o cardápio.', erroCidades, carregarCidades);
  } else if (etapa === 'identificacao') {
    conteudo = (
      <Identificacao
        cliente={cliente}
        setCliente={setCliente}
        cidades={cidades}
        onEscolherCidade={escolherCidade}
        recebimento={recebimento}
        setRecebimento={setRecebimento}
        modosDisponiveis={modosDisponiveis}
        onAvancar={abrirCardapio}
      />
    );
  } else if (cardapio.status === 'erro') {
    conteudo = telaErro('Não foi possível carregar o cardápio.', cardapio.erro, () =>
      carregarFilial(filialAtual).catch(() => {})
    );
  } else if (!cardapioPronto) {
    conteudo = telaCarregando(`Carregando o cardápio de ${cliente.cidade}…`);
  } else if (etapa === 'cardapio') {
    conteudo = (
      <Cardapio
        key={cardapio.filial}
        categorias={cardapioDoModo.categorias}
        produtos={cardapioDoModo.produtos}
        promocoes={cardapioDoModo.promocoes}
        loja={cidadeAtual}
        onEscolher={escolherProduto}
        onEscolherPromocao={adicionarPromocao}
        onAlterarDados={() => setEtapa('identificacao')}
      />
    );
  } else if (etapa === 'checkout') {
    conteudo = (
      <Checkout
        carrinho={carrinho}
        onAlterarQuantidade={alterarQuantidade}
        onRemover={removerItem}
        onObservacao={alterarObservacao}
        cidade={cliente.cidade}
        rotuloTaxa={descreverRecebimento(recebimento, cliente).rotuloTaxa}
        semTaxa={recebimento.modo !== 'entrega'}
        pagarNoCaixa={recebimento.modo === 'mesa'}
        subtotal={subtotal}
        taxaEntrega={taxaEntrega}
        total={total}
        tiposPagamento={dados.tiposPagamento}
        pagamento={pagamento}
        setPagamento={setPagamento}
        avisoExterno={erroEnvio || avisoFechado}
        lojaFechada={lojaFechada}
        onVoltar={() => {
          setErroEnvio('');
          setEtapa('cardapio');
        }}
        onRevisar={() => {
          setErroEnvio('');
          setEtapa('revisao');
        }}
      />
    );
  } else if (etapa === 'revisao') {
    conteudo = (
      <Revisao
        cliente={cliente}
        recebimento={recebimento}
        carrinho={carrinho}
        subtotal={subtotal}
        taxaEntrega={taxaEntrega}
        total={total}
        descricaoPagamento={textoPagamento()}
        enviando={enviando}
        erro={erroEnvio}
        onVoltar={() => {
          setErroEnvio('');
          setEtapa('checkout');
        }}
        onConfirmar={finalizarPedido}
      />
    );
  } else {
    conteudo = (
      <Sucesso
        pedidoId={pedidoFinalizado?.id}
        linkWhatsapp={pedidoFinalizado?.whatsapp}
        acompanhamento={pedidosEmCurso.find((p) => p.id === pedidoFinalizado?.id)}
        naMesa={recebimento.modo === 'mesa'}
        semTelefone={!cliente.telefone.replace(/\D/g, '')}
        onNovoPedido={() => {
          setPedidoFinalizado(null);
          setEtapa('cardapio');
        }}
      />
    );
  }

  return (
    <div className="app" translate="no">
      <Header
        cliente={cliente}
        recebimento={recebimento}
        mostrarCliente={statusCidades === 'ok' && etapa !== 'identificacao'}
      />

      <main className={`main ${mostrarBarra ? 'main--com-barra' : ''} ${mostrarWhatsapp ? 'main--com-whatsapp' : ''}`}>
        {statusCidades === 'ok' && (etapa === 'identificacao' || etapa === 'cardapio') && (
          <PedidosEmCurso pedidos={pedidosEmCurso} />
        )}
        {conteudo}
      </main>

      {mostrarWhatsapp && !produtoModal && (
        <BotaoWhatsapp
          key={cidadeAtual.nome}
          numero={cidadeAtual.whatsapp}
          cidade={cidadeAtual.nome}
          acimaDaBarra={mostrarBarra}
        />
      )}

      {mostrarBarra && (
        <BarraCarrinho quantidade={contarItens(carrinho)} subtotal={subtotal} onAbrir={() => setEtapa('checkout')} />
      )}

      {produtoModal && (
        <ModalAdicionais
          produto={produtoModal}
          adicionais={dados.adicionais}
          onFechar={() => setProdutoModal(null)}
          onConfirmar={(opcoes) => {
            adicionarAoCarrinho(produtoModal, opcoes);
            setProdutoModal(null);
          }}
        />
      )}

      <div className={`toast ${aviso ? 'toast--visivel' : ''} ${mostrarBarra ? 'toast--acima-barra' : ''}`} role="status" aria-live="polite">
        {aviso}
      </div>
    </div>
  );
}
