import { useEffect, useState } from 'react';
import { Check, Copy, MapPin, Plus, X } from 'lucide-react';
import { formatarMoeda, mascaraHora, mascaraMoeda, mascaraTelefone, parseMoeda } from '../utils';
import { listarLojas, salvarLoja } from './adminApi';

const DIAS = [
  ['seg', 'Segunda'],
  ['ter', 'Terça'],
  ['qua', 'Quarta'],
  ['qui', 'Quinta'],
  ['sex', 'Sexta'],
  ['sab', 'Sábado'],
  ['dom', 'Domingo'],
];
const PADRAO = { abre: '18:00', fecha: '23:30' };

const horarioVazio = () => Object.fromEntries(DIAS.map(([d]) => [d, { ...PADRAO }]));

function paraFormulario(loja) {
  return {
    idempresa: loja?.idempresa,
    cidade: loja?.cidade || '',
    wpp: mascaraTelefone(loja?.wpp || ''),
    taxa: loja ? mascaraMoeda(Math.round((loja.taxaentrega || 0) * 100)) : '',
    ativo: loja?.ativo ?? true,
    fechado_temporariamente: loja?.fechado_temporariamente ?? false,
    temHorario: Boolean(loja?.horario),
    horario: loja?.horario ? { ...horarioVazio(), ...loja.horario } : horarioVazio(),
    // dias fechados ficam guardados como null; no formulário viram "aberto: false"
    abertos: Object.fromEntries(DIAS.map(([d]) => [d, loja?.horario ? Boolean(loja.horario[d]) : true])),
  };
}

