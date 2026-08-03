package br.com.lifeos.gumate;

import android.content.Context;
import android.content.SharedPreferences;

final class AppSettings {
    private static final String PREFS = "gumate_settings";
    private static final String KEY_URL = "server_url";
    private static final String KEY_TOKEN = "device_token";
    private static final String KEY_DEVICE = "device_name";
    private static final String KEY_AUTO_START = "auto_start";

    private AppSettings() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String serverUrl(Context context) {
        return prefs(context).getString(KEY_URL, "");
    }

    static String token(Context context) {
        return prefs(context).getString(KEY_TOKEN, "");
    }

    static String deviceName(Context context) {
        return prefs(context).getString(KEY_DEVICE, "Moto E - Escritorio");
    }

    static boolean autoStart(Context context) {
        return prefs(context).getBoolean(KEY_AUTO_START, false);
    }

    static void save(Context context, String url, String token, String deviceName) {
        String normalizedUrl = url == null ? "" : url.trim().replaceAll("/+$", "");
        prefs(context).edit()
            .putString(KEY_URL, normalizedUrl)
            .putString(KEY_TOKEN, token == null ? "" : token.trim())
            .putString(KEY_DEVICE, deviceName == null ? "" : deviceName.trim())
            .apply();
    }

    static void setAutoStart(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_AUTO_START, enabled).apply();
    }
}
