#!/bin/bash

# Demo script para usar la API de Mojito en Render
# Uso: ./mojito_api.sh "tu mensaje aquí"

API_URL="https://sof-xd.onrender.com/api"
API_KEY="mojito_secret_123"  # Cambiá esto por tu clave real

if [ -z "$1" ]; then
    echo "Usage: $0 \"tu mensaje aquí\""
    echo ""
    echo "Ejemplos:"
    echo '  $0 "Hola, cómo estás?"'
    echo '  $0 "Traduce al inglés: El sol es hermoso"'
    exit 1
fi

MESSAGE="$1"

echo "🤖 Enviando a Mojito: \"$MESSAGE\""
echo "---"

curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "{
    \"model\": \"dolphin3:8b\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"$MESSAGE\"}
    ],
    \"stream\": false
  }" | jq -r '.choices[0].message.content'

echo ""
echo "---"
echo "✅ Listo"
