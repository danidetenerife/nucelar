package com.nuclearplayer.app;

import android.app.UiModeManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private BroadcastReceiver screenStateReceiver;
    private boolean isTelevision;

    public static MainActivity getInstance() {
        return instance;
    }

    public static void ensureActiveWebView() {
        if (instance != null) {
            instance.runOnUiThread(() -> {
                try {
                    WebView webView = instance.getBridge() != null ? instance.getBridge().getWebView() : null;
                    if (webView != null) {
                        webView.resumeTimers();
                        webView.onResume();
                    }
                } catch (Throwable t) {}
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        isTelevision = isTelevisionDevice();
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                if (isTelevision) {
                    webView.evaluateJavascript(
                        "document.documentElement.dataset.platform='tv';window.dispatchEvent(new Event('resize'))",
                        null
                    );
                }
            }
        });
        registerPlugin(MediaRouterPlugin.class);
        registerPlugin(NativeMediaSessionPlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
        super.onCreate(savedInstanceState);

        setupWakeLocks();
        setupWebView();
        setupTelevisionDisplay();
        setupScreenStateReceiver();
        requestNotificationPermission();
        startAudioService();
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    private boolean isTelevisionDevice() {
        UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
        return uiModeManager != null &&
            uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
    }

    private void setupTelevisionDisplay() {
        if (!isTelevision) {
            return;
        }

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
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
                settings.setOffscreenPreRaster(true);
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

    @Override
    public void onPause() {
        super.onPause();
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.onResume();
                webView.resumeTimers();
            }
        } catch (Throwable t) {}
        ensureActiveWebView();
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.onResume();
                webView.resumeTimers();
            }
        } catch (Throwable t) {}
        ensureActiveWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureActiveWebView();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            setupTelevisionDisplay();
        }
        ensureActiveWebView();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        setupTelevisionDisplay();
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            webView.requestLayout();
            webView.evaluateJavascript("window.dispatchEvent(new Event('resize'))", null);
        }
    }

    @Override
    public void onDestroy() {
        try {
            if (screenStateReceiver != null) {
                unregisterReceiver(screenStateReceiver);
            }
        } catch (Throwable t) {}
        try {
            Intent serviceIntent = new Intent(this, AudioForegroundService.class);
            stopService(serviceIntent);
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
