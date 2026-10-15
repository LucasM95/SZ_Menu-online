// Em produção (Vercel), defina VITE_API_URL nas variáveis de ambiente do projeto,
// por exemplo: https://sanduba-api.onrender.com/api
// Localmente, sem a variável, usa o backend na porta 8080.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');

function mensagemDeErro(data, status) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  // Erros de validação do FastAPI chegam como lista
  if (Array.isArray(detail)) return 'Alguns dados do pedido estão inválidos. Confira e tente de novo.';
  return `Erro inesperado no servidor (${status}).`;
}

// 60s cobre o "acordar" do Render no plano gratuito; depois disso, desiste e mostra erro
const TEMPO_LIMITE_MS = 60000;

async function request(path, { method = 'GET', body } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

  if (!res.ok) console.error(`[API] ${method} ${path} respondeu ${res.status}`);

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(mensagemDeErro(data, res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function carregarCardapio() {
  const [categorias, produtos, adicionais, tiposPagamento, empresas] = await Promise.all([
    request('/categorias'),
    request('/produtos'),
    request('/produtos/adicionais'),
    request('/tipos-pagamento'),
    request('/empresas'),
  ]);
  // Cada filial atende uma cidade; o resto do app trabalha com "cidades"
  const cidades = empresas.map((e) => ({
    nome: e.cidade,
    taxa: e.taxa,
    filial: e.filial,
    whatsapp: e.whatsapp,
  }));
  return { categorias, produtos, adicionais, tiposPagamento, cidades };
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
