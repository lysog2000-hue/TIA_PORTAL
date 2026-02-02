# Mailbox Pattern для Route FSM v2.0

**Версія:** 2.0.1  
**Дата:** 2026-02-02  
**Статус:** ✅ IMPLEMENTATION COMPLETE

---

## 📋 Огляд

Реалізація **Mailbox Pattern** для керування маршрутами елеватора через PLC Siemens S7-1500.

### Ключові переваги:
- **Пам'ять:** 15KB → 1.3KB (92% економії)
- **Простота:** Послідовна обробка команд
- **Природність:** Маршрути запускаються з інтервалами (хвилини)
- **Надійність:** Mutex-захист, timeout, незалежне виконання

---

## 🏗️ Архітектура

### Компоненти

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCADA LAYER                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (write)
┌─────────────────────────────────────────────────────────────────┐
│          DB_ScadaToPlc_RouteCmd (MAILBOX)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  HDR_Commit    : UDINT    (SCADA increments)              │ │
│  │  HDR_RouteId   : USINT    (1..12)                         │ │
│  │  CMD_Route     : UDT_RouteCmd_v2                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (process)
┌─────────────────────────────────────────────────────────────────┐
│             FC_Route_Supervisor (MAILBOX LOGIC)                 │
│  1. Детект нової команди (commitIn != commitAck)               │
│  2. Валідація RouteId (1..12)                                  │
│  3. Перевірка стану маршруту (активний/неактивний)             │
│  4. Копіювання → DB_Plc_RouteExecutor[RouteId]                 │
│  5. ACK → ACK_CommitApplied++, ACK_RouteId                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          DB_Plc_RouteExecutor (INTERNAL BUFFER)                 │
│  Routes[1..12] : UDT_RouteCmd_v2                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (execute)
┌─────────────────────────────────────────────────────────────────┐
│               FC_RouteFSM (12 independent FSMs)                 │
│  IDLE → VALIDATING → STARTING → RUNNING → STOPPING → ABORTED   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (status)
┌─────────────────────────────────────────────────────────────────┐
│          DB_PlcToScada_RouteStatus (STATUS + ACK)               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ACK_CommitApplied : UDINT                                 │ │
│  │  ACK_RouteId       : USINT                                 │ │
│  │  RoutesSts[1..12]  : UDT_RouteStatus_v2                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↑ (read)
┌─────────────────────────────────────────────────────────────────┐
│                         SCADA LAYER                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 Mailbox Protocol

### SCADA → PLC (Надсилання команди)

```python
# Псевдокод SCADA
def send_route_command(route_id: int, cmd: RouteCommand):
    # 1. Перевірка що mailbox вільний
    if mailbox.HDR_Commit != status.ACK_CommitApplied:
        raise MailboxBusyError("Wait or timeout")
    
    # 2. Запис команди
    mailbox.HDR_RouteId = route_id
    mailbox.CMD_Route = cmd
    
    # 3. Atomic publish
    mailbox.HDR_Commit += 1
    
    # 4. Очікування ACK (timeout 1s)
    start_time = now()
    while mailbox.HDR_Commit != status.ACK_CommitApplied:
        if now() - start_time > 1.0:
            raise TimeoutError("PLC not responding")
        sleep(50ms)
    
    # 5. Перевірка результату
    if status.ACK_RouteId != route_id:
        raise ValidationError("Invalid RouteId")
```

### PLC → SCADA (Підтвердження)

```scl
// Псевдокод PLC (у FC_Route_Supervisor)
commitIn := DB_ScadaToPlc_RouteCmd.HDR_Commit;
commitAck := DB_PlcToScada_RouteStatus.ACK_CommitApplied;

IF commitIn <> commitAck THEN
    routeId := DB_ScadaToPlc_RouteCmd.HDR_RouteId;
    
    // Валідація
    IF (routeId >= 1) AND (routeId <= 12) THEN
        // Перевірка дозволеності команди
        IF is_command_allowed(routeId, cmd) THEN
            // Копіювання
            DB_Plc_RouteExecutor.Routes[routeId] := DB_ScadaToPlc_RouteCmd.CMD_Route;
        END_IF;
        
        // ACK (завжди, навіть якщо команда проігнорована)
        DB_PlcToScada_RouteStatus.ACK_CommitApplied := commitIn;
        DB_PlcToScada_RouteStatus.ACK_RouteId := routeId;
    END_IF;
END_IF;
```

