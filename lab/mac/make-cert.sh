#!/usr/bin/env bash
# Generate a two-day test CA/leaf on the owner's Mac. Does NOT install/trust either certificate.
set -euo pipefail
lab_ip="${1:-}"
if [[ ! "$lab_ip" =~ ^(10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+)$ ]]; then echo 'Provide the private LAN address selected for the approved local test.'; exit 2; fi
lab_root="$(cd "$(dirname "$0")/.." && pwd)"
cert_dir="$lab_root/certs"
if [[ -e "$cert_dir" ]]; then echo 'certs already exists. Preserve it; choose a new session directory before regeneration.'; exit 2; fi
mkdir -m 700 "$cert_dir"
umask 077
cat > "$cert_dir/ca.cnf" <<'CONFIG'
[req]
distinguished_name=dn
x509_extensions=ca_extensions
prompt=no
[dn]
CN=Epicurean Temporary Local Test CA
[ca_extensions]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
CONFIG
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -config "$cert_dir/ca.cnf" -keyout "$cert_dir/ca.key" -out "$cert_dir/ca.pem" -subj '/CN=Epicurean Temporary Local Test CA' >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$cert_dir/server.key" -out "$cert_dir/server.csr" -subj '/CN=Epicurean Local POS Test' >/dev/null 2>&1
cat > "$cert_dir/extensions.cnf" <<CONFIG
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:$lab_ip,IP:127.0.0.1,DNS:localhost
CONFIG
openssl x509 -req -in "$cert_dir/server.csr" -CA "$cert_dir/ca.pem" -CAkey "$cert_dir/ca.key" -CAcreateserial -out "$cert_dir/server.pem" -days 2 -extfile "$cert_dir/extensions.cnf" >/dev/null 2>&1
openssl x509 -in "$cert_dir/ca.pem" -outform DER -out "$cert_dir/epicurean-test-ca.cer"
openssl verify -CAfile "$cert_dir/ca.pem" "$cert_dir/server.pem"
echo 'Generated only. No Keychain/iPhone trust changes were made.'
echo 'Only epicurean-test-ca.cer may be transferred to the approved test phone. Never transfer .key files.'
