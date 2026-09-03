package com.nuclearplayer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.media.MediaPlayer;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import android.content.Context;
import android.net.Uri;
import android.net.wifi.WifiManager;
import android.os.PowerManager;
import java.util.HashMap;
import java.util.Map;

public class AudioForegroundService extends Service {
    public static final String CHANNEL_ID = "aurora_media_playback_v5";
    public static final String ACTION_UPDATE_METADATA = "com.nuclearplayer.UPDATE_METADATA";
    public static final String ACTION_UPDATE_PLAYBACK_STATE = "com.nuclearplayer.UPDATE_PLAYBACK_STATE";

    private static final int NOTIFICATION_ID = 1;

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock serviceWakeLock;
    private WifiManager.WifiLock serviceWifiLock;
    private String currentTitle = "Aurora";
    private String currentArtist = "Reproductor de música";
    private String currentAlbum = "";
    private String currentArtworkUrl = "";
    private Bitmap currentArtworkBitmap = null;
    private long currentDurationMs = 0;
    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();

    private static AudioForegroundService instance;

    public class LocalBinder extends Binder {
        AudioForegroundService getService() {
            return AudioForegroundService.this;
        }
    }

    public static AudioForegroundService getInstance() {
        return instance;
    }

    public MediaPlayer getMediaPlayer() {
        return null;
    }

    public synchronized void playStream(String url, long positionMs) {
        setOptimisticPlaybackState(true);
    }

    public synchronized void pauseStream() {
        setOptimisticPlaybackState(false);
    }

    public synchronized void resumeStream() {
        setOptimisticPlaybackState(true);
    }

    public synchronized void seekStream(long positionMs) {
        // Handled via JS
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        acquireLocks();
        createNotificationChannel();
        initMediaSession();
    }

