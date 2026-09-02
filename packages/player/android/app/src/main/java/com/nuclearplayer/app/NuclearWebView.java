package com.nuclearplayer.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;

import com.getcapacitor.CapacitorWebView;

public class NuclearWebView extends CapacitorWebView {

    public NuclearWebView(Context context) {
        super(context, null);
    }

    public NuclearWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        super.onWindowVisibilityChanged(View.VISIBLE);
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

    public void keepPlaybackActive() {
        resumeTimers();
        onResume();
    }
}
