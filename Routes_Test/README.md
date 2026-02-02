# 🧪 Routes_Test - Тестування маршрутів FSM v2.0

**Версія:** 2.0.0  
**Дата:** 2026-02-01  
**Статус:** ✅ READY FOR TESTING

---

## 📂 Файли в папці

```
Routes_Test/
├── DB_Test_Routes_Config.scl       # Конфігурація тестів
├── FB_Test_Routes.scl              # Основний тестовий блок
├── FC_Test_PrepareSimpleRoute.scl  # Підготовка простого маршруту (2 механізми)
├── FC_Test_PrepareRouteWithParams.scl # Підготовка з StartParam/StopParam
├── FC_Test_SendRouteCommand.scl    # Відправка команди через double buffer
├── Як_тестувати_v2.md              # Детальна інструкція
└── README.md                       # Цей файл
```

---

## 🎯 Що тестується

### Основні зміни FSM v2.0

1. **✅ Об'єднаний DB_Plc_RouteFsm**
   - Один DB замість двох (State + Work)
   - Тести адаптовані під нову структуру

2. **✅ Механізми залишаються під Owner=ROUTE після DONE**
   - Критична перевірка: owner НЕ звільняється при успішному завершенні
   - Release тільки при ABORTED

**Обмеження поточної версії:**
- Тести для `StartParam/StopParam` потребують засувку (slot 100+)
- Поточна конфігурація `DB_Mechs` має тільки slot 0, 1, 2
- Розширені тести будуть додані після налаштування засувок

---

## 🚀 Швидкий старт

### Крок 1: Імпорт у TIA Portal

1. Імпортувати всі `.scl` файли з папки
2. Створити інстанс DB:
   ```scl
   DATA_BLOCK "DB_Test_Routes_Instance"
   VERSION : 1.0
   "FB_Test_Routes"
   BEGIN
   END_DATA_BLOCK
   ```

### Крок 2: Додати виклик у OB1

```scl
ORGANIZATION_BLOCK "Main"
BEGIN
    // === 1. Симулятори (ПЕРЕД DeviceRunner!) ===
    "FC_SimRedler"(RedlerIdx := 0, ...);
    "FC_SimRedler"(RedlerIdx := 1, ...);
    // ... інші симулятори
    
    // === 2. HAL Read ===
    "FC_HAL_Read"(...);
    
    // === 3. Manual Command Handler ===
    "FC_ManualMechCmdHandler"(LocalManualGlobal := FALSE);
    
    // === 4. Device Runner ===
    "FC_DeviceRunner"(...);
    
    // === 5. Route Supervisor (ПІСЛЯ DeviceRunner!) ===
    "FC_Route_Supervisor"();
    
    // === 6. HAL Write ===
    "FC_HAL_Write"(...);
    
    // === 7. Тести (в кінці циклу) ===
    "DB_Test_Routes_Instance"();
    
END_ORGANIZATION_BLOCK
```

### Крок 3: Запуск тесту

**Online mode:**

1. Відкрити `DB_Test_Routes_Config`
2. Встановити:
   ```
   TestEnabled = TRUE
   RouteId = 1
   TestScenario = 1
   ```
3. Спостерігати за:
   - `TestPassed` / `TestFailed`
   - `FailReason` (якщо Failed)
   - `TransitionCount` (лічильник переходів)

---

## 📊 Список тестів

| № | Назва | Що перевіряє | Очікуваний результат |
|---|-------|--------------|---------------------|
| **1** | START → DONE | Успішне виконання | Owner залишається ROUTE ✅ |
| **2** | START → STOP → ABORTED | Контрольована зупинка | Owner звільняється ✅ |
| **3** | REJECT_BY_OWNER | Зайнятий механізм | ResultCode = 202 |

**Примітка:** Тести використовують тільки slot 0, 1 (редлери з поточної конфігурації).

Детальні очікувані результати → див. `Як_тестувати_v2.md`

---

## 🔍 Watch Table

```
// Керування
DB_Test_Routes_Config.TestEnabled
DB_Test_Routes_Config.TestScenario
DB_Test_Routes_Config.TestStep

// Результати
DB_Test_Routes_Config.TestPassed
DB_Test_Routes_Config.TestFailed
DB_Test_Routes_Config.FailReason
DB_Test_Routes_Config.TransitionCount

// Статус маршруту
DB_PlcToScada_RouteStatus.RoutesSts[1].RS_State
DB_PlcToScada_RouteStatus.RoutesSts[1].RS_ResultCode
DB_PlcToScada_RouteStatus.RoutesSts[1].RS_ActiveStep

// Механізми
DB_Mechs.Mechs[0].OwnerCur
DB_Mechs.Mechs[0].Status
DB_Mechs.Mechs[1].OwnerCur
DB_Mechs.Mechs[1].Status

// Snapshot
DB_Test_Routes_Config.Snapshot_State
DB_Test_Routes_Config.Snapshot_ResultCode
```

---

## ⚠️ Передумови

Перед запуском переконайтеся:

- [x] Симулятори увімкнені (`DB_SimConfig.Redler[0/1].Enable = TRUE`)
- [x] Route Supervisor викликається в OB1
- [x] Симулятори викликаються **ПЕРЕД** DeviceRunner
- [x] DB_Test_Routes_Instance створено
- [x] Початковий стан: `TestEnabled = FALSE`

---

## 🐛 Troubleshooting

| Проблема | Рішення |
|----------|---------|
| `TransitionCount = 0` | Route Supervisor не викликається |
| `TestFailed = TRUE` | Перевірити `FailReason` |
| `State = REJECTED` | Механізм зайнятий, перевірити Owner |
| `State = ABORTED (304)` | Fault під час виконання, перевірити симулятор |

---

## 📝 Примітки

1. **Швидкість:** ~10-15 сек/тест (залежить від `StepDelayMs`)
2. **Повторний запуск:** Змінити `TestScenario` (автоматичний reset)
3. **Відладка:** Використовувати `Snapshot_*` для аналізу переходів

---

## 📚 Документація

- `Як_тестувати_v2.md` — детальна інструкція з очікуваними результатами
- `contract_v2.1.1.md` — архітектура системи
- `FSM_Routes_v2.0_Changes.md` — документація змін FSM

---

**Готово до запуску!** 🎯
