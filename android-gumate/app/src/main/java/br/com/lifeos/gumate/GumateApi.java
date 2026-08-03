package br.com.lifeos.gumate;

import android.content.Context;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class GumateApi {
    private GumateApi() {}

    static String sendCommand(Context context, String command) throws Exception {
        String baseUrl = AppSettings.serverUrl(context);
        String token = AppSettings.token(context);
        if (baseUrl.isEmpty() || token.isEmpty()) {
            throw new IllegalStateException("Endereco ou token nao configurado.");
        }

        URL url = new URL(baseUrl + "/gumate/comando");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(18000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("X-Gumate-Token", token);

        JSONObject body = new JSONObject();
        body.put("texto", command);
        body.put("dispositivo", AppSettings.deviceName(context));
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);

        try (OutputStream output = connection.getOutputStream()) {
            output.write(bytes);
        }

        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 400
            ? connection.getInputStream()
            : connection.getErrorStream();
        String response = readAll(stream);
        connection.disconnect();

        JSONObject json = new JSONObject(response);
        String spoken = json.optString("resposta", "Nao recebi uma resposta valida.");
        if (status < 200 || status >= 300) {
            throw new IllegalStateException(spoken);
        }
        return spoken;
    }

    private static String readAll(InputStream stream) throws Exception {
        if (stream == null) return "{}";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }
}
