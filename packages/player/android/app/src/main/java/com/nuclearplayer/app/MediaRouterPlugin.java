package com.nuclearplayer.app;

import android.content.Context;
import android.content.Intent;
import android.media.MediaRouter;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that opens Android's native audio output selector.
 *
 * Strategy (most to least specific):
 * 1. Android 12+: MediaOutputSwitcher via ACTION_MEDIA_OUTPUT (stable component path)
 * 2. Android 12+: com.android.systemui route picker
 * 3. Universal: Open Bluetooth settings (allows switching audio device)
 * 4. Last resort: Sound settings
 */
@CapacitorPlugin(name = "MediaRouterPlugin")
public class MediaRouterPlugin extends Plugin {

    @PluginMethod
    public void openRoutePicker(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (tryMediaOutputSwitcher()) {
                call.resolve();
                return;
            }
            if (trySystemUiMediaPicker()) {
                call.resolve();
                return;
            }
            if (tryBluetoothSettings()) {
                call.resolve();
                return;
            }
            trySoundSettings();
            call.resolve();
        });
    }

    /**
     * Android 12+ — launches the stable MediaOutputSwitcher via explicit component
     * instead of the Settings panel intent that crashes on some ROMs.
     */
    private boolean tryMediaOutputSwitcher() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return false;
        }
        try {
            // Use the explicit SystemUI component for media output — more stable than
            // the Settings panel which has a known NullPointerException on some devices.
            Intent intent = new Intent();
            intent.setAction("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG");
            intent.putExtra("package_name", getContext().getPackageName());
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Fallback: SystemUI broadcast to show the media output panel.
     */
    private boolean trySystemUiMediaPicker() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return false;
        }
        try {
            Intent intent = new Intent("android.media.action.MEDIA_CONTROLS");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Opens Bluetooth settings where the user can switch audio output devices.
     * Works on all Android versions.
     */
    private boolean tryBluetoothSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Last resort: general sound settings.
     */
    private void trySoundSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Throwable ignored) {
            // Nothing more we can do
        }
    }

    @PluginMethod
    public void getRoutes(PluginCall call) {
        JSObject result = new JSObject();
        result.put("routes", new JSArray());
        call.resolve(result);
    }
}
