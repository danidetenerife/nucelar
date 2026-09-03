import jsQR from 'jsqr';
import { Camera, RefreshCw, X } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

import { Button } from '@nuclearplayer/ui';

type QrScannerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
};

export const QrScannerModal: FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
      return;
    }

    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanLoop();
        }
      } catch {
        setError('No se pudo acceder a la cámara. Por favor concede permisos de cámara.');
      }
    };

    const scanLoop = () => {
      if (!videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const raw = code.data.trim();
          let parsedUrl = raw;

          if (raw.startsWith('aurora://')) {
            try {
              const urlObj = new URL(raw);
              const hostParam = urlObj.searchParams.get('host') || urlObj.searchParams.get('url');
              const portParam = urlObj.searchParams.get('port') || '4120';
              if (hostParam) {
                parsedUrl = hostParam.startsWith('http') ? hostParam : `http://${hostParam}:${portParam}`;
              }
            } catch {
              // fallback to raw
            }
          }

          if (parsedUrl) {
            onScan(parsedUrl);
            onClose();
            return;
          }
        }
      }

      animFrameId.current = requestAnimationFrame(scanLoop);
    };

    void startCamera();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-background-secondary/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-2">
          <Camera className="text-primary size-5" />
          <h2 className="text-base font-bold">Escanear QR de Aurora PC</h2>
        </div>
        <Button size="icon-sm" variant="text" onClick={onClose} className="text-white">
          <X size={20} />
        </Button>
      </div>

      {/* Camera View / Scanner box */}
      <div className="relative flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-xs">
            <p className="text-sm text-accent-red font-medium">{error}</p>
            <Button
              variant="default"
              onClick={() => {
                setError(null);
              }}
              className="gap-2"
            >
              <RefreshCw size={16} /> Reintentar
            </Button>
          </div>
        ) : (
          <div className="relative w-72 h-72 rounded-2xl overflow-hidden border-2 border-primary shadow-[0_0_20px_rgba(255,105,180,0.5)]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning line animation */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-0.5 bg-primary shadow-[0_0_8px_#ff69b4] animate-pulse" />
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-white rounded-br" />
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-center text-zinc-400 max-w-xs">
          Apunta con la cámara al código QR que aparece en tu PC (icono de código QR en la barra superior de Aurora).
        </p>
      </div>
    </div>
  );
};
