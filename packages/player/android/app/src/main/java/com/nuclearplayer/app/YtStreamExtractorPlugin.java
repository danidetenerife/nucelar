package com.nuclearplayer.app;

import android.annotation.SuppressLint;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Resolves a playable YouTube audio stream URL directly on the device
 * without any external server or proxy.
 *
 * It uses a hidden off-screen WebView executing YouTube's real player JS,
 * which transparently handles signature deciphering and PoToken / BotGuard
 * as a genuine mobile browser.
 *
 * Implements a 2-stage fallback:
 * Stage 1: Loads https://www.youtube.com/embed/<videoId>?autoplay=1...
 * Stage 2: If embed triggers no audio within timeout (e.g. age-restricted
 *          or embed-blocked tracks), falls back to https://m.youtube.com/watch?v=<videoId>
 */
@CapacitorPlugin(name = "YtStreamExtractor")
public class YtStreamExtractorPlugin extends Plugin {
    private static final String TAG = "YtStreamExtractor";
    private static final long STAGE1_TIMEOUT_MS = 8000;
    private static final long STAGE2_TIMEOUT_MS = 7000;

    public static final String MOBILE_UA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/128.0.0.0 Mobile Safari/537.36";

    @PluginMethod
    public void extractAudioUrl(PluginCall call) {
        String videoId = call.getString("videoId");
        if (videoId == null || videoId.trim().isEmpty()) {
            call.reject("videoId is required");
            return;
        }

        call.setKeepAlive(true);
        getActivity().runOnUiThread(() -> startExtraction(call, videoId.trim()));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void startExtraction(PluginCall call, String videoId) {
        WebView hidden;
        try {
            hidden = new WebView(getContext());
        } catch (Throwable t) {
            call.reject("Could not create extraction WebView: " + t.getMessage());
            return;
        }

        AtomicBoolean settled = new AtomicBoolean(false);
        Handler mainHandler = new Handler(Looper.getMainLooper());

        Runnable cleanupRunnable = () -> cleanup(hidden);

        Runnable stage2TimeoutRunnable = () -> {
            if (settled.compareAndSet(false, true)) {
                cleanupRunnable.run();
                Log.w(TAG, "Stage 2 (m.youtube.com) timed out for videoId: " + videoId);
                call.reject("Timed out resolving audio stream for " + videoId);
            }
        };

        Runnable stage1TimeoutRunnable = () -> {
            if (!settled.get()) {
                Log.i(TAG, "Stage 1 (embed) timed out for " + videoId + ", trying Stage 2 (m.youtube.com)");
                try {
                    hidden.stopLoading();
                    String watchUrl = "https://m.youtube.com/watch?v=" + videoId;
                    hidden.loadUrl(watchUrl);
                    mainHandler.postDelayed(stage2TimeoutRunnable, STAGE2_TIMEOUT_MS);
                } catch (Throwable t) {
                    if (settled.compareAndSet(false, true)) {
                        cleanupRunnable.run();
                        call.reject("Stage 2 load failed: " + t.getMessage());
                    }
                }
            }
        };

        mainHandler.postDelayed(stage1TimeoutRunnable, STAGE1_TIMEOUT_MS);

        WebSettings settings = hidden.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(MOBILE_UA);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        hidden.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                try {
                    String url = request.getUrl().toString();
                    String lowerUrl = url.toLowerCase();

                    boolean isGoogleVideo = lowerUrl.contains("googlevideo.com") && lowerUrl.contains("videoplayback");
                    boolean isAudio = lowerUrl.contains("mime=audio") ||
                                      lowerUrl.contains("mime%3daudio") ||
                                      lowerUrl.contains("audio%2f") ||
                                      lowerUrl.contains("audio/");
                    boolean isVideoOnly = lowerUrl.contains("mime=video") || lowerUrl.contains("mime%3dvideo");

                    if (!settled.get() && isGoogleVideo && isAudio && !isVideoOnly) {
                        if (settled.compareAndSet(false, true)) {
                            Log.i(TAG, "Successfully intercepted audio stream URL for " + videoId);
                            mainHandler.removeCallbacks(stage1TimeoutRunnable);
                            mainHandler.removeCallbacks(stage2TimeoutRunnable);

                            JSObject result = new JSObject();
                            result.put("streamUrl", url);

                            mainHandler.post(() -> {
                                cleanup(hidden);
                                call.resolve(result);
                            });
                        }
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Error in shouldInterceptRequest", t);
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        // Attach off-screen (1x1) so the media pipeline actually runs
        ViewGroup root = getActivity().findViewById(android.R.id.content);
        if (root != null) {
            ViewGroup.LayoutParams params = new ViewGroup.LayoutParams(1, 1);
            root.addView(hidden, params);
        }

        String embedUrl = "https://www.youtube.com/embed/" + videoId
            + "?autoplay=1&mute=0&controls=0&playsinline=1";
        hidden.loadUrl(embedUrl);
    }

    private void cleanup(WebView webView) {
        if (webView == null) return;
        try {
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                parent.removeView(webView);
            }
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.loadUrl("about:blank");
            webView.clearHistory();
            webView.removeAllViews();
            webView.destroy();
        } catch (Throwable t) {
            Log.w(TAG, "Cleanup failed", t);
        }
    }
}
