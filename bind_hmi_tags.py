import openpyxl
import json

# Load graph.json to get device IDs
with open(r'c:\Users\lysog\Desktop\REpository\tia_repo\graph.json', 'r', encoding='utf-8') as f:
    graph_data = json.load(f)

# Build mapping: HMI tag name -> device ID
device_id_map = {}
for device in graph_data['devices']:
    # HMI tag name replaces dots with underscores
    hmi_name = device['name'].replace('.', '_') + '_FLTCode'
    device_id_map[hmi_name] = device['id']

# Load HMITags.xlsx
wb = openpyxl.load_workbook(r'c:\Users\lysog\Desktop\REpository\tia_repo\HMITags.xlsx')
ws = wb['Hmi Tags']

# Process rows (skip header)
updated = 0
for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=False), start=2):
    tag_name = row[0].value  # Column A: Name
    if tag_name and tag_name in device_id_map:
        device_id = device_id_map[tag_name]
        # Set PLC tag
        row[3].value = f'DB_Mechs.Mechs[{device_id}].FLTCode'  # Column D: PLC tag
        # Set Connection
        row[2].value = 'HMI_Connection_1'  # Column C: Connection
        # Set Access Method
        row[7].value = 'Symbolic access'   # Column H: Access Method
        # Set DataType to Word (to match existing bound tags)
        row[4].value = 'Word'              # Column E: DataType
        # Set HMI DataType
        row[5].value = 'Word'              # Column F: HMI DataType
        updated += 1
        print(f'Row {row_idx}: {tag_name} -> DB_Mechs.Mechs[{device_id}].FLTCode')

print(f'\nTotal updated: {updated}')

# Save
wb.save(r'c:\Users\lysog\Desktop\REpository\tia_repo\HMITags.xlsx')
print('File saved!')
