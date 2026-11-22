#!/usr/bin/env bash
# =====================================================================
#  COPIA CIFRADA DE LA BASE DE DATOS  (/usr/local/sbin/floresloli-copia)
#
#  La lanza floresloli-copia.timer cada noche. Copia la base de datos en
#  caliente (sin parar la tienda), comprueba que está sana, la comprime y
#  la cifra con la clave pública de age de Álvaro: en el servidor no se
#  puede descifrar. Guarda 30 días en /var/backups/floresloli.
#
#  Restaurar una copia: docs/SERVIDOR.md, «Recuperar una copia».
# =====================================================================
set -Eeuo pipefail
umask 077

BASE=/var/lib/floresloli/tienda.sqlite
DESTINO=/var/backups/floresloli
DIAS=30

destinatario=$(tr -d '[:space:]' </etc/floresloli/copia-clave-publica)
[[ "$destinatario" =~ ^age1[a-z0-9]{58}$ ]] || { echo "Falta o no vale la clave pública de las copias (/etc/floresloli/copia-clave-publica)" >&2; exit 1; }
if [[ ! -f "$BASE" ]]; then
  echo "Todavía no hay base de datos: nada que copiar."
  exit 0
fi

tmp=$(mktemp -d "$DESTINO/.tmp.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT

sqlite3 "$BASE" ".timeout 15000" ".backup '$tmp/tienda.sqlite'"
estado=$(sqlite3 "$tmp/tienda.sqlite" 'PRAGMA integrity_check;')
[[ "$estado" == ok ]] || { echo "La copia no ha pasado la comprobación: $estado" >&2; exit 1; }

gzip -9 "$tmp/tienda.sqlite"
nombre="tienda-$(date +%Y%m%d-%H%M).sqlite.gz.age"
age -r "$destinatario" -o "$tmp/$nombre" "$tmp/tienda.sqlite.gz"
mv -- "$tmp/$nombre" "$DESTINO/$nombre"

find "$DESTINO" -maxdepth 1 -name 'tienda-*.sqlite.gz.age' -mtime +"$DIAS" -delete
echo "Copia hecha: $DESTINO/$nombre ($(du -h "$DESTINO/$nombre" | cut -f1))"
