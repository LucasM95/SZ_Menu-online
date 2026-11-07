import { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { listarEntregadores, salvarEntregador } from './adminApi';

/**
 * Qual usuário do painel é qual entregador (funcionário do PDV).
 * Quando esse usuário lê o QR Code da comanda, o PDV grava o repasse do entregador.
 */
export default function Entregadores({ token, onSessaoExpirada }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState('');

  useEffect(() => {
    listarEntregadores(token)
      .then(setDados)
      .catch((err) => (err.status === 401 ? onSessaoExpirada() : setErro(err.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const mudar = async (login, valor) => {
    const matricula = valor === '' ? null : Number(valor);
    setSalvando(login);
    setErro('');
    try {
      await salvarEntregador(token, login, matricula);
      setDados((d) => ({ ...d, usuarios: d.usuarios.map((u) => (u.login === login ? { ...u, matricula } : u)) }));
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else setErro(err.message);
    } finally {
      setSalvando('');
    }
  };

  if (!dados) return erro ? <p className="adm-erro">{erro}</p> : null;

  return (
    <section className="adm-integ adm-entregadores">
      <div className="adm-integ__topo">
        <Bike size={20} aria-hidden="true" />
        <strong>Entregadores</strong>
      </div>
      <p className="adm-dica">
        Diga qual funcionário é cada usuário do painel. Quando o entregador, logado com o usuário dele, ler o QR Code
        da comanda, o PDV registra quem levou o pedido e o repasse (valor das Configurações do PDV).
      </p>
      {dados.funcionarios.length === 0 ? (
        <p className="adm-dica">
          Nenhum funcionário recebido ainda. No PDV: menu de integrações › Sincronizar Cardápio Online › aba
          Funcionários › Enviar.
        </p>
      ) : (
        <ul className="adm-entregadores__lista">
          {dados.usuarios.map((u) => (
            <li key={u.login}>
              <label htmlFor={`ent-${u.login}`}>
                <strong>{u.nome}</strong>
                <span className="adm-suave"> ({u.login})</span>
              </label>
              <select
                id={`ent-${u.login}`}
                value={u.matricula ?? ''}
                disabled={salvando === u.login}
                onChange={(e) => mudar(u.login, e.target.value)}
              >
                <option value="">Não é entregador</option>
                {dados.funcionarios.map((f) => (
                  <option key={f.matricula} value={f.matricula}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
      {erro && <p className="adm-erro">{erro}</p>}
    </section>
  );
}
