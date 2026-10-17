import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Bike, CameraOff, X } from 'lucide-react';
import { mudarStatusPedido, saidaPorQrCode } from './adminApi';

// Lê o QR Code da comanda ("SZ:1:104") e já marca o pedido como "Em rota de entrega".
// Fica aberto para ler vários pedidos seguidos (ex.: motoboy levando mais de um).
export default function LeitorQr({ token, onLido, onFechar, onSessaoExpirada }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ultimo = useRef({ codigo: '', quando: 0 });
  const processando = useRef(false);
  const [erroCamera, setErroCamera] = useState('');
  const [resultado, setResultado] = useState(null); // { tipo: 'ok' | 'erro', texto }
  const [numero, setNumero] = useState('');

  const mostrar = (tipo, texto) => {
    setResultado({ tipo, texto });
    if (navigator.vibrate) navigator.vibrate(tipo === 'ok' ? 120 : [80, 60, 80]);
  };

  const registrar = async (acao) => {
    processando.current = true;
    try {
      const r = await acao();
      mostrar('ok', `Pedido nº ${r.id}${r.cliente ? ` (${r.cliente})` : ''} saiu para entrega.`);
      onLido();
    } catch (err) {
      if (err.status === 401) onSessaoExpirada();
      else mostrar('erro', err.message);
    } finally {
      // pequena pausa antes de aceitar a próxima leitura
      setTimeout(() => (processando.current = false), 1500);
    }
  };

  useEffect(() => {
    let stream;
    let quadro;
    let ativo = true;

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
        if (!ativo) return stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        ler();
      } catch (err) {
        setErroCamera(
          err?.name === 'NotAllowedError'
            ? 'A câmera foi bloqueada. Libere o acesso à câmera nas configurações do navegador.'
            : 'Não consegui abrir a câmera deste aparelho. Use o campo abaixo para digitar o número.'
        );
      }
    })();

    return () => {
      ativo = false;
      clearTimeout(quadro);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const enviarNumero = (e) => {
    e.preventDefault();
    const id = Number(numero.replace(/\D/g, ''));
    if (!id) return;
    setNumero('');
    registrar(async () => {
      await mudarStatusPedido(token, id, 'Em rota de entrega');
      return { id };
    });
  };

  return (
    <div className="adm-qr" role="dialog" aria-modal="true" aria-label="Ler QR Code do pedido">
      <div className="adm-qr__topo">
        <strong>Saída para entrega</strong>
        <button type="button" className="adm-btn adm-btn--icone" onClick={onFechar} aria-label="Fechar leitor">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="adm-qr__camera">
        {erroCamera ? (
          <div className="adm-qr__sem-camera">
            <CameraOff size={32} aria-hidden="true" />
            <p>{erroCamera}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted />
            <div className="adm-qr__mira" aria-hidden="true" />
          </>
        )}
        <canvas ref={canvasRef} hidden />
      </div>

      <p className="adm-qr__ajuda">Aponte para o QR Code da comanda. Pode ler vários pedidos seguidos.</p>

      {resultado && (
        <p className={resultado.tipo === 'ok' ? 'adm-ok' : 'adm-erro'} role="status">
          {resultado.tipo === 'ok' && <Bike size={16} aria-hidden="true" />} {resultado.texto}
        </p>
      )}

      <form className="adm-qr__manual" onSubmit={enviarNumero}>
        <input
          inputMode="numeric"
          placeholder="Ou digite o nº do pedido"
          aria-label="Número do pedido"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
        />
        <button type="submit" className="adm-btn adm-btn--rota">
          Saiu
        </button>
      </form>
    </div>
  );
}
