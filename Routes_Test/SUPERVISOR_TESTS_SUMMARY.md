# 📦 SUPERVISOR TEST SUITE - DELIVERY PACKAGE

## 🎯 Що надано

### 📄 Файли (5 шт)

1. **FC_Test_RouteSupervisor.scl** - Функція з 15 тестами
2. **DB_TestResults_Supervisor.scl** - БД для результатів
3. **FB_TestRunner_Supervisor.scl** - Автоматичний виконавець тестів
4. **TEST_SUITE_SUPERVISOR.md** - Детальна документація (6KB)
5. **QUICK_START_TESTS.md** - Швидкий старт (4KB)

---

## 🧪 Тестове покриття

### 15 тестів покривають:

| Категорія | Кількість | Тести |
|-----------|-----------|-------|
| **Mailbox Protocol** | 4 | 1, 4, 13, 14 |
| **Duplicate START Protection** | 3 | 2, 6, 7 |
| **STOP_OP Handling** | 2 | 3, 12 |
| **Cleanup** | 2 | 9, 10 |
| **State Transitions** | 2 | 5, 8 |
| **Concurrent Routes** | 2 | 11, 15 |

---

## ✅ Що тестується у Supervisor

### ✅ **Mailbox Protocol:**
- Виявлення нових команд (commitIn != commitAck)
- Валідація RouteId [1..12]
- Відправка ACK назад у SCADA
- Час відгуку <100ms (вимога)
- Обробка Mailbox Busy стану

### ✅ **Duplicate START Protection:**
- Відхилення START для VALIDATING маршрутів
- Відхилення START для STARTING маршрутів
- Відхилення START для RUNNING маршрутів
- Відхилення START для STOPPING маршрутів
- Встановлення RS_Warning = IGNORED_CMD
- Збереження попередньої команди

### ✅ **Command Distribution:**
- Копіювання команди з Mailbox → RouteExecutor[RouteId]
- Прийом START для IDLE/ABORTED/REJECTED маршрутів
- Прийом STOP_OP для будь-якого стану
- Незалежна обробка 12 маршрутів

### ✅ **Cleanup:**
- Очищення RouteExecutor після ABORTED
- Очищення RouteExecutor після IDLE
- Звільнення пам'яті для нових команд
- RC_Cmd := NONE, RC_StepCount := 0

### ✅ **Orchestration:**
- Виклик 12 екземплярів FC_RouteFSM
- Передача команд з RouteExecutor у FSM
- Координація паралельних маршрутів

---

## ❌ Що НЕ тестується (поза межами Supervisor)

Ці тести НЕ покривають функціонал FSM:
- ❌ Виконання кроків маршруту (FSM responsibility)
- ❌ Блокування механізмів (FSM responsibility)
- ❌ Обробка таймаутів (FSM responsibility)
- ❌ Звільнення власності механізмів (FSM responsibility)
- ❌ Взаємодія з DB_Mechs (FSM responsibility)

Для тестування FSM потрібен окремий Test Suite.

---

## 🚀 Швидкий старт (3 кроки)

### Крок 1: Імпорт

```
TIA Portal → External Source Files → Add Files:
- FC_Test_RouteSupervisor.scl
- DB_TestResults_Supervisor.scl
- FB_TestRunner_Supervisor.scl

Generate blocks from source
```

### Крок 2: OB1 Integration

```scl
ORGANIZATION_BLOCK "OB1"
BEGIN
   // ... існуючий код ...
   
   // Route Supervisor
   "FC_Route_Supervisor_v2"();
   
   // Test Runner (тільки для тестування!)
   "DB_TestRunner_Supervisor"();
   
END_ORGANIZATION_BLOCK
```

### Крок 3: Запуск

```scl
// Watch Table або HMI
"DB_TestRunner_Supervisor".Start := TRUE;

// Чекаємо завершення
WAIT_UNTIL "DB_TestRunner_Supervisor".Done = TRUE;

// Результат
IF "DB_TestResults_Supervisor".FailedTests = 0 THEN
   // ✅ SUCCESS - всі тести пройшли!
ELSE
   // ❌ FAILURE - є проваленні тести
END_IF;
```

---

## 📊 Очікувані результати

### Після успішного проходження:

```
DB_TestResults_Supervisor:
├── TotalTests: 15
├── PassedTests: 15 ✅
├── FailedTests: 0 ✅
├── AllTestsRun: TRUE
└── Performance:
    ├── AvgAckTime: <20ms ✅
    ├── MaxAckTime: <50ms ✅
    ├── MinAckTime: <10ms
    └── TotalExecutionTime: <500ms
```

### Критерії прийняття:

| Метрика | Вимога | Ціль |
|---------|--------|------|
| Всі тести пройшли | ✅ Обов'язково | 15/15 |
| Середній ACK | <100ms | <20ms |
| Максимальний ACK | <100ms | <50ms |
| Дублікати відхилено | 100% | 100% |
| STOP_OP працює | 100% | 100% |

---

## 🎓 Архітектура тестів

### Розподіл відповідальності:

