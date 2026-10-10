#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" != '--owner-approved' || -z "${2:-}" ]]; then
  echo 'Usage: bash mac/start-session.sh --owner-approved PRIVATE_MAC_IP'; exit 2
fi
lab_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$lab_root"
bash mac/preflight.sh
lab_ip="$2"
approval_file="$(mktemp /tmp/epicurean-approval.XXXXXX)"
trap 'rm -f "$approval_file"' EXIT
node --input-type=module - "$lab_ip" "$approval_file" <<'JS'
import {isIP} from 'node:net';import {writeFileSync} from 'node:fs';
const host=process.argv[2];if(isIP(host)!==4||!(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)))throw Error('Use Mac private Wi-Fi IPv4');
writeFileSync(process.argv[3],JSON.stringify({deviceAccessApproved:true,scope:'isolated-pos-fixture-only',host,additionalSpendingLimitMicroUsd:0,expiresAt:new Date(Date.now()+3600000).toISOString(),nativeAutomationApproved:false}),{mode:0o600});
JS
node server.mjs --host="$lab_ip" --port=9443 --mode=screen-only --approval="$approval_file"