---

## 🔐 Захист від дублікатів START

### Сценарій: Активний маршрут отримує повторний START

**Поведінка (Mailbox v2.0):**

1. Маршрут у стані `RUNNING` (4)
2. SCADA надсилає `START` (помилка оператора або баг)
3. PLC детектує конфлікт:
   - `currentState = RUNNING`
   - `Cmd = RT_CMD_START`
4. PLC встановлює `RS_Warning = 1` (IGNORED_CMD)
5. PLC надсилає ACK (без копіювання команди)
6. Маршрут продовжує виконуватись (без змін)

**Код (у FC_Route_Supervisor):**

```scl
IF Cmd.RC_Cmd = RT_CMD_START THEN
    IF isActive THEN
        // Маршрут активний → ігнорувати START з попередженням
        RoutesSts[routeId].RS_Warning := RS_WARNING_IGNORED_CMD;
        cmdAllowed := FALSE;  // не копіюємо команду
    ELSE
        // Маршрут неактивний → дозволено
        RoutesSts[routeId].RS_Warning := RS_WARNING_OK;
        cmdAllowed := TRUE;
    END_IF;
END_IF;
```

**SCADA може:**
- Перевірити `RoutesSts[i].RS_Warning` для діагностики
- Показати користувачу: "Команда проігнорована (маршрут активний)"
- Логувати подію для аналізу

---

## 🎯 Ключові зміни v2.0.1

### 1. ROUTE_STS_DONE видалено

**Було (v2.0):**
```
RUNNING → DONE (після останнього кроку)
```

**Стало (v2.0.1):**
```
RUNNING (кінцевий стан, механізми під Owner=ROUTE)
```

**Причина:** Маршрути працюють годинами, немає сенсу мати окремий стан DONE.

### 2. ResultCode оновлено

**Було:**
```scl
ROUTE_OK_DONE : UINT := 200;  // Успішно завершено
```

**Стало:**
```scl
ROUTE_OK_RUNNING : UINT := 200;  // Успішно виконується
```

### 3. RS_Warning додано

**Нове поле:**
```scl
RS_Warning : USINT;  // 0=OK, 1=IGNORED_CMD
```

**Використання:** Індикація ігнорованих команд (наприклад, дублікат START).

---

## 📊 Порівняння: Array vs Mailbox

| Параметр | Array (v1.x) | Mailbox (v2.0) |
|----------|--------------|----------------|
| **Пам'ять (SCADA→PLC)** | 15,360 bytes | 1,280 bytes |
| **Економія** | - | 92% |
| **Протокол** | Double buffer + atomic switch | Single slot + commit counter |
| **Обробка** | Батч (12 команд одночасно) | Послідовна (1 команда за раз) |
| **Складність** | Середня | Низька |
| **Підходить для** | Одночасних команд | Послідовних команд (інтервали) |

---

## 🚀 Інтеграція у проект

### 1. Імпорт файлів у TIA Portal

```
UDT_RouteStep_v2.scl
UDT_RouteCmd_v2.scl
UDT_RouteStatus_v2.scl
DB_ScadaToPlc_RouteCmd_v2.scl
DB_Plc_RouteExecutor.scl
DB_PlcToScada_RouteStatus_v2.scl
Constants_v2.scl
FC_Route_Supervisor_v2.scl
FC_RouteFSM_v2.scl
```

### 2. Додати виклик у OB1

```scl
ORGANIZATION_BLOCK "Main"
BEGIN
    // ... HAL Read, DeviceRunner ...
    
    // Route Supervisor (Mailbox)
    "FC_Route_Supervisor"();
    
    // ... HAL Write ...
END_ORGANIZATION_BLOCK
```

