# FSM Маршрутів v2.0 - Документація змін

**Дата:** 2026-02-01  
**Версія:** 2.0.0  
**Статус:** ✅ РЕАЛІЗОВАНО

---

## 📋 Зміст змін

### 1. ✅ Об'єднання DB пам'яті

**Було:**
```
DB_Plc_RouteFsm (RETAIN)
  └─ RoutesFsm[1..12] : UDT_RouteFsmState
  
DB_Plc_RouteFsmWork (NON_RETAIN)
  └─ RoutesWork[1..12] : UDT_RouteFsmWork
```

**Стало:**
```
DB_Plc_RouteFsm (NON_RETAIN)  ⭐ єдиний DB
  └─ RoutesFsm[1..12] : UDT_RouteFsm  ⭐ злиті UDT
```

**Обґрунтування:**
- Маршрути не продовжують після рестарту → NON_RETAIN
- Спрощена архітектура без дублювання даних
- Менше пам'яті, простіший доступ до змінних

**Змінені файли:**
- `UDT_RouteFsm.scl` (новий, замість UDT_RouteFsmState + UDT_RouteFsmWork)
- `DB_Plc_RouteFsm.scl` (оновлений)
- `FC_RouteFSM.scl` (використання Fsm замість Fsm + Work)
- `FC_Route_Supervisor.scl` (один параметр замість двох)

---

### 2. ✅ Видалено release ownership з DONE

**Було:**
```scl
IF stepIdx >= stepCnt THEN
    // Release ownership
    FOR i := 0 TO stepCnt - 1 DO
        FC_ArbiterMech(..., ReleaseOwner := TRUE, ...)
    END_FOR;
    
    RF_State := ROUTE_STS_DONE;
    RF_ResultCode := ROUTE_DONE_OK;
END_IF;
```

**Стало:**
```scl
IF stepIdx >= stepCnt THEN
    // ✅ Механізми залишаються під Owner=ROUTE
    RF_State := ROUTE_STS_DONE;
    RF_ResultCode := ROUTE_DONE_OK;
END_IF;
```

**Обґрунтування:**
- Механізми залишаються "зарезервованими" після успішного завершення
- Release тільки при ABORTED (в STOPPING)
- Захист від несанкціонованого перехоплення механізмів

**Наслідки:**
- SCADA може побачити DONE і знати, що механізми ще зайняті
- Для звільнення потрібен явний STOP або новий START іншого маршруту

---

### 3. ✅ Додано RS_StartParam та RS_StopParam

**Було:**
```scl
TYPE "UDT_RouteStep"
STRUCT
  RS_Slot        : UINT;
  RS_Action      : USINT;
  RS_Wait        : USINT;
  RS_TimeoutMs   : DINT;
END_STRUCT
```

**Стало:**
```scl
TYPE "UDT_RouteStep"
STRUCT
  RS_Slot        : UINT;
  RS_Action      : USINT;
  RS_StartParam  : INT;    // 🆕 параметр при виконанні
  RS_StopParam   : INT;    // 🆕 параметр при зупинці
  RS_Wait        : USINT;
  RS_TimeoutMs   : DINT;
END_STRUCT
```

**Використання:**

#### RS_StartParam (в RUNNING):
```scl
IF Step.RS_Action = RS_ACT_START THEN
    FC_ArbiterMech(..., 
        ReqCmd := CMD_START,
        ReqParam1 := Step.RS_StartParam,  // 🆕
        ...)
END_IF;
```

**Приклад для багатопозиційної засувки:**
```
Step[0]:
  Slot = 100 (засувка)
  Action = RS_ACT_START
  StartParam = CMD_GATE_OPEN    (відкрити)
  Wait = RS_WAIT_RUNNING

Step[1]:
  Slot = 100 (та ж засувка)
  Action = RS_ACT_START
  StartParam = CMD_GATE_CLOSED  (закрити)
  Wait = RS_WAIT_STOPPED
```

#### RS_StopParam (в STOPPING):
```scl
IF Step.RS_StopParam <> 0 THEN
    // Зупинка через START з параметром
    FC_ArbiterMech(...,
        ReqCmd := CMD_START,
        ReqParam1 := Step.RS_StopParam,  // 🆕
        ...)
ELSE
    // Стандартна зупинка
    FC_ArbiterMech(...,
        ReqCmd := CMD_STOP,
        ...)
END_IF;
```

**Приклад автоматичного закриття засувки при ABORT:**
```
Step[0]:
  Slot = 100
  Action = RS_ACT_START
  StartParam = CMD_GATE_OPEN
  StopParam = CMD_GATE_CLOSED  // 🆕 автоматично закрити при ABORT
```

---

### 4. ✅ Оновлена логіка STOPPING

**Було:**
```scl
ELSIF RF_State = ROUTE_STS_STOPPING THEN
    // Надіслати CMD_STOP всім механізмам
    FOR i := stepCnt - 1 TO 0 BY -1 DO
        FC_ArbiterMech(..., ReqCmd := CMD_STOP, ...)
    END_FOR;
    
    // Чекати зупинки
    IF allStopped THEN
        // Release ownership
        FOR i := 0 TO stepCnt - 1 DO
            FC_ArbiterMech(..., ReleaseOwner := TRUE, ...)
        END_FOR;
        
        RF_State := ROUTE_STS_ABORTED;
    END_IF;
END_IF;
```

