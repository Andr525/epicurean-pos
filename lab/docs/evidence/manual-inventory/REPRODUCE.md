# Epicurean Master reproduction report

Run: lab-1791788432927-42a92c
Physical acceptance: NOT ESTABLISHED
Catalog SHA256: 4073c2157582157c0cfc1f817b83decf5641aee969d9afb61d1520acbc83a9dc
Result: 2 passed, 1 failed

Scripted interpretation; inspect JSON and POS screenshots before sharing.

## manual-catalog: passed

Assertions passed.

Reproduction:
- {"kind":"tap","selector":"#numpad button:nth-child(5)","bounds":{"x":169,"y":324.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#app-content button[onclick=\"openTableService()\"]","bounds":{"x":13,"y":118.9375,"w":188,"h":64}}
- {"kind":"floor","selector":"[data-table=\"14\"]","bounds":{"x":24,"y":284.15625,"w":122.5384521484375,"h":122.5384521484375}}

## manual-allergy-identity: failed

Missing distinct allergy controls for authoritative position 2A

Reproduction:
- {"kind":"tap","selector":"#numpad button:nth-child(5)","bounds":{"x":169,"y":324.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#app-content button[onclick=\"openTableService()\"]","bounds":{"x":13,"y":118.9375,"w":188,"h":64}}
- {"kind":"floor","selector":"[data-table=\"14\"]","bounds":{"x":24,"y":284.15625,"w":122.5384521484375,"h":122.5384521484375}}
- {"kind":"tap","selector":".seat-chip[data-seat=\"2A\"]","bounds":{"x":228.859375,"y":313.875,"w":52,"h":44}}
- {"kind":"tap","selector":".period-tabs button:nth-child(3)","bounds":{"x":201,"y":438.5625,"w":95.703125,"h":40}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-course-1\"][value=\"9\"])","bounds":{"x":41,"y":324.375,"w":320,"h":33}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-course-2\"][value=\"5\"])","bounds":{"x":41,"y":323.890625,"w":320,"h":33}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-temp-2-5\"][value=\"Medium\"])","bounds":{"x":63.390625,"y":322.65625,"w":92.515625,"h":36}}
- {"kind":"tap","selector":"#pf-overlay .pf-sel-actions .send-btn","bounds":{"x":41,"y":542.984375,"w":157.234375,"h":44.78125}}
- {"kind":"tap","selector":"#order-top button[onclick=\"openAllergyEditor()\"]","bounds":{"x":263.90625,"y":319.53125,"w":40.140625,"h":32}}

Evidence: corresponding case screenshot and actual/screen fields in results JSON.

## manual-menu: passed

Assertions passed.

Reproduction:
- {"kind":"tap","selector":"#numpad button:nth-child(5)","bounds":{"x":169,"y":324.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#numpad button:nth-child(11)","bounds":{"x":169,"y":476.90625,"w":64,"h":64}}
- {"kind":"tap","selector":"#app-content button[onclick=\"openTableService()\"]","bounds":{"x":13,"y":118.9375,"w":188,"h":64}}
- {"kind":"floor","selector":"[data-table=\"14\"]","bounds":{"x":24,"y":284.15625,"w":122.5384521484375,"h":122.5384521484375}}
- {"kind":"tap","selector":".seat-chip[data-seat=\"2A\"]","bounds":{"x":228.859375,"y":313.875,"w":52,"h":44}}
- {"kind":"tap","selector":".period-tabs button:nth-child(3)","bounds":{"x":201,"y":438.5625,"w":95.703125,"h":40}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-course-1\"][value=\"9\"])","bounds":{"x":41,"y":324.375,"w":320,"h":33}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-course-2\"][value=\"5\"])","bounds":{"x":41,"y":323.890625,"w":320,"h":33}}
- {"kind":"tap","selector":"label:has(input[name=\"pf-temp-2-5\"][value=\"Medium\"])","bounds":{"x":63.390625,"y":322.65625,"w":92.515625,"h":36}}
- {"kind":"tap","selector":"#pf-overlay .pf-sel-actions .send-btn","bounds":{"x":41,"y":542.984375,"w":157.234375,"h":44.78125}}
