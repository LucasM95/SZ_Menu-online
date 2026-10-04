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

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(mensagemDeErro(data, res.status));
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function carregarCardapio() {
  const [categorias, produtos, adicionais, tiposPagamento, cidades] = await Promise.all([
    request('/categorias'),
    request('/produtos'),
    request('/produtos/adicionais'),
    request('/tipos-pagamento'),
    request('/cidades'),
  ]);
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
