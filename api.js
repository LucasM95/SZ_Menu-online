// Em produção (Vercel), defina VITE_API_URL nas variáveis de ambiente do projeto,
// por exemplo: https://sanduba-api.onrender.com/api
// Localmente, sem a variável, usa o backend na porta 8080.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');

function mensagemDeErro(data, status) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  // Erros de validação do FastAPI chegam como lista
  if (Array.isArray(detail)) return 'Alguns dados do pedido estão inválidos. Confira e tente de novo.';
  return `Erro inesperado no servidor (${status}).`;
}

// 60s cobre o "acordar" do Render no plano gratuito; depois disso, desiste e mostra erro
const TEMPO_LIMITE_MS = 60000;

export async function request(path, { method = 'GET', body, token } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controle.signal,
    });
  } catch (err) {
    console.error(`[API] Falha em ${method} ${API_URL}${path}:`, err);
    if (err.name === 'AbortError') {
      throw new Error('O servidor demorou demais para responder. Tente novamente.');
    }
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  } finally {
    clearTimeout(timer);
  }

  // 404 na busca de cliente é normal (cliente novo); os demais erros vão para o console
  if (!res.ok && res.status !== 404) console.error(`[API] ${method} ${path} respondeu ${res.status}`);

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(mensagemDeErro(data, res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

// Cidades atendidas (cada uma pertence a uma filial)
export async function carregarEmpresas() {
  const empresas = await request('/empresas');
  return empresas.map((e) => ({
    nome: e.cidade,
    taxa: e.taxa,
    filial: e.filial,
    whatsapp: e.whatsapp,
    aberta: e.aberta !== false,
    mensagem: e.mensagem || '',
    horarios: e.horarios || [],
    permiteRetirada: Boolean(e.permiteRetirada), // retirada no balcão
    mesas: e.mesas || 0, // 0 = sem pedido na mesa
  }));
}

// Cardápio completo de uma filial: categorias, produtos, adicionais e pagamentos
export function carregarCardapio(filial) {
  return request(`/cardapio/${filial}`);
}

export async function buscarCliente(digitos) {
  try {
    return await request(`/clientes/${digitos}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export function enviarPedido(payload) {
  return request('/pedidos', { method: 'POST', body: payload });
}

// Pedidos em curso de um WhatsApp (status, itens e total; sem dados pessoais)
// incluir: id de um pedido para trazer mesmo depois de entregue ou cancelado
export async function acompanharPedidos(digitos, incluir) {
  try {
    return await request(`/pedidos/acompanhar/${digitos}${incluir ? `?pedido=${incluir}` : ''}`);
  } catch {
    return []; // a consulta é um extra: se falhar, o site segue normal
  }
}
