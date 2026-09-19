package com.monochrome.ledger;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

final class Prefs {
  private static final String FILE = "mono_chrome";
  private static final String KEY_URL = "web_app_url";

  private Prefs() {}

  static String resolveUrl(Context ctx) {
    String saved = getSavedUrl(ctx);
    if (!saved.isEmpty()) return saved;
    String baked = ctx.getString(R.string.web_app_url).trim();
    if (baked.isEmpty() || baked.contains("WEB_APP_URL_PLACEHOLDER")) return "";
    return baked;
  }

  static String getSavedUrl(Context ctx) {
    return prefs(ctx).getString(KEY_URL, "");
  }

  static void saveUrl(Context ctx, String url) {
    if (TextUtils.isEmpty(url)) return;
    prefs(ctx).edit().putString(KEY_URL, url.trim()).apply();
  }

  private static SharedPreferences prefs(Context ctx) {
    return ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE);
  }
}
