import { useRef, useState } from 'react';
import { ArrowRight, MapPin, Phone, Navigation, User } from 'lucide-react';
import logoImg from '../assets/logo.png';
import { buscarCliente } from '../api';
import { apenasDigitos, formatarMoeda, mascaraTelefone } from '../utils';

export default function Identificacao({ cliente, setCliente, cidades, onAvancar }) {
  const [buscando, setBuscando] = useState(false);
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
    if (apenasDigitos(cliente.telefone).length !== 11) {
      setErro('Digite o WhatsApp completo com DDD, por exemplo (62) 99999-9999.');
      return;
    }
    if (cliente.nome.trim().length < 2) {
      setErro('Digite seu nome.');
      return;
    }
    if (cliente.ruaNumero.trim().length < 3) {
      setErro('Digite a rua e o número para a entrega.');
      return;
    }
    if (!cliente.cidade) {
      setErro('Escolha sua cidade.');
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
        <h2 className="titulo-secao">Onde vamos entregar?</h2>
        <p className="texto-suave">Seus dados ficam salvos neste aparelho para o próximo pedido.</p>
      </div>

      <form onSubmit={avancar} className="formulario" noValidate>
        <fieldset className="campo">
          <legend className="campo__rotulo">Cidade</legend>
          <div className="cidades">
            {cidades.map((c) => (
              <button
                key={c.nome}
                type="button"
                className={`cidade-btn ${cliente.cidade === c.nome ? 'cidade-btn--ativa' : ''}`}
                aria-pressed={cliente.cidade === c.nome}
                onClick={() => setCliente((cl) => ({ ...cl, cidade: c.nome }))}
              >
                <span>{c.nome}</span>
                <small>Entrega {formatarMoeda(c.taxa)}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="telefone">
            WhatsApp {buscando && <span className="campo__status">buscando seu cadastro…</span>}
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
          <label className="campo__rotulo" htmlFor="nome">Seu nome</label>
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

        {erro && <p className="erro-inline" role="alert">{erro}</p>}

        <button type="submit" className="btn-primario">
          Ver cardápio <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
