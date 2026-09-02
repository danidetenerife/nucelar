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
import android.media.AudioManager;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.net.wifi.WifiManager;
import android.os.PowerManager;

public class AudioForegroundService extends Service {
    public static final String CHANNEL_ID = "nuclear_audio_channel";
    public static final String ACTION_UPDATE_METADATA = "com.nuclearplayer.UPDATE_METADATA";
    public static final String ACTION_UPDATE_PLAYBACK_STATE = "com.nuclearplayer.UPDATE_PLAYBACK_STATE";

    private static final int NOTIFICATION_ID = 1;

    private final IBinder binder = new LocalBinder();
    private MediaSessionCompat mediaSession;
    private PowerManager.WakeLock serviceWakeLock;
    private WifiManager.WifiLock serviceWifiLock;
    private String currentArtworkUrl = "";
    private Bitmap currentArtworkBitmap = null;
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
                notifyJsMediaAction("play");
            }

            @Override
            public void onPause() {
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
                notifyJsMediaAction("stop");
            }

            @Override
            public void onSeekTo(long pos) {
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
                notifyJsMediaAction(isPlaying ? "pause" : "play");
                return START_STICKY;
            } else if ("com.nuclearplayer.ACTION_NEXT".equals(action)) {
                notifyJsMediaAction("nexttrack");
                return START_STICKY;
            }

            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }

        Notification notification = buildNotification("Nuclear Music Player", "", false);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Throwable t) {
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Throwable t2) {
                // ignore
            }
        }
        return START_STICKY;
    }

    private void handleMetadataUpdate(Intent intent) {
        String title = intent.getStringExtra("title");
        String artist = intent.getStringExtra("artist");
        String album = intent.getStringExtra("album");
        String artworkUrl = intent.getStringExtra("artworkUrl");

        if (title == null) title = "";
        if (artist == null) artist = "";
        if (album == null) album = "";

        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album);

        if (currentArtworkBitmap != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtworkBitmap);
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

                    MediaMetadataCompat updatedMetadata = new MediaMetadataCompat.Builder()
                        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, finalTitle)
                        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, finalArtist)
                        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, finalAlbum)
                        .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                        .build();
                    mediaSession.setMetadata(updatedMetadata);

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
                        .setBufferSizeInBytes(bufferSize)
                        .setTransferMode(AudioTrack.MODE_STREAM)
                        .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                        .build();

                    nativeAudioTrack.setVolume(0.0001f);
                    nativeAudioTrack.play();
                    isKeepAliveRunning = true;

                    audioKeepAliveThread = new Thread(() -> {
                        byte[] silentBuffer = new byte[bufferSize];
                        while (isKeepAliveRunning && nativeAudioTrack != null) {
                            try {
                                if (nativeAudioTrack.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                                    nativeAudioTrack.write(silentBuffer, 0, silentBuffer.length);
                                }
                                Thread.sleep(500);
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
            .setContentTitle(title.isEmpty() ? "Nuclear Music Player" : title)
            .setContentText(artist)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
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

        Notification notification = buildNotification(
            title != null ? title : "",
            artist != null ? artist : "",
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

        if ("com.nuclearplayer.ACTION_PREVIOUS".equals(action)) {
            // handled via plugin
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
                "Nuclear Audio",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Reproducción de música en segundo plano");
            channel.setShowBadge(false);
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
