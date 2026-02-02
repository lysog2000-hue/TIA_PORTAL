# ⚡ ПОРЯДОК ВИКЛИКУ В MAIN (OB1)

## 🎯 Правильний порядок

```scl
ORGANIZATION_BLOCK "Main"
BEGIN
   // 1. SIMULATION (якщо є)
   IF "DB_SimConfig".Enabled THEN
      "FC_SimRedler"();
      "FC_SimNoria"();
      "FC_SimFan"();
   END_IF;
   
   // 2. MANUAL COMMANDS
   "FC_ManualMechCmdHandler"();
   
   // 3. ROUTE SUPERVISOR ⭐ КРИТИЧНО!
   "FC_Route_Supervisor"();
   
   // 4. DEVICE RUNNER
   "FC_DeviceRunner"();
   
   // 5. HAL WRITE
   // "FC_HAL_Write"();  // TODO: додати
   
END_ORGANIZATION_BLOCK
```

---

## ⚠️ КРИТИЧНО: Supervisor ПЕРЕД DeviceRunner!

### ✅ ПРАВИЛЬНО:
```scl
"FC_Route_Supervisor"();  // ⬅️ ПЕРШИЙ
"FC_DeviceRunner"();      // ⬅️ ДРУГИЙ
```

**Чому?**
- Route Supervisor пише команди в `DB_Mechs[i].Cmd`
- Device Runner читає ці команди та виконує
- Якщо порядок навпаки → затримка на 1 цикл!

### ❌ НЕПРАВИЛЬНО:
```scl
"FC_DeviceRunner"();      // ❌ Читає старі команди
"FC_Route_Supervisor"();  // ❌ Записує нові команди (запізно!)
```

---

## 📊 Потік даних

```
┌──────────────┐
│ SCADA        │
└──────┬───────┘
       │ Mailbox: DB_ScadaToPlc_RouteCmd
       ▼
┌──────────────────────┐
│ FC_Route_Supervisor  │ ⬅️ Крок 3
│ • Читає Mailbox      │
│ • Викликає 12 x FSM  │
│ • Пише Mechs.Cmd     │
└──────┬───────────────┘
       │ DB_Mechs[i].Cmd (Owner=ROUTE)
       ▼
┌──────────────────────┐
│ FC_DeviceRunner      │ ⬅️ Крок 4
│ • Читає Mechs.Cmd    │
│ • Виконує механізми  │
│ • Пише Mechs.Status  │
└──────┬───────────────┘
       │ DB_Mechs[i].HAL outputs
       ▼
┌──────────────────────┐
│ FC_HAL_Write         │ ⬅️ Крок 5
│ • Пише у PLC outputs │
└──────────────────────┘
```

---

## 🧪 Для тестування

```scl
// Розкоментувати ТІЛЬКИ під час тестів:
// "DB_TestRunner_Supervisor"();

// Перед production - ЗАКОМЕНТУВАТИ!
```

---

## ⏱️ Типовий timing

| Фаза | Час |
|------|-----|
| Simulation | 1-2ms |
| Manual Handler | 1-2ms |
| **Route Supervisor** | **2-5ms** |
| Device Runner | 3-5ms |
| HAL Write | 1ms |
| **TOTAL** | **~10-15ms** |

---

## ✅ Чеклист

- [ ] Supervisor викликається **ПЕРЕД** DeviceRunner
- [ ] Симуляція увімкнена тільки для тестів
- [ ] Тести закоментовані в production
- [ ] HAL Write додано в кінці
- [ ] OB1 cycle time < 20ms

---

## 🚨 Типові помилки

### Помилка 1: DeviceRunner перед Supervisor
**Симптом:** Маршрути не запускаються або затримка 1 цикл  
**Рішення:** Помінять місцями → Supervisor ПЕРЕД DeviceRunner

### Помилка 2: Симуляція залишена в production
**Симптом:** Механізми не реагують на реальні датчики  
**Рішення:** `DB_SimConfig.Enabled := FALSE;`

### Помилка 3: Тести в production OB1
**Симптом:** Зайві 1-2ms на кожен цикл  
**Рішення:** Закоментувати `"DB_TestRunner_Supervisor"();`

---

## 📋 Production OB1 (остаточний)

```scl
ORGANIZATION_BLOCK "Main"
BEGIN
   // Manual commands
   "FC_ManualMechCmdHandler"();
   
   // Route automation ⭐
   "FC_Route_Supervisor"();
   
   // Execute mechanisms
   "FC_DeviceRunner"();
   
   // Write outputs
   "FC_HAL_Write"();
   
END_ORGANIZATION_BLOCK
```

**Готово до запуску!** 🎉
