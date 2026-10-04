import { useCallback, useEffect, useMemo, useState } from 'react';
import { carregarCardapio, enviarPedido } from './api';
import {
  PAGAMENTO_INICIAL,
  arredondar,
  contarItens,
  descreverPagamento,
  lerStorage,
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
import Checkout from './components/Checkout';
import Revisao from './components/Revisao';
import Sucesso from './components/Sucesso';

const CLIENTE_VAZIO = { telefone: '', nome: '', cidade: '', ruaNumero: '', referencia: '' };

function lerClienteSalvo() {
  const salvo = lerStorage('sdz-cliente', null);
  return salvo && typeof salvo === 'object' ? { ...CLIENTE_VAZIO, ...salvo } : CLIENTE_VAZIO;
}

function lerCarrinhoSalvo() {
  const salvo = lerStorage('sdz-carrinho', []);
  return Array.isArray(salvo) ? salvo.filter((i) => i && i.produtoId) : [];
}

export default function App() {
  const [dados, setDados] = useState(null);
  const [statusCarga, setStatusCarga] = useState('carregando'); // carregando | erro | ok
  const [erroCarga, setErroCarga] = useState('');

  const [etapa, setEtapa] = useState('identificacao');
  const [cliente, setCliente] = useState(lerClienteSalvo);
  const [carrinho, setCarrinho] = useState(lerCarrinhoSalvo);
  const [pagamento, setPagamento] = useState(PAGAMENTO_INICIAL);

  const [produtoModal, setProdutoModal] = useState(null);
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');
  const [pedidoId, setPedidoId] = useState(null);

  // ---------- Carga do cardápio ----------
  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setStatusCarga('carregando');
    try {
      const novos = await carregarCardapio();
      setDados(novos);
      setCarrinho((prev) => sincronizarCarrinho(prev, novos.produtos, novos.adicionais));
      setCliente((c) =>
        novos.cidades.some((cid) => cid.nome === c.cidade) ? c : { ...c, cidade: novos.cidades[0]?.nome || '' }
      );
      setStatusCarga('ok');
    } catch (err) {
      if (!silencioso) {
        setErroCarga(err.message);
        setStatusCarga('erro');
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    carregar().catch(() => {});
  }, [carregar]);

  // ---------- Persistência local ----------
  useEffect(() => salvarStorage('sdz-cliente', cliente), [cliente]);
  useEffect(() => salvarStorage('sdz-carrinho', carrinho), [carrinho]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [etapa]);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(''), 2200);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---------- Totais ----------
  const subtotal = useMemo(() => arredondar(carrinho.reduce((acc, i) => acc + totalItem(i), 0)), [carrinho]);
  const taxaEntrega = dados?.cidades.find((c) => c.nome === cliente.cidade)?.taxa ?? 0;
  const total = arredondar(subtotal + taxaEntrega);

  // ---------- Carrinho ----------
  const adicionarAoCarrinho = (produto, { quantidade = 1, adicionais = [], observacao = '' } = {}) => {
    setCarrinho((prev) => [
      ...prev,
      {
        cartItemId: `${produto.id}-${Date.now()}`,
        produtoId: produto.id,
        nome: produto.nome,
        precoBase: produto.preco,
        quantidade,
        adicionais,
        observacao,
      },
    ]);
    setAviso(`${produto.nome} adicionado`);
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
    const erro = validarPagamento(pagamento, dados.tiposPagamento, total);
    if (erro) {
      setErroEnvio(erro);
      return;
    }

    const payload = {
      telefone: cliente.telefone,
      cliente: {
        nome: cliente.nome.trim(),
        cidade: cliente.cidade,
        ruaNumero: cliente.ruaNumero.trim(),
        referencia: cliente.referencia.trim(),
      },
      itens: carrinho.map((i) => ({
        id: i.produtoId,
        quantidade: i.quantidade,
        observacao: (i.observacao || '').trim(),
        adicionais: i.adicionais.map((a) => ({ id: a.id, quantidade: a.quantidade })),
      })),
      totalGeral: total,
      formasPagamento: montarFormasPagamento(pagamento, total),
      trocoPara: trocoParaValor(pagamento, dados.tiposPagamento),
    };

    setEnviando(true);
    try {
      const resposta = await enviarPedido(payload);
      setPedidoId(resposta.idpedido);
      setCarrinho([]);
      setPagamento(PAGAMENTO_INICIAL);
      setEtapa('sucesso');
    } catch (err) {
      setErroEnvio(err.message);
      if (err.status === 409) {
        // Preço ou produto mudou: recarrega o cardápio e volta para o carrinho
        await carregar({ silencioso: true }).catch(() => {});
        setPagamento(PAGAMENTO_INICIAL);
        setEtapa('checkout');
      }
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Render ----------
  const mostrarBarra = etapa === 'cardapio' && carrinho.length > 0;

  let conteudo;
  if (statusCarga === 'carregando') {
    conteudo = (
      <div className="card card--estreito estado-carga" role="status">
        <div className="spinner" aria-hidden="true" />
        <p>Carregando o cardápio…</p>
        <p className="texto-suave">Na primeira visita do dia isso pode levar alguns segundos.</p>
      </div>
    );
  } else if (statusCarga === 'erro') {
    conteudo = (
      <div className="card card--estreito estado-carga">
        <p className="estado-carga__titulo">Não foi possível carregar o cardápio.</p>
        <p className="texto-suave">{erroCarga}</p>
        <button type="button" className="btn-primario" onClick={() => carregar().catch(() => {})}>
          Tentar de novo
        </button>
      </div>
    );
  } else if (etapa === 'identificacao') {
    conteudo = (
      <Identificacao
        cliente={cliente}
        setCliente={setCliente}
        cidades={dados.cidades}
        onAvancar={() => setEtapa('cardapio')}
      />
    );
  } else if (etapa === 'cardapio') {
    conteudo = (
      <Cardapio
        categorias={dados.categorias}
        produtos={dados.produtos}
        onEscolher={escolherProduto}
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
        subtotal={subtotal}
        taxaEntrega={taxaEntrega}
        total={total}
        tiposPagamento={dados.tiposPagamento}
        pagamento={pagamento}
        setPagamento={setPagamento}
        avisoExterno={erroEnvio}
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
        carrinho={carrinho}
        subtotal={subtotal}
        taxaEntrega={taxaEntrega}
        total={total}
        descricaoPagamento={descreverPagamento(pagamento, dados.tiposPagamento, total)}
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
        pedidoId={pedidoId}
        onNovoPedido={() => {
          setPedidoId(null);
          setEtapa('cardapio');
        }}
      />
    );
  }

  return (
    <div className="app" translate="no">
      <Header cliente={cliente} mostrarCliente={statusCarga === 'ok' && etapa !== 'identificacao'} />

      <main className={`main ${mostrarBarra ? 'main--com-barra' : ''}`}>{conteudo}</main>

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
