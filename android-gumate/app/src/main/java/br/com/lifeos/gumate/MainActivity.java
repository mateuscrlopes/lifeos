package br.com.lifeos.gumate;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int REQUEST_AUDIO = 101;
    private TextView statusText;
    private EditText serverUrlInput;
    private EditText tokenInput;
    private EditText deviceNameInput;

    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (GumateService.ACTION_STATUS.equals(intent.getAction())) {
                statusText.setText(intent.getStringExtra(GumateService.EXTRA_STATUS));
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.statusText);
        serverUrlInput = findViewById(R.id.serverUrlInput);
        tokenInput = findViewById(R.id.tokenInput);
        deviceNameInput = findViewById(R.id.deviceNameInput);
        Button saveButton = findViewById(R.id.saveButton);
        Button startButton = findViewById(R.id.startButton);
        Button stopButton = findViewById(R.id.stopButton);

        serverUrlInput.setText(AppSettings.serverUrl(this));
        tokenInput.setText(AppSettings.token(this));
        deviceNameInput.setText(AppSettings.deviceName(this));

        saveButton.setOnClickListener(view -> {
            saveSettings();
            Toast.makeText(this, "Configuracao salva.", Toast.LENGTH_SHORT).show();
        });

        startButton.setOnClickListener(view -> {
            saveSettings();
            if (!hasAudioPermission()) {
                requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_AUDIO);
                return;
            }
            startGumate();
        });

        stopButton.setOnClickListener(view -> {
            AppSettings.setAutoStart(this, false);
            stopService(new Intent(this, GumateService.class));
            statusText.setText("Parado");
        });
    }

    private void saveSettings() {
        AppSettings.save(
            this,
            serverUrlInput.getText().toString(),
            tokenInput.getText().toString(),
            deviceNameInput.getText().toString()
        );
    }

    private boolean hasAudioPermission() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void startGumate() {
        if (AppSettings.serverUrl(this).isEmpty() || AppSettings.token(this).isEmpty()) {
            Toast.makeText(this, "Informe o endereco e o token.", Toast.LENGTH_LONG).show();
            return;
        }
        AppSettings.setAutoStart(this, true);
        startService(new Intent(this, GumateService.class));
        statusText.setText("Iniciando...");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_AUDIO && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startGumate();
        } else {
            Toast.makeText(this, "O microfone e necessario para o Gumate.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        registerReceiver(statusReceiver, new IntentFilter(GumateService.ACTION_STATUS));
    }

    @Override
    protected void onStop() {
        unregisterReceiver(statusReceiver);
        super.onStop();
    }
}
