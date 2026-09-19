package com.monochrome.ledger;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

public class SetupActivity extends Activity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_setup);

    EditText field = findViewById(R.id.url_field);
    Button enter = findViewById(R.id.enter_button);
    String existing = Prefs.getSavedUrl(this);
    if (!existing.isEmpty()) field.setText(existing);

    enter.setOnClickListener(
        v -> {
          String raw = field.getText().toString().trim();
          if (TextUtils.isEmpty(raw)) {
            Toast.makeText(this, R.string.url_required, Toast.LENGTH_SHORT).show();
            return;
          }
          if (!raw.startsWith("https://") && !raw.startsWith("http://")) {
            raw = "https://" + raw;
          }
          Prefs.saveUrl(this, raw);
          startActivity(new Intent(this, MainActivity.class));
          finish();
        });
  }
}
