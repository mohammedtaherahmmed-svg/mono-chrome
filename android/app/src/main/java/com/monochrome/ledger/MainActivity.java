package com.monochrome.ledger;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
  private static final String APP_URL = "https://brook-meadow-aurora-sail.grok.me";
  private static final String APP_HOST = "brook-meadow-aurora-sail.grok.me";
  private WebView web;
  private ProgressBar progress;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);
    web = findViewById(R.id.webview);
    progress = findViewById(R.id.progress);
    configureWebView();
    web.loadUrl(APP_URL);
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void configureWebView() {
    CookieManager cookies = CookieManager.getInstance();
    cookies.setAcceptCookie(true);
    cookies.setAcceptThirdPartyCookies(web, true);

    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    s.setDisplayZoomControls(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAllowed(uri)) return false;
            try {
              startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
          }

          @Override
          public void onPageStarted(WebView view, String url, Bitmap favicon) {
            progress.setVisibility(View.VISIBLE);
          }

          @Override
          public void onPageFinished(WebView view, String url) {
            progress.setVisibility(View.GONE);
            CookieManager.getInstance().flush();
          }

          @Override
          public void onReceivedError(
              WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) progress.setVisibility(View.GONE);
          }
        });

    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public void onProgressChanged(WebView view, int newProgress) {
            progress.setProgress(newProgress);
            progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
          }
        });
  }

  private boolean isAllowed(Uri uri) {
    if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
    String host = uri.getHost();
    if (host == null) return false;
    host = host.toLowerCase();
    return host.equals(APP_HOST)
        || host.equals("grok.com")
        || host.endsWith(".grok.com")
        || host.equals("x.ai")
        || host.endsWith(".x.ai");
  }

  @Override
  public void onBackPressed() {
    if (web != null && web.canGoBack()) web.goBack();
    else super.onBackPressed();
  }

  @Override
  protected void onPause() {
    if (web != null) web.onPause();
    super.onPause();
  }

  @Override
  protected void onResume() {
    super.onResume();
    if (web != null) web.onResume();
  }
}
