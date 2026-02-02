# ⚡ QUICK START - Тести Supervisor

## 🎯 Швидкий запуск

### 1️⃣ Імпорт у TIA Portal

```
1. Імпортувати файли:
   - FC_Test_RouteSupervisor.scl
   - DB_TestResults_Supervisor.scl
   - FB_TestRunner_Supervisor.scl

2. Створити екземпляр FB:
   - DB_TestRunner_Supervisor (Instance DB)
```

### 2️⃣ Додати у OB1

```scl
// Після виклику FC_Route_Supervisor_v2
"DB_TestRunner_Supervisor"();
```

### 3️⃣ Запустити тести

**З HMI/SCADA:**
```
Кнопка: "Start All Tests"
→ DB_TestRunner_Supervisor.Start := TRUE
```

**З Watch Table:**
```
DB_TestRunner_Supervisor.Start := TRUE
```

### 4️⃣ Переглянути результати

```
DB_TestResults_Supervisor.PassedTests     → 15 (якщо ✅)
DB_TestResults_Supervisor.FailedTests     → 0 (якщо ✅)
DB_TestResults_Supervisor.AllTestsRun     → TRUE
```

---

## 📋 15 тестів за 1 хвилину

| # | Назва тесту | Що перевіряє |
|---|-------------|--------------|
| 1 | Basic START | Прийом START для IDLE |
| 2 | Duplicate START | Відхилення дубліката для RUNNING |
| 3 | STOP_OP active | STOP_OP для активного маршруту |
| 4 | Invalid RouteId | Валідація RouteId [1..12] |
| 5 | START after ABORTED | Перезапуск після помилки |
| 6 | Duplicate in VALIDATING | Відхилення у стані валідації |
| 7 | Duplicate in STOPPING | Відхилення під час зупинки |
| 8 | START after REJECTED | Запуск після відхилення |
| 9 | Cleanup ABORTED | Очищення після аварії |
| 10 | Cleanup IDLE | Очищення після завершення |
| 11 | 3 concurrent routes | Паралельні маршрути |
| 12 | STOP_OP for IDLE | STOP для неактивного |
| 13 | Mailbox busy | Протокол Mailbox |
| 14 | ACK time <100ms | Продуктивність |
| 15 | Boundary Route #12 | Граничний випадок |

---

## ✅ Критерії прийняття

```
✅ PassedTests = 15
✅ FailedTests = 0
✅ AvgAckTime < 20ms
✅ MaxAckTime < 50ms
```

---

## 🔍 Швидка діагностика

### Якщо тест провалився:

```scl
// Дивимось який саме
FailedTest := DB_TestResults_Supervisor.CurrentTest;
TestName := DB_TestResults_Supervisor.Results[FailedTest].TestName;

// Запускаємо окремо
DB_TestRunner_Supervisor.TestNumber := FailedTest;
DB_TestRunner_Supervisor.RunSingleTest := TRUE;
```

### Типові проблеми:

| Симптом | Причина | Рішення |
|---------|---------|---------|
| ACK не відправлено | RouteId поза [1..12] | Перевірити HDR_RouteId |
| Дублікат прийнято | State не RUNNING | Перевірити RS_State |
| Cleanup не спрацював | State не ABORTED/IDLE | Перевірити FSM transitions |
| Час ACK >100ms | Багато тестів одночасно | Запускати по одному |

---

## 🎮 HMI Integration

### Мінімальний HMI екран:

```
┌─────────────────────────────────────┐
│  SUPERVISOR TEST SUITE              │
├─────────────────────────────────────┤
│                                     │
│  [Start All Tests]  [Reset]         │
│                                     │
│  Running:  ⚫ / ⚪                   │
│  Done:     ⚫ / ⚪                   │
│  All Passed: ⚫ / ⚪                 │
│                                     │
│  Current Test: 5 / 15               │
│  Passed: 4   Failed: 0              │
│                                     │
│  Avg ACK Time: 12ms                 │
│  Max ACK Time: 18ms                 │
│                                     │
├─────────────────────────────────────┤
│  SINGLE TEST                        │
│  Test #: [__]  [Run]                │
│                                     │
│  Last Result:                       │
│  [✅ Duplicate START rejection]    │
│  Time: 8ms                          │
└─────────────────────────────────────┘
```

### Змінні для HMI:

```
Buttons:
- DB_TestRunner_Supervisor.Start
- DB_TestRunner_Supervisor.Reset
- DB_TestRunner_Supervisor.RunSingleTest

Indicators:
- DB_TestRunner_Supervisor.Running
- DB_TestRunner_Supervisor.Done
- DB_TestRunner_Supervisor.AllPassed

Values:
- DB_TestResults_Supervisor.PassedTests
- DB_TestResults_Supervisor.FailedTests
- DB_TestResults_Supervisor.Performance.AvgAckTime
- DB_TestResults_Supervisor.Performance.MaxAckTime
```

---

## 📊 Звіт після тестування

```
====================================
  SUPERVISOR TEST SUITE REPORT
====================================

Total Tests:     15
Passed:          15 ✅
Failed:          0

Performance:
  Avg ACK Time:  12ms ✅
  Max ACK Time:  18ms ✅
  Min ACK Time:  8ms
  Total Time:    180ms

Mailbox Protocol:    ✅ OK
Duplicate Protection: ✅ OK
STOP_OP Handling:     ✅ OK
Cleanup:              ✅ OK
State Transitions:    ✅ OK
Concurrent Routes:    ✅ OK

====================================
  STATUS: READY FOR PRODUCTION ✅
====================================
```

---

## 🚀 Production Checklist

Перед розгортанням переконайтесь:

- [ ] Всі 15 тестів пройшли
- [ ] ACK час <100ms (вимога)
- [ ] ACK час <20ms (ціль)
- [ ] Протестовано на реальному S7-1500
- [ ] HMI інтегровано
- [ ] SCADA підключено
- [ ] Логування налаштовано
- [ ] Backup створено

**Готово до запуску!** 🎉
