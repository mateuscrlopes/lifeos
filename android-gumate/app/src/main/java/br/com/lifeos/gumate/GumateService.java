package br.com.lifeos.gumate;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.RecognitionListener;
import org.vosk.Recognizer;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GumateService extends Service implements RecognitionListener {
    public static final String ACTION_STATUS = "br.com.lifeos.gumate.STATUS";
    public static final String EXTRA_STATUS = "status";

    private static final int NOTIFICATION_ID = 27;
    private static final String CHANNEL_ID = "gumate_listening";
    private static final long WAKE_COOLDOWN_MS = 2500L;

    private Model model;
    private SpeechService voskService;
    private SpeechRecognizer androidRecognizer;
    private TextToSpeech textToSpeech;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean busy = false;
    private long lastWakeAt = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, createNotification("Preparando o reconhecimento de voz"));
        initializeTts();
        unpackModel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        broadcastStatus("Gumate ativo — preparando...");
        return START_STICKY;
    }

    private void unpackModel() {
        broadcastStatus("Carregando modelo de portugues...");
        StorageService.unpack(
            this,
            "model-pt",
            "gumate-model",
            unpackedModel -> {
                model = unpackedModel;
                startWakeListening();
            },
            exception -> {
                broadcastStatus("Erro ao carregar o modelo: " + exception.getMessage());
                speakThen("Nao consegui carregar meu modelo de voz.", null);
            }
        );
    }

    private void initializeTts() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                textToSpeech.setLanguage(new Locale("pt", "BR"));
                textToSpeech.setSpeechRate(1.02f);
            }
        });
    }

    private void startWakeListening() {
        if (model == null || busy) return;
        stopVosk();
        try {
            Recognizer recognizer = new Recognizer(model, 16000.0f);
            voskService = new SpeechService(recognizer, 16000.0f);
            voskService.startListening(this);
            broadcastStatus("Escutando: Gumate, Gumete, Jarvis ou Assistente");
            updateNotification("Escutando a palavra de ativacao");
        } catch (Exception exception) {
            broadcastStatus("Falha ao iniciar microfone: " + exception.getMessage());
        }
    }

    private boolean containsWakeWord(String raw) {
        String text = normalize(raw);
        return text.contains("gumate")
            || text.contains("gumete")
            || text.contains("guma te")
            || text.contains("uma ate")
            || text.contains("jarvis")
            || text.contains("assistente");
    }

    private String normalize(String value) {
        String normalized = Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
            .replaceAll("[\\p{InCombiningDiacriticalMarks}]", "")
            .toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9\\s]", " ")
            .replaceAll("\\s+", " ")
            .trim();
        return normalized;
    }

    private String extractText(String hypothesis, String key) {
        try {
            return new JSONObject(hypothesis).optString(key, "");
        } catch (Exception ignored) {
            return "";
        }
    }

    private void detectWake(String hypothesis, String key) {
        if (busy || System.currentTimeMillis() - lastWakeAt < WAKE_COOLDOWN_MS) return;
        String text = extractText(hypothesis, key);
        if (!containsWakeWord(text)) return;

        lastWakeAt = System.currentTimeMillis();
        busy = true;
        stopVosk();
        broadcastStatus("Ativado — aguardando seu pedido");
        speakThen("Pois nao?", this::startCommandRecognition);
    }

    private void startCommandRecognition() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            busy = false;
            speakThen("O reconhecimento do Android nao esta disponivel.", this::startWakeListening);
            return;
        }

        try {
            if (androidRecognizer != null) androidRecognizer.destroy();
            androidRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            androidRecognizer.setRecognitionListener(new AndroidCommandListener());

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 900L);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 700L);
            androidRecognizer.startListening(intent);
            broadcastStatus("Ouvindo seu comando...");
            updateNotification("Ouvindo um comando");
        } catch (Exception exception) {
            busy = false;
            speakThen("Nao consegui abrir o reconhecimento de voz.", this::startWakeListening);
        }
    }

    private void processCommand(String command) {
        String clean = command == null ? "" : command.trim();
        if (clean.isEmpty()) {
            busy = false;
            speakThen("Nao ouvi o pedido.", this::startWakeListening);
            return;
        }

        broadcastStatus("Processando: “" + clean + "”");
        updateNotification("Processando o comando");
        executor.submit(() -> {
            String answer;
            try {
                answer = GumateApi.sendCommand(this, clean);
            } catch (Exception exception) {
                answer = exception.getMessage() == null
                    ? "Nao consegui falar com o LifeOS."
                    : exception.getMessage();
            }
            String finalAnswer = answer;
            runOnMain(() -> {
                broadcastStatus(finalAnswer);
                speakThen(finalAnswer, () -> {
                    busy = false;
                    startWakeListening();
                });
            });
        });
    }

    private void speakThen(String text, Runnable after) {
        if (textToSpeech == null) {
            if (after != null) after.run();
            return;
        }
        String utteranceId = "gumate-" + System.nanoTime();
        textToSpeech.setOnUtteranceProgressListener(new android.speech.tts.UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onError(String id) { runOnMain(after); }
            @Override public void onDone(String id) { runOnMain(after); }
        });
        textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
    }

    private void runOnMain(Runnable runnable) {
        if (runnable == null) return;
        new android.os.Handler(getMainLooper()).post(runnable);
    }

    private void stopVosk() {
        if (voskService != null) {
            voskService.stop();
            voskService.shutdown();
            voskService = null;
        }
    }

    private void broadcastStatus(String status) {
        Intent intent = new Intent(ACTION_STATUS);
        intent.putExtra(EXTRA_STATUS, status);
        sendBroadcast(intent);
    }

    private Notification createNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0
        );
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setContentTitle("Gumate ativo")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(NOTIFICATION_ID, createNotification(text));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel),
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            manager.createNotificationChannel(channel);
        }
    }

    @Override public void onPartialResult(String hypothesis) { detectWake(hypothesis, "partial"); }
    @Override public void onResult(String hypothesis) { detectWake(hypothesis, "text"); }
    @Override public void onFinalResult(String hypothesis) { detectWake(hypothesis, "text"); }
    @Override public void onError(Exception exception) {
        broadcastStatus("Reconhecimento reiniciado: " + exception.getMessage());
        runOnMain(this::startWakeListening);
    }
    @Override public void onTimeout() { runOnMain(this::startWakeListening); }

    @Override
    public void onDestroy() {
        stopVosk();
        if (androidRecognizer != null) androidRecognizer.destroy();
        if (textToSpeech != null) textToSpeech.shutdown();
        if (model != null) model.close();
        executor.shutdownNow();
        broadcastStatus("Parado");
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    private final class AndroidCommandListener implements android.speech.RecognitionListener {
        @Override public void onReadyForSpeech(android.os.Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onPartialResults(android.os.Bundle partialResults) {}
        @Override public void onEvent(int eventType, android.os.Bundle params) {}

        @Override
        public void onError(int error) {
            if (androidRecognizer != null) {
                androidRecognizer.destroy();
                androidRecognizer = null;
            }
            busy = false;
            speakThen("Nao consegui entender. Pode tentar de novo.", GumateService.this::startWakeListening);
        }

        @Override
        public void onResults(android.os.Bundle results) {
            ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (androidRecognizer != null) {
                androidRecognizer.destroy();
                androidRecognizer = null;
            }
            processCommand(matches == null || matches.isEmpty() ? "" : matches.get(0));
        }
    }
}
