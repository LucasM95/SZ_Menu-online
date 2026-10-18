import { request } from '../api';

const CHAVE = 'sdz-admin';

// Sessão só desta aba: fecha a aba, sai do painel
export function lerSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE)) || null;
  } catch {
    return null;
  }
}

export function salvarSessao(sessao) {
  try {
    if (sessao) sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* navegador sem armazenamento: segue só na memória */
  }
}

export const entrar = (filial, login, senha) =>
  request('/admin/login', { method: 'POST', body: { filial, login, senha } });

export const listarProdutos = (token) => request('/admin/produtos', { token });

export const salvarProduto = (token, cod, dados) =>
  request(`/admin/produtos/${cod}`, { method: 'PUT', body: dados, token });

export const enviarFoto = (token, cod, imagem) =>
  request(`/admin/produtos/${cod}/foto`, { method: 'POST', body: { imagem }, token });

export const removerFoto = (token, cod) => request(`/admin/produtos/${cod}/foto`, { method: 'DELETE', token });

// Reduz a foto no próprio aparelho antes de enviar (upload mais rápido no 4G).
// PNG mantém a transparência; o resto vira JPEG. O servidor converte para WebP.
export function prepararImagem(arquivo, ladoMax = 1600) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Esse arquivo não parece ser uma imagem.'));
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const png = arquivo.type === 'image/png' || arquivo.type === 'image/webp';
        resolve(canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}

export const listarPromocoes = (token) => request('/admin/promocoes', { token });

export const salvarPromocao = (token, id, dados) =>
  request(`/admin/promocoes/${id}`, { method: 'PUT', body: dados, token });

export const enviarFotoPromocao = (token, id, imagem) =>
  request(`/admin/promocoes/${id}/foto`, { method: 'POST', body: { imagem }, token });

export const removerFotoPromocao = (token, id) => request(`/admin/promocoes/${id}/foto`, { method: 'DELETE', token });

export const listarPedidos = (token) => request('/admin/pedidos', { token });

export const mudarStatusPedido = (token, id, status) =>
  request(`/admin/pedidos/${id}/status`, { method: 'PUT', body: { status }, token });

export const saidaPorQrCode = (token, codigo) =>
  request('/admin/pedidos/qrcode', { method: 'POST', body: { codigo }, token });

export const listarLojas = (token) => request('/admin/empresas', { token });

export const salvarLoja = (token, loja) =>
  loja.idempresa
    ? request(`/admin/empresas/${loja.idempresa}`, { method: 'PUT', body: loja, token })
    : request('/admin/empresas', { method: 'POST', body: loja, token });

export const situacaoIntegracao = (token) => request('/admin/integracao', { token });

export const gerarChaveIntegracao = (token) => request('/admin/integracao/chave', { method: 'POST', token });
