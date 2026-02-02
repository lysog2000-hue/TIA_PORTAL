# 🧪 TEST SUITE для FC_Route_Supervisor_v2

## 📋 Загальна інформація

**Призначення:** Тестування функціоналу Supervisor без залучення реальних FSM  
**Фокус тестування:**
- Mailbox Protocol обробка
- Duplicate START Protection
- Command Distribution
- Cleanup після завершення маршрутів
- Валідація RouteId

**Кількість тестів:** 15  
**Очікуваний час виконання:** <500ms (всі тести)

---

## 🎯 Тести по категоріях

### 📨 **MAILBOX PROTOCOL** (Тести 1, 4, 13, 14)

#### TEST 1: Базовий прийом команди START
**Мета:** Перевірити що Supervisor приймає START команду для IDLE маршруту  
**Сценарій:**
1. Route #1 у стані IDLE
2. SCADA відправляє START через Mailbox (HDR_Commit++)
3. Supervisor виявляє нову команду (HDR_Commit != ACK_CommitApplied)
4. Копіює команду у RouteExecutor[1]
5. Відправляє ACK (ACK_CommitApplied++, ACK_RouteId=1)

**Очікуваний результат:**
- ✅ ACK_CommitApplied інкрементовано
- ✅ ACK_RouteId = 1
- ✅ RouteExecutor[1] містить команду START
- ✅ RS_Warning = OK (не проігноровано)

---

#### TEST 4: Валідація неправильного RouteId
**Мета:** Перевірити відхилення команд з RouteId поза діапазоном [1..12]  
**Сценарій:**
1. SCADA відправляє команду з RouteId = 0
2. Supervisor перевіряє: RouteId ∈ [1..12]
3. Команда відхилена без обробки

**Очікуваний результат:**
- ✅ ACK НЕ відправлено (ACK_CommitApplied не змінився)
- ✅ RouteExecutor не змінений
- ✅ Аналогічно для RouteId = 13

---

#### TEST 13: Mailbox Busy
**Мета:** Перевірити що Supervisor не обробляє нові команди поки попередня не підтверджена  
**Сценарій:**
1. Команда в обробці (HDR_Commit != ACK_CommitApplied)
2. SCADA НЕ повинна писати нову команду (протокол)
3. Supervisor ігнорує всі запити поки не відправить ACK

**Очікуваний результат:**
- ✅ Тільки одна команда обробляється за цикл
- ✅ SCADA повинна чекати ACK перед наступною командою

---

#### TEST 14: Час відгуку ACK (<100ms)
**Мета:** Вимірювання продуктивності Supervisor  
**Вимога:** ACK має бути відправлено менше ніж за 100ms  
**Очікуваний результат:**
- ✅ Час обробки <20ms для простої команди
- ✅ ACK відправлено в тому ж циклі OB1

---

### 🛡️ **DUPLICATE START PROTECTION** (Тести 2, 6, 7)

#### TEST 2: Відхилення дублікату START для RUNNING
**Мета:** Перевірити що активні маршруті відхиляють повторний START  
**Сценарій:**
1. Route #2 у стані RUNNING (виконує 5 кроків)
2. SCADA відправляє новий START (7 кроків) - помилково
3. Supervisor перевіряє: State = RUNNING (active)
4. Команда проігнорована, RS_Warning = IGNORED_CMD
5. ACK відправлено (протокол дотримано)

**Очікуваний результат:**
- ✅ ACK_CommitApplied інкрементовано (протокол OK)
- ✅ RS_Warning = IGNORED_CMD (1)
- ✅ RouteExecutor[2] НЕ змінений (стара команда 5 кроків)
- ✅ State залишився RUNNING

---

#### TEST 6: Дублікат START у стані VALIDATING
**Мета:** Перевірити відхилення START під час валідації  
**Активні стани:** VALIDATING, STARTING, RUNNING, STOPPING  
**Очікуваний результат:**
- ✅ START відхилено
- ✅ RS_Warning = IGNORED_CMD
- ✅ Попередня команда збережена

