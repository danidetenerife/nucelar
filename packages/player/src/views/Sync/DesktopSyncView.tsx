import { CheckCircle2, Copy, Laptop, RefreshCw, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { FC, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button } from '@nuclearplayer/ui';

import { invoke } from '@tauri-apps/api/core';

type SyncServerInfo = {
  ip: string;
  port: number;
};

export const DesktopSyncView: FC = () => {
  const [serverInfo, setServerInfo] = useState<SyncServerInfo | null>(null);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  const checkHealth = async (ip: string, port: number) => {
    try {
      const response = await fetch(`http://${ip}:${port}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      const data = await response.json();
      setIsHealthy(data.status === 'ok');
    } catch {
      setIsHealthy(false);
    }
  };

  const loadInfo = async () => {
    try {
      const info = await invoke<SyncServerInfo>('sync_server_info');
      setServerInfo(info);
      await checkHealth(info.ip, info.port);
    } catch {
      setIsHealthy(false);
    }
  };

  useEffect(() => {
    void loadInfo();
    const interval = setInterval(() => {
      if (serverInfo) {
        void checkHealth(serverInfo.ip, serverInfo.port);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const serverUrl = serverInfo
    ? `http://${serverInfo.ip}:${serverInfo.port}`
    : '';

  const handleCopyUrl = async () => {
    if (serverUrl) {
      await navigator.clipboard.writeText(serverUrl);
      toast.success('Dirección copiada al portapapeles');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-xl mx-auto">
      {/* Header card */}
      <div className="border-border bg-background-secondary rounded-xl border-(length:--border-width) p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Laptop className="text-primary size-6" />
            <div>
              <h2 className="text-base font-bold">Sincronización con Móvil</h2>
              <p className="text-foreground-secondary text-xs">
                Escanea el código QR desde Aurora en tu móvil para vincularlos
              </p>
            </div>
          </div>
          <Badge
            variant="pill"
            className={
              isHealthy
                ? 'bg-accent-green text-black'
                : 'bg-zinc-600 text-white'
            }
          >
            {isHealthy === null
              ? 'Comprobando...'
              : isHealthy
                ? 'Servidor activo'
                : 'Servidor inactivo'}
          </Badge>
        </div>
      </div>

      {/* QR Code */}
      {serverUrl && (
        <div className="border-border bg-background-secondary rounded-xl border-(length:--border-width) p-6 flex flex-col items-center gap-4">
          <div className="bg-white rounded-xl p-4">
            <QRCodeSVG value={serverUrl} size={200} level="M" />
          </div>
          <p className="text-foreground-secondary text-xs text-center">
            Abre Aurora en tu móvil → Ajustes → Sync → Escanear QR
          </p>
        </div>
      )}

      {/* Server URL */}
      <div className="border-border bg-background-secondary/60 rounded-xl border-(length:--border-width) p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Wifi size={16} className="text-primary" /> Dirección del servidor
        </h3>
        <div className="flex gap-2 items-center">
          <code className="bg-background border-border rounded-md border px-3 py-2 text-sm font-mono flex-1">
            {serverUrl || 'Cargando...'}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleCopyUrl()}
            className="flex items-center gap-1.5"
          >
            <Copy size={14} /> Copiar
          </Button>
        </div>
        <p className="text-foreground-secondary text-xs">
          También puedes introducir esta dirección manualmente en la app móvil
        </p>
      </div>

      {/* Refresh button */}
      <Button
        variant="secondary"
        onClick={() => void loadInfo()}
        className="flex items-center justify-center gap-2 py-2.5 h-auto text-xs font-semibold"
      >
        <RefreshCw size={16} />
        Actualizar estado
      </Button>

      {/* Features list */}
      <div className="flex flex-col gap-2 pt-2 text-xs text-foreground-secondary">
        <span className="font-semibold text-foreground">
          Datos que se sincronizan:
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Canciones y
            Artistas Favoritos
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Historial
            de Escuchas
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Tema Visual
            y Modo Oscuro
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Ajustes de
            Reproducción
          </div>
        </div>
      </div>
    </div>
  );
};
