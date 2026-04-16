#!/bin/sh
# Generate a self-signed certificate for WAF Tools HTTPS access.
# Usage: ./generate-cert.sh [IP_OR_HOSTNAME]
#
# Examples:
#   ./generate-cert.sh 10.10.2.150
#   ./generate-cert.sh waf.internal.company.com
#   ./generate-cert.sh                          # defaults to localhost

set -e

SUBJECT="${1:-localhost}"
CERT_DIR="$(dirname "$0")/nginx/certs"

mkdir -p "$CERT_DIR"

# Determine SAN entry
case "$SUBJECT" in
  [0-9]*)  SAN="IP:${SUBJECT}" ;;
  *)       SAN="DNS:${SUBJECT}" ;;
esac

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "${CERT_DIR}/server.key" \
  -out "${CERT_DIR}/server.crt" \
  -subj "/CN=${SUBJECT}/O=WAF Tools" \
  -addext "subjectAltName=${SAN}"

echo ""
echo "Certificate generated:"
echo "  ${CERT_DIR}/server.crt"
echo "  ${CERT_DIR}/server.key"
echo ""
echo "Valid for 10 years. Subject: ${SUBJECT}"
