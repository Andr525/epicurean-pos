#!/usr/bin/env bash
# Owner-started session only; installs nothing and does not enumerate/inspect devices.
set -euo pipefail
if [[ "${1:-}" != '--owner-approved' || -z "${2:-}" ]]; then
  echo 'After owner approval: bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP'
  exit 2
fi
lab_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$lab_root"
bash mac/preflight.sh
lab_ip="$2"
node --input-type=module - "$lab_ip" <<'JS'
import {isIP} from 'node:net';
const ip=process.argv[2];
if(isIP(ip)!==4||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)))throw Error('Use the Mac private Wi-Fi IPv4 address');
JS
if [[ ! -d certs ]]; then bash mac/make-cert.sh "$lab_ip"; fi
node --input-type=module - "$lab_ip" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';import {X509Certificate} from 'node:crypto';
const host=process.argv[2],cert=new X509Certificate(readFileSync('certs/server.pem'));
if(!cert.checkIP(host)||Date.parse(cert.validTo)<=Date.now())throw Error('Existing certificate does not cover this IP or has expired. Stop; regenerate the temporary lab certificates.');
writeFileSync('owner-approval.json',JSON.stringify({deviceAccessApproved:true,scope:'isolated-pos-fixture-only',host,additionalSpendingLimitMicroUsd:0,expiresAt:new Date(Date.now()+3600000).toISOString(),nativeAutomationApproved:false},null,2),{mode:0o600});
JS
echo 'Owner-started HTTPS session, maximum 60 minutes. No Appium, paid APIs or deployment.'
echo 'Install/trust ONLY certs/epicurean-test-ca.cer on the test iPhone; never transfer .key files.'
exec node server.mjs --host="$lab_ip" --port=9443 --cert=certs/server.pem --key=certs/server.key --approval=owner-approval.json
