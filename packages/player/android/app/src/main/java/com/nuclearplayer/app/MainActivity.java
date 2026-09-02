package com.nuclearplayer.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.os.PowerManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean audioFocusGranted = false;
    private final Handler keepAliveHandler = new Handler(Looper.getMainLooper());
    private Runnable keepAliveRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaRouterPlugin.class);
        registerPlugin(NativeMediaSessionPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        setupWakeLocks();
        setupAudioFocus();
        setupWebView();
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

    /**
     * Periodically ensures WebView JavaScript timers stay active in background.
     */
    private void startKeepAliveLoop() {
        keepAliveRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                    if (wv != null) {
                        wv.resumeTimers();
                    }
                } catch (Throwable t) {
                    // ignore
                }
                keepAliveHandler.postDelayed(this, 10000); // every 10 seconds
            }
        };
        keepAliveHandler.postDelayed(keepAliveRunnable, 10000);
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.resumeTimers();
                wv.onResume();
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.resumeTimers();
                wv.onResume();
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.resumeTimers();
            }
            if (!audioFocusGranted) {
                setupAudioFocus();
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        try {
            WebView wv = getBridge() != null ? getBridge().getWebView() : null;
            if (wv != null) {
                wv.resumeTimers();
            }
        } catch (Throwable t) {}
    }

    @Override
    public void onDestroy() {
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
        super.onDestroy();
    }
}
