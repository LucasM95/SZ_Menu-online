import { useRef, useState } from 'react';
import { ArrowRight, Bike, MapPin, Navigation, Phone, Store, User, UtensilsCrossed } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { buscarCliente } from '../api';
import { apenasDigitos, mascaraTelefone } from '../utils';

const MODOS = {
  entrega: { nome: 'Entrega', Icone: Bike },
  retirada: { nome: 'Retirada', Icone: Store },
};

const TITULOS = {
  entrega: 'Onde vamos entregar?',
  retirada: 'Retirada no balcão',
  mesa: 'Pedido na mesa',
};

export default function Identificacao({
  cliente,
  setCliente,
  cidades,
  onEscolherCidade,
  recebimento,
  setRecebimento,
  modosDisponiveis = ['entrega'],
  onAvancar,
}) {
  const [buscando, setBuscando] = useState(false);
  const loja = cidades.find((c) => c.nome === cliente.cidade);
  const modo = recebimento.modo;
  const naMesa = modo === 'mesa';
  const escolherModo = (novo) => {
    setErro('');
    // Sair da mesa ("Não estou na loja") ou trocar entre entrega e retirada; mesa só pelo QR Code
    setRecebimento((r) => ({ ...r, modo: novo, mesa: null, mesaFixa: false, mesaToken: '' }));
  };
  const [erro, setErro] = useState('');
  const ultimaBusca = useRef('');

  const atualizar = (campo) => (e) => setCliente((c) => ({ ...c, [campo]: e.target.value }));

  const alterarTelefone = async (e) => {
    const telefone = mascaraTelefone(e.target.value);
    setCliente((c) => ({ ...c, telefone }));

    const digitos = apenasDigitos(telefone);
    if (digitos.length !== 11 || digitos === ultimaBusca.current) return;
    ultimaBusca.current = digitos;

    setBuscando(true);
    try {
      const achado = await buscarCliente(digitos);
      if (!achado) return;
      // Só preenche campos vazios, e só se o número não mudou durante a busca
      setCliente((c) => {
        if (apenasDigitos(c.telefone) !== digitos) return c;
        const preencherEndereco = !c.ruaNumero.trim() && achado.ruaNumero;
        const cidadeValida = cidades.some((cid) => cid.nome === achado.cidade);
        return {
          ...c,
          nome: c.nome.trim() ? c.nome : achado.nome || '',
          ruaNumero: preencherEndereco ? achado.ruaNumero : c.ruaNumero,
          referencia: preencherEndereco && !c.referencia.trim() ? achado.referencia || '' : c.referencia,
          cidade: preencherEndereco && cidadeValida ? achado.cidade : c.cidade,
        };
      });
    } catch {
      /* sem cadastro ou servidor indisponível: o cliente preenche à mão */
    } finally {
      if (ultimaBusca.current === digitos) setBuscando(false);
    }
  };

  const avancar = (e) => {
    e.preventDefault();
    const digitos = apenasDigitos(cliente.telefone);
    if (!cliente.cidade) {
      setErro('Escolha sua cidade.');
      return;
    }
    if (naMesa && !(recebimento.mesa >= 1 && recebimento.mesa <= (loja?.mesas || 0))) {
      setErro('Escolha o número da sua mesa.');
      return;
    }
    // Na mesa o WhatsApp é opcional (só para acompanhar); se digitar, tem que estar completo
    if ((!naMesa || digitos.length > 0) && digitos.length !== 11) {
      setErro('Digite o WhatsApp completo com DDD, por exemplo (62) 99999-9999.');
      return;
    }
    if (!naMesa && cliente.nome.trim().length < 2) {
      setErro('Digite seu nome.');
      return;
    }
    if (modo === 'entrega' && cliente.ruaNumero.trim().length < 3) {
      setErro('Digite a rua e o número para a entrega.');
      return;
    }
    setErro('');
    onAvancar();
  };

  return (
    <section className="card card--estreito">
      <div className="identificacao__topo">
        <img
          src={logoImg}
          alt="Logo do Sanduba do Zé"
          className="identificacao__logo"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <h2 className="titulo-secao">{loja ? TITULOS[modo] : 'Como você quer seu pedido?'}</h2>
        <p className="texto-suave">
          {naMesa && loja
            ? 'Peça daqui mesmo: o pedido vai direto para o caixa da loja.'
            : 'Seus dados ficam salvos no seu aparelho para o próximo pedido.'}
        </p>
      </div>

      <form onSubmit={avancar} className="formulario" noValidate>
        {recebimento.mesaFixa && loja && (
          <div className="mesa-fixa" role="status">
            <UtensilsCrossed size={22} aria-hidden="true" />
            <div>
              <strong>Mesa {recebimento.mesa}</strong>
              <span>Sanduba do Zé · {loja.nome}</span>
            </div>
            <button type="button" className="mesa-fixa__sair" onClick={() => escolherModo('entrega')}>
              Não estou na loja
            </button>
          </div>
        )}

        {!recebimento.mesaFixa && (
        <fieldset className="campo">
          <legend className="campo__rotulo">Cidade</legend>
          <div className="cidades">
            {cidades.map((c) => (
              <button
                key={c.nome}
                type="button"
                className={`cidade-btn ${cliente.cidade === c.nome ? 'cidade-btn--ativa' : ''}`}
                aria-pressed={cliente.cidade === c.nome}
                onClick={() => onEscolherCidade(c.nome)}
              >
                <span>{c.nome}</span>
                {!c.aberta && <small className="cidade-btn__fechado">Fechado agora</small>}
              </button>
            ))}
          </div>
        </fieldset>
        )}

        {loja && !recebimento.mesaFixa && modosDisponiveis.length > 1 && (
          <fieldset className="campo">
            <legend className="campo__rotulo">Como você quer receber?</legend>
            <div className="modos" role="radiogroup">
              {modosDisponiveis.map((id) => {
                const { nome, Icone } = MODOS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={modo === id}
                    className={`modo-btn ${modo === id ? 'modo-btn--ativo' : ''}`}
                    onClick={() => escolherModo(id)}
                  >
                    <Icone size={20} aria-hidden="true" />
                    <span>{nome}</span>
                  </button>
                );
              })}
            </div>
            {modo === 'retirada' && (
              <p className="modo-info">Retire no balcão da loja de {loja.nome}. Sem taxa de entrega.</p>
            )}
          </fieldset>
        )}

        <div className="campo">
          <label className="campo__rotulo" htmlFor="telefone">
            WhatsApp {naMesa && <span className="campo__opcional">(opcional, para acompanhar o pedido)</span>}
            {buscando && <span className="campo__status">buscando seu cadastro…</span>}
          </label>
          <div className="campo__input-wrap">
            <Phone size={18} className="campo__icone" aria-hidden="true" />
            <input
              id="telefone"
              className="input input--icone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(62) 99999-9999"
              value={cliente.telefone}
              onChange={alterarTelefone}
            />
          </div>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="nome">
            Seu nome {naMesa && <span className="campo__opcional">(opcional)</span>}
          </label>
          <div className="campo__input-wrap">
            <User size={18} className="campo__icone" aria-hidden="true" />
            <input
              id="nome"
              className="input input--icone"
              type="text"
              autoComplete="name"
              placeholder="Nome completo"
              maxLength={200}
              value={cliente.nome}
              onChange={atualizar('nome')}
            />
          </div>
        </div>

        {modo === 'entrega' && (
        <>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="rua">Rua e número</label>
          <div className="campo__input-wrap">
            <MapPin size={18} className="campo__icone" aria-hidden="true" />
            <input
              id="rua"
              className="input input--icone"
              type="text"
              autoComplete="street-address"
              placeholder="Ex.: Rua 10, Qd 5, Lt 2, Setor Central"
              maxLength={350}
              value={cliente.ruaNumero}
              onChange={atualizar('ruaNumero')}
            />
          </div>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="referencia">
            Ponto de referência <span className="campo__opcional">(opcional)</span>
          </label>
          <div className="campo__input-wrap">
            <Navigation size={18} className="campo__icone" aria-hidden="true" />
            <input
              id="referencia"
              className="input input--icone"
              type="text"
              placeholder="Ex.: casa azul ao lado da igreja"
              maxLength={250}
              value={cliente.referencia}
              onChange={atualizar('referencia')}
            />
          </div>
        </div>
        </>
        )}

        {erro && <p className="erro-inline" role="alert">{erro}</p>}

        <button type="submit" className="btn-primario">
          Ver cardápio <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
