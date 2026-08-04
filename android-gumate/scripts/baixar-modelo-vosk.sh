#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_DIR/app/src/main/assets"
MODEL_DIR="$ASSETS_DIR/model-pt"
TMP_DIR="${TMPDIR:-/tmp}/gumate-vosk-model"
URL="https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"

if [[ -d "$MODEL_DIR" \
  && -f "$MODEL_DIR/conf/mfcc.conf" \
  && -f "$MODEL_DIR/uuid" ]]; then
  echo "Modelo Vosk ja instalado em $MODEL_DIR"
  exit 0
fi

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$ASSETS_DIR"

echo "Baixando modelo portugues do Vosk..."
curl --fail --location "$URL" --output "$TMP_DIR/model.zip"
unzip -q "$TMP_DIR/model.zip" -d "$TMP_DIR/unpacked"

SOURCE_DIR="$(find "$TMP_DIR/unpacked" -mindepth 1 -maxdepth 1 -type d | head -1)"

rm -rf "$MODEL_DIR"
mv "$SOURCE_DIR" "$MODEL_DIR"

# O StorageService do Vosk exige este arquivo para controlar
# a versao do modelo copiada para o armazenamento do Android.
printf '%s\n' 'vosk-model-small-pt-0.3-gumate-v1' > "$MODEL_DIR/uuid"

echo "Modelo instalado em $MODEL_DIR"