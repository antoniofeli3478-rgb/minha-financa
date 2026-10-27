#!/bin/sh
# Minhas Finanças: abre o app (Mac e Linux). Precisa do Python 3.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 financas.py "$@"
fi
echo "O Python 3 não foi encontrado. Instale em https://www.python.org/downloads/"
echo "Ou abra o arquivo app/index.html direto no navegador (modo navegador)."
