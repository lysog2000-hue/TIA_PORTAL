"""
Generate HMI discrete alarms for all devices from graph.json.
Based on template from HMIAlarms23.xlsx (ARB1 example).
Output: HMIAlarms_All.xlsx

Аварії по типах механізмів:
  BIT0 - Breaker       - всі типи
  BIT1 - Overflow      - Redler, Noria
  BIT2 - Speed         - Redler, Noria (тахо)
  BIT3 - Alingment     - Noria
  BIT4 - TimeOut       - Gate2P, Valve3P (таймаут переміщення)
  BIT5 - PosUnknown    - Gate2P, Valve3P (невизначена позиція)
  BIT6 - StopTimeout   - Redler, Noria, Fan, Separator, Feeder (таймаут вибігу)
  BIT8 - Feedback      - Redler, Noria, Fan, Separator, Feeder (зворотній зв'язок контактора)
"""

import json
import openpyxl

# ── Read graph.json ──
with open('graph.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

devices = data.get('devices', [])
print(f"Found {len(devices)} devices")

# ── Alarm definitions per device type ──
# Format: (bit, suffix, alarm_text)
ALARMS_BY_TYPE = {
    'Redler': [
        (0, 'Breaker',     "Спрацював АВ"),
        (1, 'Overflow',    "Датчик підпору"),
        (2, 'Speed',       "Датчик швидкості"),
        (6, 'StopTimeout', "Тайм-аут вибігу"),
        (8, 'Feedback',    "Відсутній зворотній зв'язок контактора"),
    ],
    'Noria': [
        (0, 'Breaker',     "Спрацював АВ"),
        (1, 'Overflow',    "Датчик підпору"),
        (2, 'Speed',       "Датчик швидкості"),
        (3, 'Alingment',   "Датчик сходу стрічки"),
        (6, 'StopTimeout', "Тайм-аут вибігу"),
        (8, 'Feedback',    "Відсутній зворотній зв'язок контактора"),
    ],
    'Fan': [
        (0, 'Breaker',     "Спрацював АВ"),
        (6, 'StopTimeout', "Тайм-аут вибігу"),
        (8, 'Feedback',    "Відсутній зворотній зв'язок контактора"),
    ],
    'Separator': [
        (0, 'Breaker',     "Спрацював АВ"),
        (6, 'StopTimeout', "Тайм-аут вибігу"),
        (8, 'Feedback',    "Відсутній зворотній зв'язок контактора"),
    ],
    'Feeder': [
        (0, 'Breaker',     "Спрацював АВ"),
        (6, 'StopTimeout', "Тайм-аут вибігу"),
        (8, 'Feedback',    "Відсутній зворотній зв'язок контактора"),
    ],
    'Gate2P': [
        (0, 'Breaker',    "Спрацював АВ"),
        (4, 'TimeOut',    "Тайм-аут переміщення"),
        (5, 'PosUnknown', "Невизначена позиція"),
    ],
    'Valve3P': [
        (0, 'Breaker',    "Спрацював АВ"),
        (4, 'TimeOut',    "Тайм-аут переміщення"),
        (5, 'PosUnknown', "Невизначена позиція"),
    ],
    'Silos': [
        (0, 'Breaker', "Спрацював АВ"),
    ],
    'Sushka': [
        (0, 'Breaker', "Спрацював АВ"),
    ],
    'ReceivingPit': [
        (0, 'Breaker', "Спрацював АВ"),
    ],
}

# ── Read template row from HMIAlarms23.xlsx ──
tpl_wb = openpyxl.load_workbook('HMIAlarms23.xlsx')
tpl_ws = tpl_wb.active
template_row = {}
for c in range(1, tpl_ws.max_column + 1):
    header = tpl_ws.cell(row=1, column=c).value
    template_row[header] = tpl_ws.cell(row=2, column=c).value
tpl_wb.close()

print(f"Template columns: {list(template_row.keys())}")

# ── Build alarm rows ──
alarm_rows = []
alarm_id = 1

for dev in devices:
    dev_name = dev['name'].replace('.', '_')
    dev_type = dev.get('type', '')

    alarm_defs = ALARMS_BY_TYPE.get(dev_type)
    if not alarm_defs:
        print(f"  WARNING: unknown type '{dev_type}' for device '{dev_name}' — skipped")
        continue

    for bit, suffix, alarm_text in alarm_defs:
        row = {}
        for col_name, col_value in template_row.items():
            if col_name == 'ID':
                row[col_name] = alarm_id
            elif col_name == 'Name':
                row[col_name] = f"{dev_name}_{suffix}"
            elif col_name == 'Alarm text [en-US], Alarm text 1':
                row[col_name] = f"{alarm_text} {dev_name}"
            elif col_name == 'Trigger tag':
                row[col_name] = f"{dev_name}_FLTCode"
            elif col_name == 'Trigger bit':
                row[col_name] = bit
            else:
                row[col_name] = col_value
        alarm_rows.append(row)
        alarm_id += 1

print(f"Generated {len(alarm_rows)} alarm rows")

# ── Write to new workbook ──
headers = list(template_row.keys())

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "DiscreteAlarms"

for c, h in enumerate(headers, 1):
    ws.cell(row=1, column=c, value=h)

for r_idx, row_data in enumerate(alarm_rows, 2):
    for c_idx, h in enumerate(headers, 1):
        ws.cell(row=r_idx, column=c_idx, value=row_data.get(h))

output_file = 'HMIAlarms_All.xlsx'
wb.save(output_file)
print(f"Saved to {output_file}")

# ── Summary by type ──
print("\nAlarms per type:")
type_counts = {}
for dev in devices:
    t = dev.get('type', 'unknown')
    defs = ALARMS_BY_TYPE.get(t, [])
    type_counts[t] = type_counts.get(t, 0) + len(defs)
for t, cnt in sorted(type_counts.items()):
    dev_cnt = sum(1 for d in devices if d.get('type') == t)
    alarms_per = len(ALARMS_BY_TYPE.get(t, []))
    print(f"  {t:15s}: {dev_cnt:3d} devices x {alarms_per} alarms = {cnt:4d} rows")
print(f"\nTotal: {len(alarm_rows)} alarms for {len(devices)} devices")