    private void acquireLocks() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null && serviceWakeLock == null) {
                serviceWakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Nuclear::ServiceAudioWakeLock"
                );
                serviceWakeLock.setReferenceCounted(false);
                serviceWakeLock.acquire();
            }

            WifiManager wifiManager = (WifiManager) getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null && serviceWifiLock == null) {
                serviceWifiLock = wifiManager.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "Nuclear::ServiceAudioWifiLock"
                );
                serviceWifiLock.setReferenceCounted(false);
                serviceWifiLock.acquire();
            }
        } catch (Throwable t) {}
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "NuclearMusicPlayer");

        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                resumeStream();
                setOptimisticPlaybackState(true);
                notifyJsMediaAction("play");
            }

            @Override
            public void onPause() {
                pauseStream();
                setOptimisticPlaybackState(false);
                notifyJsMediaAction("pause");
            }

            @Override
            public void onSkipToNext() {
                notifyJsMediaAction("nexttrack");
            }

            @Override
            public void onSkipToPrevious() {
                notifyJsMediaAction("previoustrack");
            }

            @Override
            public void onStop() {
                pauseStream();
                setOptimisticPlaybackState(false);
                notifyJsMediaAction("stop");
            }

            @Override
            public void onSeekTo(long pos) {
                seekStream(pos);
                NativeMediaSessionPlugin pluginInstance = NativeMediaSessionPlugin.getInstance();
                if (pluginInstance != null) {
                    pluginInstance.notifyMediaAction("seekto", pos);
                }
            }
        });

        mediaSession.setActive(true);

        PlaybackStateCompat initialState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(PlaybackStateCompat.STATE_PAUSED, 0, 1.0f)
            .build();
        mediaSession.setPlaybackState(initialState);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification("Aurora", "", false);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable firstError) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Throwable ignored) {}
        }

        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_UPDATE_METADATA.equals(action)) {
                handleMetadataUpdate(intent);
                return START_STICKY;
            } else if (ACTION_UPDATE_PLAYBACK_STATE.equals(action)) {
                handlePlaybackStateUpdate(intent);
                return START_STICKY;
            } else if ("com.nuclearplayer.ACTION_PREVIOUS".equals(action)) {
                notifyJsMediaAction("previoustrack");
                return START_STICKY;
            } else if ("com.nuclearplayer.ACTION_PLAY_PAUSE".equals(action)) {
                PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
                boolean isPlaying = state != null && state.getState() == PlaybackStateCompat.STATE_PLAYING;
                boolean targetPlaying = !isPlaying;
                setOptimisticPlaybackState(targetPlaying);
                notifyJsMediaAction(targetPlaying ? "play" : "pause");
                return START_STICKY;
            } else if ("com.nuclearplayer.ACTION_NEXT".equals(action)) {
                notifyJsMediaAction("nexttrack");
                return START_STICKY;
            }

            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return START_STICKY;
    }

    private void handleMetadataUpdate(Intent intent) {
        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String album = intent.getStringExtra("album");
        String artworkUrl = intent.getStringExtra("artworkUrl");
        long durationMs = intent.getLongExtra("durationMs", 0);
        if (durationMs > 0) {
            currentDurationMs = durationMs;
        }

        if (title != null && !title.trim().isEmpty()) currentTitle = title.trim();
        if (artist != null && !artist.trim().isEmpty()) currentArtist = artist.trim();
        if (album != null && !album.trim().isEmpty()) currentAlbum = album.trim();

        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, currentAlbum);

        if (currentDurationMs > 0) {
            metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);
        }

        if (currentArtworkBitmap != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtworkBitmap);
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, currentArtworkBitmap);
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, currentArtworkBitmap);
        }

        mediaSession.setMetadata(metadataBuilder.build());

        updateNotification(title, artist);

        if (artworkUrl != null && !artworkUrl.isEmpty() && !artworkUrl.equals(currentArtworkUrl)) {
            currentArtworkUrl = artworkUrl;
            final String finalTitle = title;
            final String finalArtist = artist;
            final String finalAlbum = album;

            artworkExecutor.execute(() -> {
                Bitmap bitmap = downloadBitmap(artworkUrl);
                if (bitmap != null && artworkUrl.equals(currentArtworkUrl)) {
                    currentArtworkBitmap = bitmap;

                    MediaMetadataCompat.Builder updatedMetadataBuilder = new MediaMetadataCompat.Builder()
                        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, finalTitle)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, finalTitle)
                        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, finalArtist)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, finalArtist)
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, finalAlbum)
                        .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, finalAlbum)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, bitmap);

                    if (currentDurationMs > 0) {
                        updatedMetadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, currentDurationMs);
                    }

                    mediaSession.setMetadata(updatedMetadataBuilder.build());

                    updateNotification(finalTitle, finalArtist);
                }
            });
        }
    }

    private AudioTrack nativeAudioTrack;
    private Thread audioKeepAliveThread;
    private volatile boolean isKeepAliveRunning = false;

    private synchronized void ensureNativeAudioTrack(boolean enable) {
        if (enable) {
            if (nativeAudioTrack == null) {
                try {
                    int sampleRate = 44100;
                    int channelConfig = AudioFormat.CHANNEL_OUT_STEREO;
                    int audioFormat = AudioFormat.ENCODING_PCM_16BIT;
                    int bufferSize = AudioTrack.getMinBufferSize(sampleRate, channelConfig, audioFormat);
                    if (bufferSize < 2048) bufferSize = 2048;
                    final int audioBufferSize = bufferSize;

                    AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();

                    AudioFormat format = new AudioFormat.Builder()
                        .setSampleRate(sampleRate)
                        .setEncoding(audioFormat)
                        .setChannelMask(channelConfig)
                        .build();

                    nativeAudioTrack = new AudioTrack.Builder()
                        .setAudioAttributes(attributes)
                        .setAudioFormat(format)
                        .setBufferSizeInBytes(audioBufferSize)
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                        .build();

                    nativeAudioTrack.setVolume(0.0001f);
                    nativeAudioTrack.play();
                    isKeepAliveRunning = true;

                    audioKeepAliveThread = new Thread(() -> {
                        byte[] silentBuffer = new byte[audioBufferSize];
                        while (isKeepAliveRunning && nativeAudioTrack != null) {
                            try {
                                if (nativeAudioTrack.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                                    nativeAudioTrack.write(silentBuffer, 0, silentBuffer.length);
                                } else {
                                    Thread.sleep(50);
                                }
                            } catch (Throwable t) {
                                break;
                            }
                        }
                    }, "NuclearAudioKeepAlive");
                    audioKeepAliveThread.setDaemon(true);
                    audioKeepAliveThread.start();
                } catch (Throwable t) {
                    // ignore
                }
            }
        } else {
            isKeepAliveRunning = false;
            if (audioKeepAliveThread != null) {
                try {
                    audioKeepAliveThread.interrupt();
                } catch (Throwable t) {}
                audioKeepAliveThread = null;
            }
            if (nativeAudioTrack != null) {
                try {
                    nativeAudioTrack.stop();
                    nativeAudioTrack.release();
                } catch (Throwable t) {}
                nativeAudioTrack = null;
            }
        }
    }

    private void handlePlaybackStateUpdate(Intent intent) {
        boolean isPlaying = intent.getBooleanExtra("isPlaying", false);
        long positionMs = intent.getLongExtra("positionMs", 0);

        ensureNativeAudioTrack(isPlaying);

        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(state, positionMs, isPlaying ? 1.0f : 0f)
            .build();

        mediaSession.setPlaybackState(playbackState);

        MediaMetadataCompat metadata = mediaSession.getController().getMetadata();
        String title = "";
        String artist = "";
        if (metadata != null) {
            CharSequence t = metadata.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
            CharSequence a = metadata.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
            if (t != null) title = t.toString();
            if (a != null) artist = a.toString();
        }
        updateNotification(title, artist);
    }

    public void setOptimisticPlaybackState(boolean isPlaying) {
        PlaybackStateCompat state = mediaSession != null && mediaSession.getController() != null
            ? mediaSession.getController().getPlaybackState()
            : null;
        long pos = state != null ? state.getPosition() : 0;

        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                      pos,
                      isPlaying ? 1.0f : 0f)
            .build();
        mediaSession.setPlaybackState(playbackState);
        ensureNativeAudioTrack(isPlaying);
        updateNotification(null, null);
    }

    private Notification buildNotification(String title, String artist, boolean isPlaying) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, notificationIntent, flags);

        Intent prevIntent = new Intent(this, AudioForegroundService.class);
        prevIntent.setAction("com.nuclearplayer.ACTION_PREVIOUS");
        PendingIntent prevPending = PendingIntent.getService(this, 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent playPauseIntent = new Intent(this, AudioForegroundService.class);
        playPauseIntent.setAction("com.nuclearplayer.ACTION_PLAY_PAUSE");
        PendingIntent playPausePending = PendingIntent.getService(this, 2, playPauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        Intent nextIntent = new Intent(this, AudioForegroundService.class);
        nextIntent.setAction("com.nuclearplayer.ACTION_NEXT");
        PendingIntent nextPending = PendingIntent.getService(this, 3, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0));

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title != null && !title.isEmpty() ? title : currentTitle)
            .setContentText(artist != null && !artist.isEmpty() ? artist : currentArtist)
            .setSubText(!currentAlbum.isEmpty() ? currentAlbum : "Aurora")
            .setSmallIcon(R.drawable.ic_stat_aurora)
            .setContentIntent(contentIntent)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
            .addAction(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play",
                playPausePending
            )
            .addAction(android.R.drawable.ic_media_next, "Next", nextPending)
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
            );

        if (currentArtworkBitmap != null) {
            builder.setLargeIcon(currentArtworkBitmap);
        }

        return builder.build();
    }

    private void updateNotification(String title, String artist) {
        MediaMetadataCompat metadata = mediaSession.getController().getMetadata();
        PlaybackStateCompat state = mediaSession.getController().getPlaybackState();
        boolean isPlaying = state != null && state.getState() == PlaybackStateCompat.STATE_PLAYING;

        if (title != null && !title.trim().isEmpty()) currentTitle = title.trim();
        if (artist != null && !artist.trim().isEmpty()) currentArtist = artist.trim();

        if (metadata != null) {
            CharSequence metaTitle = metadata.getText(MediaMetadataCompat.METADATA_KEY_TITLE);
            if (metaTitle != null && metaTitle.length() > 0) currentTitle = metaTitle.toString();
            CharSequence metaArtist = metadata.getText(MediaMetadataCompat.METADATA_KEY_ARTIST);
            if (metaArtist != null && metaArtist.length() > 0) currentArtist = metaArtist.toString();
        }

        Notification notification = buildNotification(
            currentTitle,
            currentArtist,
            isPlaying
        );

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void notifyJsMediaAction(String action) {
        NativeMediaSessionPlugin pluginInstance = NativeMediaSessionPlugin.getInstance();
        if (pluginInstance != null) {
            pluginInstance.notifyMediaAction(action, -1);
        }
    }

    private Bitmap downloadBitmap(String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setDoInput(true);
            conn.connect();

            if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                InputStream is = conn.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                is.close();
                conn.disconnect();
                if (bitmap != null && bitmap.getWidth() > 512) {
                    float scale = 512f / bitmap.getWidth();
                    int newH = (int) (bitmap.getHeight() * scale);
                    bitmap = Bitmap.createScaledBitmap(bitmap, 512, newH, true);
                }
                return bitmap;
            }
            conn.disconnect();
        } catch (Throwable t) {
            // ignore
        }
        return null;
    }

    public MediaSessionCompat getMediaSession() {
        return mediaSession;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Aurora Music Player",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Controles de música en la pantalla de bloqueo y barra de estado");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        artworkExecutor.shutdownNow();
        try {
            if (serviceWakeLock != null && serviceWakeLock.isHeld()) {
                serviceWakeLock.release();
            }
            if (serviceWifiLock != null && serviceWifiLock.isHeld()) {
                serviceWifiLock.release();
            }
        } catch (Throwable t) {}
        instance = null;
        stopForeground(true);
        super.onDestroy();
    }
}
