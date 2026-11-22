import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Bike, Camera, CameraOff, Keyboard, X } from 'lucide-react';
import { mudarStatusPedido, saidaPorQrCode } from './adminApi';

// Cada aparelho lembra como prefere marcar a saída (celular com câmera ruim abre direto em "digitar")
const CHAVE_MODO = 'sdz-leitor-modo';
const lerModo = () => {
  try {
    return localStorage.getItem(CHAVE_MODO) === 'digitar' ? 'digitar' : 'camera';
  } catch {
    return 'camera';
  }
};
const salvarModo = (modo) => {
  try {
    localStorage.setItem(CHAVE_MODO, modo);
  } catch {
    /* navegador sem armazenamento: só não lembra */
  }
};

// Saída para entrega: lê o QR Code da comanda ("SZ:1:104" do site, "SZP:1:5002" do caixa)
// ou deixa digitar o número do pedido. Fica aberto para marcar vários pedidos seguidos.
export default function LeitorQr({ token, onLido, onFechar, onSessaoExpirada }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const campoRef = useRef(null);
  const ultimo = useRef({ codigo: '', quando: 0 });
  const processando = useRef(false);
  const [modo, setModo] = useState(lerModo);
  const [erroCamera, setErroCamera] = useState('');
  const [resultado, setResultado] = useState(null); // { tipo: 'ok' | 'erro', texto }
  const [numero, setNumero] = useState('');
  const [origem, setOrigem] = useState('site'); // 'site' ou 'caixa' (pedido lançado no PDV)
  const [enviando, setEnviando] = useState(false);

  const trocarModo = (novo) => {
    setModo(novo);
    salvarModo(novo);
    setResultado(null);
  };

  const mostrar = (tipo, texto) => {
    setResultado({ tipo, texto });
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 120 : [80, 60, 80]);
  };

  const registrar = async (acao) => {
    processando.current = true;
    setEnviando(true);
    try {
      const r = await acao();
      if (r.origem === 'pdv') {
        // Pedido lançado no caixa: a nuvem só avisa o PDV, que muda o status e grava o repasse
        mostrar('ok', `Pedido nº ${r.id} do caixa: saída enviada ao PDV${r.entregador ? ` (${r.entregador})` : ''}.`);
      } else {
        mostrar('ok', `Pedido nº ${r.id}${r.cliente ? ` (${r.cliente})` : ''} saiu para entrega.`);
      }
      onLido();
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else mostrar('erro', err.message);
    } finally {
      setEnviando(false);
      // pequena pausa antes de aceitar a próxima leitura da câmera
      setTimeout(() => (processando.current = false), 1500);
    }
  };

  // Câmera: só liga no modo "Ler QR Code"
  useEffect(() => {
    if (modo !== 'camera') return undefined;
    let stream;
    let quadro;
    let ativo = true;
    setErroCamera('');

    const ler = () => {
      if (!ativo) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !processando.current) {
        const escala = Math.min(1, 640 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * escala);
        canvas.height = Math.round(video.videoHeight * escala);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        const agora = Date.now();
        // ignora o mesmo código lido de novo nos próximos 5 segundos
        if (qr?.data && !(qr.data === ultimo.current.codigo && agora - ultimo.current.quando < 5000)) {
          ultimo.current = { codigo: qr.data, quando: agora };
          registrar(() => saidaPorQrCode(token, qr.data));
        }
      }
      quadro = setTimeout(() => requestAnimationFrame(ler), 200);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!ativo) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        ler();
      } catch (err) {
        if (!ativo) return;
        // Sem câmera: passa para "digitar" e este aparelho já abre assim da próxima vez
        setErroCamera(
          err?.name === 'NotAllowedError'
            ? 'A câmera foi bloqueada neste navegador. Digite o número do pedido.'
            : 'Não consegui abrir a câmera deste aparelho. Digite o número do pedido.'
        );
        setModo('digitar');
        salvarModo('digitar');
      }
    })();

    return () => {
      ativo = false;
      clearTimeout(quadro);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, modo]);

  // No modo digitar, o campo já abre com o teclado
  useEffect(() => {
    if (modo === 'digitar') campoRef.current?.focus();
  }, [modo]);

  const enviarNumero = (e) => {
    e.preventDefault();
    const id = Number(numero.replace(/\D/g, ''));
    if (!id || enviando) return;
    // "P5002" também vale como pedido do caixa, como antes
    const doCaixa = origem === 'caixa' || /^\s*p/i.test(numero);
    setNumero('');
    registrar(async () => {
      if (doCaixa) return saidaPorQrCode(token, `P${id}`);
      await mudarStatusPedido(token, id, 'Em rota de entrega');
      return { id };
    });
    campoRef.current?.focus();
  };

  return (
    <div className="adm-qr" role="dialog" aria-modal="true" aria-label="Saída para entrega">
      <div className="adm-qr__topo">
        <strong>Saída para entrega</strong>
        <button type="button" className="adm-btn adm-btn--icone" onClick={onFechar} aria-label="Fechar leitor">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="adm-qr__modos" role="tablist" aria-label="Como marcar a saída">
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'camera'}
          className={`adm-qr__modo ${modo === 'camera' ? 'adm-qr__modo--ativo' : ''}`}
          onClick={() => trocarModo('camera')}
        >
          <Camera size={18} aria-hidden="true" /> Ler QR Code
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'digitar'}
          className={`adm-qr__modo ${modo === 'digitar' ? 'adm-qr__modo--ativo' : ''}`}
          onClick={() => trocarModo('digitar')}
        >
          <Keyboard size={18} aria-hidden="true" /> Digitar número
        </button>
      </div>

      {modo === 'camera' ? (
        <>
          <div className="adm-qr__camera">
            <video ref={videoRef} playsInline muted />
            <div className="adm-qr__mira" aria-hidden="true" />
            <canvas ref={canvasRef} hidden />
          </div>
          <p className="adm-qr__ajuda">Aponte para o QR Code da comanda. Pode ler vários pedidos seguidos.</p>
        </>
      ) : (
        <form className="adm-qr__digitar" onSubmit={enviarNumero}>
          {erroCamera && (
            <p className="adm-qr__aviso-camera">
              <CameraOff size={16} aria-hidden="true" /> {erroCamera}
            </p>
          )}
          <div className="adm-qr__origem" role="radiogroup" aria-label="De onde é o pedido">
            <button
              type="button"
              role="radio"
              aria-checked={origem === 'site'}
              className={`adm-qr__origem-btn ${origem === 'site' ? 'adm-qr__origem-btn--ativo' : ''}`}
              onClick={() => setOrigem('site')}
            >
              Pedido do site
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={origem === 'caixa'}
              className={`adm-qr__origem-btn ${origem === 'caixa' ? 'adm-qr__origem-btn--ativo' : ''}`}
              onClick={() => setOrigem('caixa')}
            >
              Pedido do caixa
            </button>
          </div>
          <label htmlFor="adm-qr-numero" className="adm-qr__rotulo">
            Número do pedido {origem === 'caixa' ? 'no caixa (PDV)' : 'do site'}
          </label>
          <input
            id="adm-qr-numero"
            ref={campoRef}
            className="adm-qr__numero"
            inputMode="numeric"
            autoComplete="off"
            placeholder={origem === 'caixa' ? 'Ex.: 5002' : 'Ex.: 104'}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
          <button type="submit" className="adm-btn adm-btn--rota adm-qr__enviar" disabled={enviando || !numero.trim()}>
            <Bike size={18} aria-hidden="true" /> {enviando ? 'Enviando…' : 'Saiu para entrega'}
          </button>
          <p className="adm-qr__ajuda">O número está no topo da comanda. Pode marcar vários pedidos seguidos.</p>
        </form>
      )}

      {resultado && (
        <p className={resultado.tipo === 'ok' ? 'adm-ok' : 'adm-erro'} role="status">
          {resultado.tipo === 'ok' && <Bike size={16} aria-hidden="true" />} {resultado.texto}
        </p>
      )}
    </div>
  );
}
