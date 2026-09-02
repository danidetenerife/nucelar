package com.nuclearplayer.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.os.PowerManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean audioFocusGranted = false;
    private final Handler keepAliveHandler = new Handler(Looper.getMainLooper());
    private Runnable keepAliveRunnable;
    private BroadcastReceiver screenStateReceiver;

    public static MainActivity getInstance() {
        return instance;
    }

    public static void ensureActiveWebView() {
        if (instance != null) {
            instance.runOnUiThread(() -> {
                try {
                    WebView wv = instance.getBridge() != null ? instance.getBridge().getWebView() : null;
                    if (wv != null) {
                        wv.resumeTimers();
                        wv.onResume();
                        wv.dispatchWindowVisibilityChanged(android.view.View.VISIBLE);
                    }
                } catch (Throwable t) {}
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        registerPlugin(MediaRouterPlugin.class);
        registerPlugin(NativeMediaSessionPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        setupWakeLocks();
        setupAudioFocus();
        setupWebView();
        setupScreenStateReceiver();
        startAudioService();
        startKeepAliveLoop();
    }

    private void setupWakeLocks() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Nuclear::AudioWakeLock"
                );
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }

            WifiManager wifiManager = (WifiManager) getApplicationContext()
                .getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                wifiLock = wifiManager.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "Nuclear::AudioWifiLock"
                );
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        } catch (Throwable t) {
            // ignore
        }
    }

    private void setupAudioFocus() {
        try {
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            AudioManager.OnAudioFocusChangeListener focusChangeListener = focusChange -> {
                // Keep playing on all focus changes - we are a music player
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build();

                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setOnAudioFocusChangeListener(focusChangeListener)
                    .setWillPauseWhenDucked(false)
                    .setAcceptsDelayedFocusGain(true)
                    .build();

                int result = audioManager.requestAudioFocus(audioFocusRequest);
                audioFocusGranted = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            } else {
                //noinspection deprecation
                int result = audioManager.requestAudioFocus(
                    focusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
                );
                audioFocusGranted = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            }
        } catch (Throwable t) {
            // ignore
        }
    }

    private void setupWebView() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                WebView webView = getBridge().getWebView();
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                settings.setJavaScriptEnabled(true);
            }
        } catch (Throwable t) {
            // ignore
        }
    }

    private void setupScreenStateReceiver() {
        try {
            screenStateReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null) return;
                    String action = intent.getAction();
                    if (Intent.ACTION_SCREEN_OFF.equals(action) || Intent.ACTION_SCREEN_ON.equals(action) || Intent.ACTION_USER_PRESENT.equals(action)) {
                        ensureActiveWebView();
                    }
                }
            };
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            filter.addAction(Intent.ACTION_SCREEN_ON);
            filter.addAction(Intent.ACTION_USER_PRESENT);
            registerReceiver(screenStateReceiver, filter);
        } catch (Throwable t) {}
    }

    private void startAudioService() {
        try {
            Intent serviceIntent = new Intent(this, AudioForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Throwable t) {
            // ignore
        }
    }

    private void startKeepAliveLoop() {
        keepAliveRunnable = new Runnable() {
            @Override
            public void run() {
                ensureActiveWebView();
                keepAliveHandler.postDelayed(this, 3000); // every 3 seconds
            }
        };
        keepAliveHandler.postDelayed(keepAliveRunnable, 3000);
    }

    @Override
    public void onPause() {
        super.onPause();
        ensureActiveWebView();
    }

    @Override
    public void onStop() {
        super.onStop();
        ensureActiveWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureActiveWebView();
        if (!audioFocusGranted) {
            setupAudioFocus();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        ensureActiveWebView();
    }

    @Override
    public void onDestroy() {
        try {
            if (screenStateReceiver != null) {
                unregisterReceiver(screenStateReceiver);
            }
        } catch (Throwable t) {}
        try {
            keepAliveHandler.removeCallbacks(keepAliveRunnable);
        } catch (Throwable t) {}
        try {
            Intent serviceIntent = new Intent(this, AudioForegroundService.class);
            stopService(serviceIntent);
        } catch (Throwable t) {}
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null && audioManager != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            }
        } catch (Throwable t) {}
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Throwable t) {}
        instance = null;
        super.onDestroy();
    }
}
