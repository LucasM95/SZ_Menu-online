import { MapPin } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function Header({ cliente, recebimento, mostrarCliente }) {
  const primeiroNome = cliente.nome.trim().split(' ')[0];
  const naMesa = recebimento?.modo === 'mesa';
  const quem = naMesa ? `Mesa ${recebimento.mesa}` : primeiroNome;

  return (
    <header className="header">
      <div className="header__inner">
        <div className="header__marca">
          <img
            src={logoImg}
            alt=""
            className="header__logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <h1 className="header__titulo">Sanduba do Zé</h1>
            <p className="header__slogan">Todo Mundo é Zé</p>
          </div>
        </div>

        {mostrarCliente && quem && (
          <div className="header__cliente">
            <MapPin size={14} aria-hidden="true" />
            <span>
              {quem}, {cliente.cidade}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
