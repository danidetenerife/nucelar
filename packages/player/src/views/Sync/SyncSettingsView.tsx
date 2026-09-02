import { Camera, CheckCircle2, Laptop, RefreshCw, Search, Wifi } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button, Input, Toggle } from '@nuclearplayer/ui';

import { QrScannerModal } from '../../components/QrScannerModal';
import { p2pSyncService } from '../../services/p2pSyncService';

export const SyncSettingsView: FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSearchingLan, setIsSearchingLan] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadData = async () => {
    const url = await p2pSyncService.getSyncServerUrl();
    setServerUrl(url);
    setInputUrl(url);
    const auto = await p2pSyncService.isAutoSyncEnabled();
    setAutoSync(auto);
    const syncTime = await p2pSyncService.getLastSyncTime();
    setLastSync(syncTime);
    const online = await p2pSyncService.checkPcHealth(url);
    setIsOnline(online);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleScanSuccess = async (scannedUrl: string) => {
    toast.success('¡Código QR detectado! Conectando...', { duration: 3000 });
    await p2pSyncService.setSyncServerUrl(scannedUrl);
    setServerUrl(scannedUrl);
    setInputUrl(scannedUrl);

    setIsSyncing(true);
    const res = await p2pSyncService.syncNow();
    setIsSyncing(false);

    if (res.success) {
      setIsOnline(true);
      setLastSync(Date.now());
      toast.success('¡PC vinculado y sincronizado con éxito!');
    } else {
      toast.error(`PC vinculado, pero no se pudo conectar: ${res.error}`);
    }
  };

  const handleManualSave = async () => {
    if (!inputUrl.trim()) {
      return;
    }
    await p2pSyncService.setSyncServerUrl(inputUrl);
    setServerUrl(inputUrl);
    setIsSyncing(true);
    const res = await p2pSyncService.syncNow();
    setIsSyncing(false);

    if (res.success) {
      setIsOnline(true);
      setLastSync(Date.now());
      toast.success('¡Conexión establecida y datos sincronizados!');
    } else {
      setIsOnline(false);
      toast.error(`No se pudo conectar con el PC: ${res.error}`);
    }
  };

  const handleLanDiscovery = async () => {
    setIsSearchingLan(true);
    toast.info('Buscando Nuclear PC en la red Wi-Fi...');
    const foundUrl = await p2pSyncService.discoverPcOnLan();
    setIsSearchingLan(false);

    if (foundUrl) {
      setServerUrl(foundUrl);
      setInputUrl(foundUrl);
      setIsOnline(true);
      setLastSync(Date.now());
      toast.success(`¡Nuclear PC encontrado en ${foundUrl}! Sincronizado.`);
    } else {
      toast.error('No se encontró ningún PC con Nuclear abierto en esta red Wi-Fi.');
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    const res = await p2pSyncService.syncNow();
    setIsSyncing(false);

    if (res.success) {
      setIsOnline(true);
      setLastSync(Date.now());
      toast.success('¡Sincronización completada con éxito!');
    } else {
      setIsOnline(false);
      toast.error(`Error al sincronizar: ${res.error}`);
    }
  };

  const formatRelativeTime = (timestamp: number | null) => {
    if (!timestamp) return 'Nunca';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return 'Hace unos segundos';
    if (diffSec < 60) return `Hace ${diffSec} segundos`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} minuto(s)`;
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="flex flex-col gap-6 p-4 max-w-xl mx-auto">
      {/* Header card */}
      <div className="border-border bg-background-secondary rounded-xl border-(length:--border-width) p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Laptop className="text-primary size-6" />
            <div>
              <h2 className="text-base font-bold">Vincular con Nuclear PC</h2>
              <p className="text-foreground-secondary text-xs">
                Sincronización P2P local (favoritos, historial y preferencias)
              </p>
            </div>
          </div>
          <Badge variant="pill" className={isOnline ? 'bg-accent-green text-black' : 'bg-zinc-600 text-white'}>
            {isOnline ? 'En línea' : 'Desconectado'}
          </Badge>
        </div>

        <div className="flex flex-col gap-1 text-xs text-foreground-secondary pt-2 border-t border-border/40">
          <div className="flex justify-between">
            <span>PC Vinculado:</span>
            <span className="font-mono text-foreground">{serverUrl || 'Ninguno'}</span>
          </div>
          <div className="flex justify-between">
            <span>Última Sincronización:</span>
            <span className="text-foreground">{formatRelativeTime(lastSync)}</span>
          </div>
        </div>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-col gap-2.5">
        <Button
          variant="default"
          onClick={() => setIsScanning(true)}
          className="flex items-center justify-center gap-2 py-3 h-auto text-sm font-bold shadow-shadow"
        >
          <Camera size={18} /> Escanear Código QR del PC
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            disabled={isSearchingLan}
            onClick={() => void handleLanDiscovery()}
            className="flex items-center justify-center gap-2 py-2.5 h-auto text-xs font-semibold"
          >
            {isSearchingLan ? <RefreshCw className="animate-spin size-4" /> : <Search size={16} />}
            Buscar en Wi-Fi
          </Button>
          <Button
            variant="secondary"
            disabled={isSyncing}
            onClick={() => void handleSyncNow()}
            className="flex items-center justify-center gap-2 py-2.5 h-auto text-xs font-semibold"
          >
            {isSyncing ? <RefreshCw className="animate-spin size-4" /> : <RefreshCw size={16} />}
            Sincronizar Ahora
          </Button>
        </div>
      </div>

      {/* Manual Connection Input */}
      <div className="border-border bg-background-secondary/60 rounded-xl border-(length:--border-width) p-4 flex flex-col gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Wifi size={16} className="text-primary" /> Conexión Manual por IP
        </h3>
        <div className="flex gap-2">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://192.168.1.35:4120"
            className="flex-1 text-xs font-mono"
          />
          <Button variant="default" size="sm" onClick={() => void handleManualSave()}>
            Conectar
          </Button>
        </div>
      </div>

      {/* Auto sync switch */}
      <div className="flex items-center justify-between border-border bg-background-secondary/60 rounded-xl border-(length:--border-width) p-4">
        <div>
          <h4 className="text-sm font-semibold">Sincronización Automática</h4>
          <p className="text-foreground-secondary text-xs">
            Sincronizar en 2º plano cada 15 segundos al estar en el mismo Wi-Fi.
          </p>
        </div>
        <Toggle
          checked={autoSync}
          onChange={(checked: boolean) => {
            setAutoSync(checked);
            void p2pSyncService.setAutoSyncEnabled(checked);
          }}
        />
      </div>

      {/* Features list */}
      <div className="flex flex-col gap-2 pt-2 text-xs text-foreground-secondary">
        <span className="font-semibold text-foreground">Datos que se sincronizan:</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Canciones y Artistas Favoritos
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Historial de Escuchas
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Tema Visual y Modo Oscuro
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-accent-green" /> Ajustes de Reproducción
          </div>
        </div>
      </div>

      {/* QR Scanner modal */}
      <QrScannerModal
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
        onScan={(scanned) => void handleScanSuccess(scanned)}
      />
    </div>
  );
};