**Стало:**
```scl
ELSIF RF_State = ROUTE_STS_STOPPING THEN
    // ✅ Підтримка RS_StopParam
    FOR i := stepCnt - 1 TO 0 BY -1 DO
        IF Step[i].RS_StopParam <> 0 THEN
            // Зупинка через START з параметром
            FC_ArbiterMech(..., 
                ReqCmd := CMD_START,
                ReqParam1 := Step[i].RS_StopParam, ...)
        ELSE
            // Стандартна зупинка
            FC_ArbiterMech(..., 
                ReqCmd := CMD_STOP, ...)
        END_IF;
    END_FOR;
    
    // Чекати зупинки
    IF allStopped THEN
        // ✅ Release ownership ТІЛЬКИ при ABORTED
        FOR i := 0 TO stepCnt - 1 DO
            FC_ArbiterMech(..., ReleaseOwner := TRUE, ...)
        END_FOR;
        
        RF_State := ROUTE_STS_ABORTED;
        RF_ResultCode := RF_AbortLatched;
    END_IF;
END_IF;
```

---

## 📊 Порівняльна таблиця

| Аспект | v1.0 | v2.0 |
|--------|------|------|
| DB пам'яті | 2 DB (State + Work) | 1 DB (об'єднаний) |
| RETAIN | State: RETAIN, Work: NON_RETAIN | Весь DB: NON_RETAIN |
| Release при DONE | ✅ Так | ❌ Ні (механізми залишаються) |
| Release при ABORTED | ✅ Так | ✅ Так |
| Параметри кроків | Немає | StartParam + StopParam |
| Багатопозиційні засувки | ❌ Не підтримується | ✅ Підтримується |
| Автоматичне закриття при ABORT | ❌ Не підтримується | ✅ Підтримується |

---

## 🎯 Use Cases

### Use Case 1: Багатопозиційна засувка в маршруті

**Сценарій:** Відкрити засувку, засипати силос, закрити засувку

```
Route #5 (засипка силосу 1):
  Step[0]: Slot=100, Action=START, StartParam=CMD_GATE_OPEN, Wait=RUNNING
  Step[1]: Slot=0,   Action=START, StartParam=0, Wait=RUNNING  (редлер)
  Step[2]: Slot=100, Action=START, StartParam=CMD_GATE_CLOSED, Wait=STOPPED
  Step[3]: Slot=0,   Action=STOP,  Wait=STOPPED  (зупинити редлер)
```

**Результат:**
- Засувка відкривається (Step 0)
- Редлер запускається (Step 1)
- Засувка закривається (Step 2)
- Редлер зупиняється (Step 3)

### Use Case 2: Автоматичне закриття при ABORT

**Сценарій:** При аварійній зупинці маршруту засувка повинна закритись

```
Route #5:
  Step[0]: Slot=100, Action=START, 
           StartParam=CMD_GATE_OPEN,
           StopParam=CMD_GATE_CLOSED  🆕
```

**Результат при ABORT:**
- FSM переходить в STOPPING
- FC_ArbiterMech викликається з CMD_START + StopParam=CMD_GATE_CLOSED
- Засувка автоматично закривається
- Після закриття ownership звільняється

---

## 🔄 Міграція з v1.0 на v2.0

### Крок 1: Оновити UDT
1. Видалити `UDT_RouteFsmState.scl`
2. Видалити `UDT_RouteFsmWork.scl`
3. Імпортувати `UDT_RouteFsm.scl` (новий)
4. Оновити `UDT_RouteStep.scl`

### Крок 2: Оновити DB
1. Видалити `DB_Plc_RouteFsmWork`
2. Оновити `DB_Plc_RouteFsm.scl` (змінити тип на UDT_RouteFsm, NON_RETAIN)

### Крок 3: Оновити функції
1. Оновити `FC_RouteFSM.scl`
2. Оновити `FC_Route_Supervisor.scl`

### Крок 4: Оновити маршрути в SCADA
1. Додати поля `StartParam` та `StopParam` у структуру RouteStep
2. Заповнити значення за необхідністю (0 = використати defaults)

### Крок 5: Тестування
1. Перевірити простий маршрут (2 редлери)
2. Перевірити маршрут з засувкою
3. Перевірити ABORT з автоматичним закриттям

---

## ✅ Checklist реалізації

- [x] UDT_RouteFsm.scl створено
- [x] DB_Plc_RouteFsm.scl оновлено
- [x] UDT_RouteStep.scl оновлено
- [x] FC_RouteFSM.scl оновлено
- [x] FC_Route_Supervisor.scl оновлено
- [ ] Видалити застарілі файли (v1.0)
- [ ] Оновити тести
- [ ] Оновити документацію контракту
- [ ] Code review
- [ ] Тестування на реальному PLC

---

## ⚠️ Breaking Changes

### Несумісність з v1.0

1. **Структура DB змінилась**
   - Старі проекти потребують міграції DB
   - Remanent data з v1.0 буде втрачена (але це OK, бо маршрути не продовжують)

2. **Сигнатура FC_RouteFSM змінилась**
   - Було: `Fsm: UDT_RouteFsmState, Work: UDT_RouteFsmWork`
   - Стало: `Fsm: UDT_RouteFsm`

3. **UDT_RouteStep розширено**
   - Додано нові поля: `RS_StartParam`, `RS_StopParam`
   - Старі маршрути працюватимуть (значення 0 = defaults)

---

## 📝 Примітки

1. **Backward compatibility для маршрутів:**
   - Якщо StartParam=0 → використовується default (0)
   - Якщо StopParam=0 → використовується CMD_STOP (стандартна зупинка)

2. **Ownership після DONE:**
   - Механізми залишаються під Owner=ROUTE
   - Для звільнення потрібен явний STOP або новий маршрут

3. **Testing:**
   - Перевірити всі варіанти ABORT (operator/local/fault/safety)
   - Перевірити роботу з засувками
   - Перевірити race conditions при швидкій зміні маршрутів

---

**Кінець документації змін v2.0**

🎯 **Статус:** Реалізація завершена, готово до тестування