---

#### TEST 7: Дублікат START у стані STOPPING
**Мета:** Перевірити що STOPPING маршрут не приймає START  
**Очікуваний результат:**
- ✅ START відхилено
- ✅ STOP_OP команда залишилась активною
- ✅ RS_Warning = IGNORED_CMD

---

### ▶️ **STOP_OP HANDLING** (Тести 3, 12)

#### TEST 3: STOP_OP для активного маршруту (RUNNING)
**Мета:** Перевірити що STOP_OP дозволено для активних маршрутів  
**Сценарій:**
1. Route #3 у стані RUNNING
2. SCADA відправляє STOP_OP (оператор зупиняє)
3. Supervisor приймає команду (STOP_OP дозволено завжди)
4. Команда копіюється у RouteExecutor[3]

**Очікуваний результат:**
- ✅ ACK відправлено
- ✅ RouteExecutor[3].RC_Cmd = STOP_OP
- ✅ RS_Warning = OK (не проігноровано)
- ✅ FSM перейде у стан STOPPING

---

#### TEST 12: STOP_OP для неактивного маршруту (IDLE)
**Мета:** Перевірити що STOP_OP приймається навіть для IDLE  
**Примітка:** FSM проігнорує цю команду в IDLE стані  
**Очікуваний результат:**
- ✅ Команда прийнята Supervisor
- ✅ RouteExecutor містить STOP_OP
- ✅ FSM не змінить стан (IDLE → IDLE)

---

### ♻️ **CLEANUP** (Тести 9, 10)

#### TEST 9: Cleanup після ABORTED
**Мета:** Перевірити очищення RouteExecutor після аварійної зупинки  
**Сценарій:**
1. Route #8 перейшов у стан ABORTED
2. RouteExecutor[8] містить стару команду
3. Supervisor виконує cleanup цикл
4. RouteExecutor[8] очищається

**Очікуваний результат:**
- ✅ RouteExecutor[8].RC_Cmd = RT_CMD_NONE
- ✅ RouteExecutor[8].RC_StepCount = 0
- ✅ Готовий до нової команди

---

#### TEST 10: Cleanup після IDLE
**Мета:** Перевірити очищення після завершення маршруту  
**Очікуваний результат:**
- ✅ RouteExecutor очищено
- ✅ Пам'ять звільнена для нової команди

---

### 🔄 **STATE TRANSITIONS** (Тести 5, 8)

#### TEST 5: START після ABORTED
**Мета:** Перевірити перезапуск маршруту після помилки  
**Inactive states:** IDLE, ABORTED, REJECTED  
**Сценарій:**
1. Route #4 у стані ABORTED (попередня помилка)
2. SCADA відправляє новий START
3. Supervisor приймає (ABORTED = inactive)

**Очікуваний результат:**
- ✅ Команда прийнята
- ✅ RouteExecutor[4] містить новий START
- ✅ RS_Warning = OK

---

#### TEST 8: START після REJECTED
**Мета:** Перевірити повторний запуск після відхилення  
**Очікуваний результат:**
- ✅ START прийнято (REJECTED = inactive)
- ✅ Новий маршрут починає виконання

---

### 🔀 **CONCURRENT ROUTES** (Тест 11, 15)

#### TEST 11: Одночасний запуск 3 маршрутів
**Мета:** Перевірити незалежне виконання декількох маршрутів  
**Сценарій:**
1. Routes 1, 2, 3 у стані IDLE
2. SCADA послідовно запускає 3 команди:
   - Route #1: 5 кроків
   - Route #2: 7 кроків
   - Route #3: 3 кроки
3. Supervisor обробляє кожну команду в окремому циклі

**Очікуваний результат:**
- ✅ Всі 3 команди прийняті
- ✅ RouteExecutor[1..3] містять відповідні команди
- ✅ ACK_CommitApplied = 1103
- ✅ Кожен FSM виконується незалежно