function EditorLoja({ loja, token, onSalvo, onCancelar, onSessaoExpirada }) {
  const [f, setF] = useState(() => paraFormulario(loja));
  const [status, setStatus] = useState({ tipo: '', texto: '' });
  const [ocupado, setOcupado] = useState(false);

  const mudar = (campo, valor) => setF((x) => ({ ...x, [campo]: valor }));
  const mudarHora = (dia, campo, valor) =>
    setF((x) => ({ ...x, horario: { ...x.horario, [dia]: { ...(x.horario[dia] || PADRAO), [campo]: valor } } }));

  const copiarSegunda = () =>
    setF((x) => ({
      ...x,
      horario: Object.fromEntries(DIAS.map(([d]) => [d, { ...x.horario.seg }])),
      abertos: Object.fromEntries(DIAS.map(([d]) => [d, x.abertos.seg])),
    }));

  const salvar = async () => {
    setOcupado(true);
    setStatus({ tipo: '', texto: '' });
    try {
      const taxa = parseMoeda(f.taxa);
      const corpo = {
        idempresa: f.idempresa,
        cidade: f.cidade.trim(),
        wpp: f.wpp,
        taxaentrega: Number.isNaN(taxa) ? 0 : taxa,
        ativo: f.ativo,
        fechado_temporariamente: f.fechado_temporariamente,
        horario: f.temHorario
          ? Object.fromEntries(DIAS.map(([d]) => [d, f.abertos[d] ? f.horario[d] : null]))
          : null,
      };
      const salvo = await salvarLoja(token, corpo);
      setStatus({ tipo: 'ok', texto: 'Salvo! Já vale no site.' });
      onSalvo(salvo);
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else setStatus({ tipo: 'erro', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  const id = f.idempresa || 'nova';

  return (
    <div className="adm-editor adm-editor--loja">
      <div className="adm-linha adm-linha--loja">
        <div>
          <label htmlFor={`c-${id}`}>Cidade</label>
          <input id={`c-${id}`} value={f.cidade} maxLength={100} onChange={(e) => mudar('cidade', e.target.value)} />
        </div>
        <div>
          <label htmlFor={`w-${id}`}>WhatsApp da loja</label>
          <input
            id={`w-${id}`}
            type="tel"
            inputMode="numeric"
            placeholder="(62) 99999-9999"
            value={f.wpp}
            onChange={(e) => mudar('wpp', mascaraTelefone(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor={`t-${id}`}>Taxa de entrega (R$)</label>
          <input
            id={`t-${id}`}
            inputMode="numeric"
            placeholder="0,00"
            value={f.taxa}
            onChange={(e) => mudar('taxa', mascaraMoeda(e.target.value))}
          />
        </div>
      </div>

      <label className="adm-check">
        <input type="checkbox" checked={f.ativo} onChange={(e) => mudar('ativo', e.target.checked)} />
        Atender esta cidade no site
      </label>
      <label className="adm-check">
        <input
          type="checkbox"
          checked={f.fechado_temporariamente}
          onChange={(e) => mudar('fechado_temporariamente', e.target.checked)}
        />
        Fechar agora, temporariamente (ex.: imprevisto, chuva forte)
      </label>

      <div className="adm-horario">
        <label className="adm-check">
          <input type="checkbox" checked={f.temHorario} onChange={(e) => mudar('temHorario', e.target.checked)} />
          Usar horário de atendimento
        </label>
        {!f.temHorario && <p className="adm-dica">Sem horário definido, o site aceita pedidos a qualquer hora.</p>}

        {f.temHorario && (
          <>
            <ul className="adm-horario__dias">
              {DIAS.map(([d, nome]) => (
                <li key={d} className={f.abertos[d] ? '' : 'adm-horario__fechado'}>
                  <label className="adm-horario__dia">
                    <input
                      type="checkbox"
                      checked={f.abertos[d]}
                      onChange={(e) => setF((x) => ({ ...x, abertos: { ...x.abertos, [d]: e.target.checked } }))}
                    />
                    {nome}
                  </label>
                  {f.abertos[d] ? (
                    <span className="adm-horario__horas">
                      <input
                        inputMode="numeric"
                        placeholder="00:00"
                        maxLength={5}
                        aria-label={`${nome}: abre`}
                        value={f.horario[d]?.abre || ''}
                        onChange={(e) => mudarHora(d, 'abre', mascaraHora(e.target.value))}
                      />
                      <span>às</span>
                      <input
                        inputMode="numeric"
                        placeholder="00:00"
                        maxLength={5}
                        aria-label={`${nome}: fecha`}
                        value={f.horario[d]?.fecha || ''}
                        onChange={(e) => mudarHora(d, 'fecha', mascaraHora(e.target.value))}
                      />
                    </span>
                  ) : (
                    <span className="adm-suave">Fechado</span>
                  )}
                </li>
              ))}
            </ul>
            <button type="button" className="adm-link" onClick={copiarSegunda}>
              <Copy size={14} aria-hidden="true" /> Usar o horário de segunda em todos os dias
            </button>
            <p className="adm-dica">
              Se fechar depois da meia-noite, coloque o horário normalmente (ex.: 18:00 às 01:00).
            </p>
          </>
        )}
      </div>

      {status.texto && (
        <p className={status.tipo === 'erro' ? 'adm-erro' : 'adm-ok'} role="status">
          {status.texto}
        </p>
      )}

      <div className="adm-editor__acoes">
        <button type="button" className="adm-btn" onClick={onCancelar} disabled={ocupado}>
          <X size={16} aria-hidden="true" /> Fechar
        </button>
        <button type="button" className="adm-btn adm-btn--primario" onClick={salvar} disabled={ocupado}>
          <Check size={16} aria-hidden="true" /> Salvar
        </button>
      </div>
    </div>
  );
}

function resumoHorario(h) {
  if (!h) return 'Aceita pedidos a qualquer hora';
  const abertos = DIAS.filter(([d]) => h[d]);
  if (!abertos.length) return 'Sem dias de atendimento';
  return `${abertos.length} dia${abertos.length > 1 ? 's' : ''} por semana`;
}

export default function Lojas({ token, filial, onSessaoExpirada }) {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null); // idempresa ou 'nova'

  useEffect(() => {
    listarLojas(token)
      .then(setLojas)
      .catch((err) => (err.status === 401 ? onSessaoExpirada() : setErro(err.message)))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const aoSalvar = (salva) => {
    setLojas((lista) => {
      const existe = lista.some((l) => l.idempresa === salva.idempresa);
      return existe ? lista.map((l) => (l.idempresa === salva.idempresa ? salva : l)) : [...lista, salva];
    });
    setAberta(salva.idempresa);
  };

  if (carregando) return <p className="adm-suave">Carregando lojas…</p>;
  if (erro) return <p className="adm-erro">{erro}</p>;

  return (
    <section className="adm-grupo">
      <p className="adm-suave adm-explica">
        Cidades atendidas pela filial {filial}: WhatsApp, taxa de entrega e horário de atendimento. Fora do horário, o
        site mostra o cardápio mas não aceita pedidos.
      </p>
      <ul>
        {lojas.map((l) => (
          <li key={l.idempresa} className={`adm-item ${aberta === l.idempresa ? 'adm-item--aberto' : ''}`}>
            <button
              type="button"
              className="adm-item__resumo"
              onClick={() => setAberta(aberta === l.idempresa ? null : l.idempresa)}
              aria-expanded={aberta === l.idempresa}
            >
              <div className="adm-foto adm-foto--icone">
                <MapPin size={20} aria-hidden="true" />
              </div>
              <div className="adm-item__texto">
                <span className="adm-item__nome">{l.cidade}</span>
                <span className="adm-suave">
                  {mascaraTelefone(l.wpp)} · entrega {formatarMoeda(l.taxaentrega)} · {resumoHorario(l.horario)}
                </span>
                <span className="adm-tags">
                  {!l.ativo && <span className="adm-tag adm-tag--cinza">Não atendida no site</span>}
                  {l.fechado_temporariamente && <span className="adm-tag adm-tag--aviso">Fechada temporariamente</span>}
                </span>
              </div>
            </button>
            {aberta === l.idempresa && (
              <EditorLoja
                loja={l}
                token={token}
                onSalvo={aoSalvar}
                onCancelar={() => setAberta(null)}
                onSessaoExpirada={onSessaoExpirada}
              />
            )}
          </li>
        ))}
        {aberta === 'nova' && (
          <li className="adm-item adm-item--aberto">
            <EditorLoja
              loja={null}
              token={token}
              onSalvo={aoSalvar}
              onCancelar={() => setAberta(null)}
              onSessaoExpirada={onSessaoExpirada}
            />
          </li>
        )}
      </ul>
      {aberta !== 'nova' && (
        <button type="button" className="adm-btn adm-adicionar" onClick={() => setAberta('nova')}>
          <Plus size={16} aria-hidden="true" /> Adicionar cidade
        </button>
      )}
    </section>
  );
}
