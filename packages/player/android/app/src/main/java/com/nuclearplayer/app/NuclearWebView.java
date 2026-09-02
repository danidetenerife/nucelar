package com.nuclearplayer.app;

import android.content.Context;
import android.os.Build;
import android.util.AttributeSet;
import android.webkit.WebView;

/**
 * Custom WebView that overrides visibility-change behavior to prevent
 * Chromium from suspending audio/video when the screen turns off or the
 * app goes to the background.
 */
public class NuclearWebView extends WebView {

    public NuclearWebView(Context context) {
        super(context);
    }

    public NuclearWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public NuclearWebView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    /**
     * Chromium calls onWindowVisibilityChanged(GONE) when the screen turns off,
     * which suspends all media elements. We intercept that call and always report
     * VISIBLE so audio keeps playing.
     */
    @Override
    public void onWindowVisibilityChanged(int visibility) {
        // Always report visible to prevent Chromium from pausing media
        super.onWindowVisibilityChanged(VISIBLE);
    }

    /**
     * Keep timers running even when the view is paused (screen off / app background).
     */
    @Override
    public void onPause() {
        // Override to NOT pause - we want audio to keep playing
        resumeTimers();
    }

    /**
     * Keep timers running.
     */
    @Override
    public void onResume() {
        super.onResume();
        resumeTimers();
    }
}
