import json

with open('graph.json') as f:
    data = json.load(f)

devices = data.get('devices', [])

# Создаём JS код с полным отображением
print("/**")
print(" * StartPortId.js")
print(" * Функция для получения точного имени механизма по его ID")
print(" * Автоматически сгенерировано из graph.json")
print(" */")
print()
print("export function GetMechanismName(deviceId) {")
print("    const deviceMap = {")

for device in sorted(devices, key=lambda x: int(x['id'])):
    device_id = device['id']
    device_name = device['name']
    print(f"        {device_id}: \"{device_name}\",")

print("    };")
print()
print("    const id = Number(deviceId);")
print("    return deviceMap[id] || `Unknown (ID: ${id})`;")
print("}")