```
┌─────────────────────────────────────────────────────────┐
│                  FB_TestRunner_Supervisor               │
│                    (Test Orchestrator)                  │
│                                                         │
│  • Запускає тести 1..15 послідовно                    │
│  • Вимірює час виконання                               │
│  • Збирає статистику                                   │
│  • Зберігає результати у DB                            │
└─────────────────────────────────────────────────────────┘
                            │
                            │ викликає кожен тест
                            ▼
┌─────────────────────────────────────────────────────────┐
│             FC_Test_RouteSupervisor                     │
│                 (Test Functions)                        │
│                                                         │
│  CASE TestNumber OF                                    │
│    1: TEST базовий прийом команди                      │
│    2: TEST дублікат START                              │
│    3: TEST STOP_OP для активного                       │
│    ...                                                 │
│    15: TEST граничний Route #12                        │
│  END_CASE                                              │
└─────────────────────────────────────────────────────────┘
                            │
                            │ взаємодіє з
                            ▼
┌─────────────────────────────────────────────────────────┐
│        DB_ScadaToPlc_RouteCmd_v2 (Mailbox)             │
│        DB_PlcToScada_RouteStatus_v2 (Status)           │
│        DB_Plc_RouteExecutor (Internal Buffer)          │
└─────────────────────────────────────────────────────────┘
                            │
                            │ тестується
                            ▼
┌─────────────────────────────────────────────────────────┐
│            FC_Route_Supervisor_v2                       │
│              (System Under Test)                        │
│                                                         │
│  • Mailbox Protocol Handler                            │
│  • Duplicate START Protection                          │
│  • Command Distribution                                │
│  • Cleanup Logic                                       │
└─────────────────────────────────────────────────────────┘
                            │
                            │ результати у
                            ▼
┌─────────────────────────────────────────────────────────┐
│           DB_TestResults_Supervisor                     │
│                                                         │
│  Results[1..15]:                                       │
│    • TestNumber, TestName                              │
│    • Passed: TRUE/FALSE                                │
│    • ExecutionTime                                     │
│    • ErrorCode                                         │
│                                                         │
│  Performance:                                          │
│    • AvgAckTime, MaxAckTime, MinAckTime                │
│    • TotalExecutionTime                                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Приклади використання

### Використання 1: CI/CD Pipeline

```python
# Python script для автоматизації
def run_supervisor_tests():
    plc = connect_to_plc("192.168.1.10")
    
    # Запустити тести
    plc.write("DB_TestRunner_Supervisor.Start", True)
    
    # Чекати завершення (timeout 60s)
    timeout = 60
    while timeout > 0:
        if plc.read("DB_TestRunner_Supervisor.Done"):
            break
        time.sleep(1)
        timeout -= 1
    
    # Результат
    passed = plc.read("DB_TestResults_Supervisor.PassedTests")
    failed = plc.read("DB_TestResults_Supervisor.FailedTests")
    
    if failed == 0:
        print(f"✅ All {passed} tests passed!")
        return 0
    else:
        print(f"❌ {failed} tests failed!")
        return 1

sys.exit(run_supervisor_tests())
```

### Використання 2: HMI Integration

```
Кнопка HMI: "Run Supervisor Tests"
→ Викликає FB_TestRunner_Supervisor
→ Показує прогрес у реальному часі
→ Відображає результат після завершення
```

### Використання 3: Manual Debugging

```scl
// У Watch Table
"DB_TestRunner_Supervisor".TestNumber := 2;  // Тест дублікату
"DB_TestRunner_Supervisor".RunSingleTest := TRUE;

// Дивимось результат
"DB_TestResults_Supervisor".Results[2].Passed
"DB_TestResults_Supervisor".Results[2].ExecutionTime
```

---

## 🛠️ Налаштування для Production

### Після успішних тестів:

1. **Видалити з OB1:**
   ```scl
   // "DB_TestRunner_Supervisor"();  // ЗАКОМЕНТУВАТИ!
   ```

2. **Залишити тільки:**
   ```scl
   "FC_Route_Supervisor_v2"();  // Production code
   ```

3. **Зберегти тести:**
   - Тестові блоки залишаються у проекті
   - Можна запускати вручну при необхідності
   - Корисно для troubleshooting

---

## 📋 Чек-лист інтеграції

### Перед імпортом:

- [ ] TIA Portal 19 встановлено
- [ ] Проект відкрито
- [ ] Mailbox v2.0 вже імпортовано
- [ ] FC_Route_Supervisor_v2 створено

### Під час імпорту:

- [ ] Імпортовано FC_Test_RouteSupervisor.scl
- [ ] Імпортовано DB_TestResults_Supervisor.scl
- [ ] Імпортовано FB_TestRunner_Supervisor.scl
- [ ] Створено Instance DB для FB_TestRunner
- [ ] Компіляція пройшла без помилок

### Після імпорту:

- [ ] Додано виклик у OB1
- [ ] Запущено всі тести
- [ ] Всі 15 тестів пройшли ✅
- [ ] ACK час <100ms
- [ ] Результати задокументовані
- [ ] Backup створено

---

## 🎉 Готово!

Тепер у вас є:
- ✅ 15 комплексних тестів Supervisor
- ✅ Автоматичний test runner
- ✅ Детальна документація
- ✅ Швидкий старт гайд
- ✅ Результати у структурованому вигляді

**Наступний крок:** Інтеграційні тести Supervisor + FSM

---

## 📞 Підтримка

Якщо виникли питання:
1. Перечитайте TEST_SUITE_SUPERVISOR.md (детальна документація)
2. Перегляньте QUICK_START_TESTS.md (швидкі відповіді)
3. Запустіть один тест окремо для діагностики
4. Перевірте DB_TestResults_Supervisor.Results[N].ErrorCode

**Тести готові до використання!** 🚀