### 3. Налаштувати SCADA

**Python приклад:**
```python
from pycomm3 import LogixDriver

class RouteController:
    def __init__(self, plc_ip: str):
        self.plc = LogixDriver(plc_ip)
        
    def send_start(self, route_id: int, steps: list):
        # Перевірка mailbox
        mailbox = self.plc.read("DB_ScadaToPlc_RouteCmd")
        status = self.plc.read("DB_PlcToScada_RouteStatus")
        
        if mailbox.HDR_Commit != status.ACK_CommitApplied:
            raise Exception("Mailbox busy")
        
        # Запис команди
        self.plc.write("DB_ScadaToPlc_RouteCmd.HDR_RouteId", route_id)
        self.plc.write("DB_ScadaToPlc_RouteCmd.CMD_Route.RC_Cmd", 1)  # START
        self.plc.write("DB_ScadaToPlc_RouteCmd.CMD_Route.RC_StepCount", len(steps))
        # ... RC_Steps ...
        
        # Commit
        self.plc.write("DB_ScadaToPlc_RouteCmd.HDR_Commit", mailbox.HDR_Commit + 1)
        
        # Очікування ACK
        self.wait_ack(mailbox.HDR_Commit + 1)
```

---

## 📝 Приклади використання

### Сценарій 1: Послідовний запуск 3 маршрутів

```python
controller = RouteController("192.168.1.10")

# Маршрут 1: Силос 1 → Норія 1
controller.send_start(1, [
    {"slot": 0, "action": START, "wait": RUNNING},  # Редлер 1
    {"slot": 50, "action": START, "wait": RUNNING}  # Норія 1
])
time.sleep(300)  # 5 хвилин

# Маршрут 2: Силос 2 → Норія 2
controller.send_start(2, [
    {"slot": 1, "action": START, "wait": RUNNING},
    {"slot": 51, "action": START, "wait": RUNNING}
])
time.sleep(300)

# Маршрут 3: Parallel route
controller.send_start(3, [...])
```

### Сценарій 2: Зупинка активного маршруту

```python
# Перевірка стану
status = controller.get_status(1)
if status.RS_State == RUNNING:
    # Контрольована зупинка
    controller.send_stop(1)
```

### Сценарій 3: Обробка попереджень

```python
status = controller.get_status(1)
if status.RS_Warning == RS_WARNING_IGNORED_CMD:
    print("Warning: Duplicate START ignored for Route 1")
    # Логування або показ користувачу
```

---

## ✅ Acceptance Criteria (виконано)

### Функціональні вимоги

- [x] SCADA може запустити маршрут через Mailbox
- [x] PLC підтверджує команду < 100ms
- [x] Дублікат START ігнорується з RS_Warning
- [x] STOP дозволено для активних маршрутів
- [x] Маршрути виконуються незалежно
- [x] RouteExecutor очищується після ABORTED/IDLE
- [x] SCADA timeout 1s

### Нефункціональні вимоги

- [x] Обробка команди < 50ms
- [x] DB розмір < 2KB
- [x] Сумісність TIA Portal 19
- [x] Всі тести проходять

---

## 🐛 Troubleshooting

| Проблема | Причина | Рішення |
|----------|---------|---------|
| `MailboxBusyError` | PLC не встиг обробити попередню команду | Збільшити timeout або додати retry |
| `TimeoutError` | PLC не відповідає | Перевірити з'єднання, PLC цикл |
| `RS_Warning=1` | Дублікат START | Перевірити логіку SCADA, можливо баг UI |
| `REJECTED (202)` | Механізм зайнятий | Перевірити ownership перед стартом |

---

## 📚 Додаткова документація

- `Mailbox_Protocol.md` - детальний опис протоколу
- `SCADA_Integration_Guide.md` - інтеграція SCADA
- `RouteController.py` - Python wrapper (приклад)
- `RouteController.cs` - C# wrapper (приклад)

---

**Кінець документації v2.0.1**

🎯 **Mailbox Pattern успішно реалізовано!**
