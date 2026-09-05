#!/usr/bin/env bash
# Build the `rinn` model in a local Ollama from the Modelfile.
#   ./scripts/create_model.sh            -> creates model "rinn"
#   RINN_MODEL_NAME=rinn-dev ./scripts/create_model.sh
set -euo pipefail
cd "$(dirname "$0")/.."

command -v ollama >/dev/null 2>&1 || { echo "ollama is not installed: https://ollama.com/download" >&2; exit 1; }

NAME="${RINN_MODEL_NAME:-rinn}"
BASE="$(awk '/^FROM[[:space:]]/ {print $2; exit}' Modelfile)"

echo "Pulling base model ${BASE} ..."
ollama pull "${BASE}"
echo "Creating ${NAME} from Modelfile ..."
ollama create "${NAME}" -f Modelfile
echo
echo "Done. Try:  ollama run ${NAME}"
