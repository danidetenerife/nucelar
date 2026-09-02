package com.nuclearplayer.app;

import android.content.Context;
import android.util.AttributeSet;

import com.getcapacitor.CapacitorWebView;

public class NuclearWebView extends CapacitorWebView {

    public NuclearWebView(Context context) {
        super(context, null);
    }

    public NuclearWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(VISIBLE);
    }

    @Override
    public void onPause() {
        resumeTimers();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumeTimers();
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        post(() -> evaluateJavascript("window.dispatchEvent(new Event('resize'))", null));
    }

    public void keepPlaybackActive() {
        resumeTimers();
        onResume();
    }
}