---

#### TEST 15: Граничний випадок - Route #12
**Мета:** Перевірити роботу з останнім RouteId  
**Очікуваний результат:**
- ✅ Route #12 працює коректно
- ✅ Немає overflow індексів масиву

---

## 🚀 Запуск тестів

### Варіант 1: Автоматичний запуск всіх тестів

```scl
// В OB100 (Startup) або ручний тригер
"DB_TestRunner_Supervisor".Start := TRUE;
```

**Послідовність:**
1. FB_TestRunner_Supervisor виконує тести 1..15 послідовно
2. Результати зберігаються у DB_TestResults_Supervisor
3. Після завершення: Done=TRUE, AllPassed=TRUE/FALSE

### Варіант 2: Запуск одного тесту

```scl
"DB_TestRunner_Supervisor".TestNumber := 2;  // Тест дублікату START
"DB_TestRunner_Supervisor".RunSingleTest := TRUE;
```

### Варіант 3: Ручний запуск з HMI

1. Вибрати номер тесту (1..15)
2. Натиснути кнопку "Run Test"
3. Переглянути результат у DB_TestResults_Supervisor.Results[N]

---

## 📊 Аналіз результатів

### Перевірити результати:

```scl
// Всі тести пройшли?
IF "DB_TestResults_Supervisor".AllTestsRun AND 
   "DB_TestResults_Supervisor".FailedTests = 0 THEN
   // ✅ SUCCESS
END_IF;

// Скільки тестів пройшло?
PassedCount := "DB_TestResults_Supervisor".PassedTests;

// Продуктивність
AvgTime := "DB_TestResults_Supervisor".Performance.AvgAckTime;
MaxTime := "DB_TestResults_Supervisor".Performance.MaxAckTime;
```

### Критерії прийняття:

| Метрика | Вимога | Очікуване значення |
|---------|--------|-------------------|
| Всі тести | Пройдено | 15/15 ✅ |
| Середній час ACK | <100ms | <20ms ✅ |
| Максимальний час ACK | <100ms | <50ms ✅ |
| Дублікати START | Відхилено | 100% ✅ |
| STOP_OP | Прийнято завжди | 100% ✅ |
| RouteId валідація | Відхилено invalid | 100% ✅ |

---

## 🐛 Troubleshooting

### Тест провалився - що робити?

1. **Переглянути результат:**
   ```scl
   TestResult := "DB_TestResults_Supervisor".Results[N];
   TestName := TestResult.TestName;
   ErrorCode := TestResult.ErrorCode;
   ```

2. **Перевірити попередні умови:**
   - Mailbox правильно ініціалізований?
   - RouteExecutor очищено перед тестом?
   - Status маршрутів у правильних станах?

3. **Логування:**
   - Додати точки логування у FC_Route_Supervisor_v2
   - Відстежити commitIn vs commitAck
   - Перевірити копіювання команди

4. **Запустити тест окремо:**
   - RunSingleTest = TRUE, TestNumber = N
   - Детально перевірити кожен крок

---

## 📝 Розширення тестів

### Додати новий тест:

1. Додати кейс у FC_Test_RouteSupervisor:
   ```scl
   16:
      #testName := 'TEST 16: New test scenario';
      // ARRANGE
      // ACT
      // ASSERT
   ```

2. Оновити DB_TestResults_Supervisor:
   ```scl
   TotalTests := 16;
   Results : Array[1..16] of Struct ...
   ```

3. Додати опис у цю документацію

---

## 🎓 Висновки

Ці тести забезпечують:
- ✅ **Надійність:** Всі критичні сценарії покриті
- ✅ **Продуктивність:** Вимірювання часу відгуку
- ✅ **Безпеку:** Duplicate protection працює
- ✅ **Сумісність:** Mailbox Protocol дотримано
- ✅ **Масштабованість:** 12 маршрутів працюють незалежно

**Наступний крок:** Інтеграційні тести Supervisor + FSM + реальні механізми
