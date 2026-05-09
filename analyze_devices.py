import json

with open('graph.json') as f:
    data = json.load(f)

devices = data.get('devices', [])
devices_by_type = {}

for device in devices:
    device_type = device['type']
    if device_type not in devices_by_type:
        devices_by_type[device_type] = []
    devices_by_type[device_type].append({
        'id': int(device['id']),
        'name': device['name']
    })

for device_type in sorted(devices_by_type.keys()):
    devices_list = devices_by_type[device_type]
    ids = sorted([d['id'] for d in devices_list])
    names = [d['name'] for d in devices_list]
    print(f"{device_type}:")
    print(f"  IDs: {ids}")
    print(f"  Names: {names}")
    print()
