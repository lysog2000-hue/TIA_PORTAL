# Тести для FC_RouteFSM v2.0.1

**Дата:** 2026-02-04  
**Версія:** 1.0  
**Статус:** ✅ Структура готова, 16/35 тестів імплементовано

---

## 📋 Огляд

Тестовий фреймворк для **FC_RouteFSM** аналогічний до тестів Supervisor:

```
Routes_Test/
├── DB_TestResults_RouteFSM.scl      (результати 35 тестів)
├── FB_TestRunner_RouteFSM.scl       (автоматичний runner)
└── FC_Test_RouteFSM.scl             (35 сценаріїв)
```

**Поточний стан:**
- ✅ 16 тестів імплементовано (GROUP A, B, C)
- ⏳ 19 тестів залишилось (GROUP D-H)
- ✅ Інфраструктура готова
- ✅ Шаблони доступні

---

## 🎯 Покриття тестів (35 шт)

### GROUP A: Базові переходи станів (8 тестів) ✅

| # | Тест | Статус |
|---|------|--------|
| 1 | IDLE → VALIDATING (START edge) | ✅ Done |
| 2 | VALIDATING → STARTING (validation OK) | ✅ Done |
| 3 | VALIDATING → REJECTED (owner busy) | ✅ Done |
| 4 | STARTING → RUNNING (lock OK) | ✅ Done |
| 5 | STARTING → REJECTED (lock fail) | ✅ Done |
| 6 | RUNNING → RUNNING (all steps done, RC=200) | ✅ Done |
| 7 | RUNNING → STOPPING (STOP_OP) | ✅ Done |
| 8 | STOPPING → ABORTED (allStopped) | ✅ Done |

**Ключові перевірки:**
- Edge detection для START/STOP_OP
- Валідація переходів між станами
- ResultCode при завершенні кроків (200)
- Owner release при ABORTED

---

### GROUP B: Safety Stop (2 тести) ✅

| # | Тест | Статус |
|---|------|--------|
| 9 | Safety Stop during RUNNING | ✅ Done |
| 10 | Safety Stop during STARTING | ✅ Done |

**Ключові перевірки:**
- GlobalSafetyStop → ABORTED негайно
- ResultCode = ROUTE_ABRT_BY_SAFETY (301)
- Owner звільнено одразу (без STOPPING)

---

### GROUP C: Валідація (6 тестів) ✅

| # | Тест | Статус |
|---|------|--------|
| 11 | Duplicate START → REJECTED (205) | ✅ Done |
| 12 | Invalid StepCount=0 → REJECTED | ✅ Done |
| 13 | Invalid Action → REJECTED | ✅ Done |
| 14 | Invalid Wait → REJECTED | ✅ Done |
| 15 | Owner busy → REJECTED (202) | ✅ Done |
| 16 | Not ready (Enable_OK=0) → REJECTED (204) | ✅ Done |

**Ключові перевірки:**
- Edge detection для duplicate START
- Контракт: StepCount > 0
- Контракт: Action ∈ {RS_ACT_START, RS_ACT_STOP}
- Контракт: Wait ∈ {RS_WAIT_RUNNING, RS_WAIT_STOPPED}
- Owner conflicts → REJ_BY_OWNER
- Ready checks → REJ_NOT_READY

---

### GROUP D: Atomic Lock (3 тести) ⏳

| # | Тест | Статус |
|---|------|--------|
| 17 | Lock all mechs → RUNNING | ⏳ TODO |
| 18 | Lock partial fail → REJECTED + rollback | ⏳ TODO |
| 19 | Lock race condition → REJECTED | ⏳ TODO |

**Шаблон для імплементації:**
```scl
// TEST 17: Lock all mechs -> RUNNING
// ARRANGE:
//   - fsm.RF_State := ROUTE_STS_STARTING
//   - cmd.RC_StepCount := 3  // 3 механізми
//   - Всі механізми вільні (OwnerCur = NONE)
// ACT: викликати FSM
// ASSERT:
//   - RF_State = RUNNING
//   - Всі Mechs[slot].OwnerCur = OWNER_ROUTE
//   - Всі Mechs[slot].OwnerCurId = routeIdx

// TEST 18: Lock partial fail -> REJECTED + rollback
// ARRANGE:
//   - Механізм 0: OwnerCur = NONE
//   - Механізм 1: OwnerCur = OWNER_ROUTE, OwnerCurId = 2 (зайнято)
// ACT: викликати FSM
// ASSERT:
//   - RF_State = REJECTED
//   - ResultCode = REJ_BY_OWNER
//   - Механізм 0: OwnerCur = NONE (rollback)
```

---

### GROUP E: Виконання кроків (5 тестів) ⏳

| # | Тест | Статус |
|---|------|--------|
| 20 | START + WAIT_RUNNING → next step | ⏳ TODO |
| 21 | STOP + WAIT_STOPPED → next step | ⏳ TODO |
| 22 | Last step → RUNNING (RC=200) | ⏳ TODO |
| 23 | Step arbiter fail → STOPPING | ⏳ TODO |
| 24 | StartParam passed to arbiter | ⏳ TODO |

**Шаблон:**
```scl
// TEST 20: START + WAIT_RUNNING -> next step
// ARRANGE:
//   - fsm.RF_State := RUNNING
//   - fsm.RF_ActiveStep := 0
//   - cmd.RC_Steps[0].RS_Action := RS_ACT_START
//   - cmd.RC_Steps[0].RS_Wait := RS_WAIT_RUNNING
//   - Mechs[slot].Status := STS_IDLE  // ще не працює
// ACT: викликати FSM
// ASSERT (cycle 1):
//   - ActiveStep = 0 (не змінився, ще STARTING)
//   - Mechs[slot].Cmd = CMD_START (команда видана)
// SETUP (cycle 2):
//   - Mechs[slot].Status := STS_RUNNING
// ACT: викликати FSM знову
// ASSERT (cycle 2):
//   - ActiveStep = 1 (крок виконано)

// TEST 24: StartParam passed to arbiter
// ARRANGE:
//   - cmd.RC_Steps[0].RS_StartParam := 7
// ACT: викликати FSM
// ASSERT:
//   - Mechs[slot].CmdParam1 = 7
```

---

### GROUP F: STOPPING логіка (4 тести) ⏳

| # | Тест | Статус |
|---|------|--------|
| 25 | STOPPING → ABORTED (allStopped) | ⏳ TODO |
| 26 | StopParam=0 → CMD_STOP | ⏳ TODO |
| 27 | StopParam!=0 → CMD_START with param | ⏳ TODO |
| 28 | STOPPING reverse order | ⏳ TODO |

**Шаблон:**
```scl
// TEST 26: StopParam=0 -> CMD_STOP
// ARRANGE:
//   - fsm.RF_State := STOPPING
//   - cmd.RC_Steps[0].RS_StopParam := 0
// ACT: викликати FSM
// ASSERT:
//   - Mechs[slot].Cmd = CMD_STOP

// TEST 27: StopParam!=0 -> CMD_START with param
// ARRANGE:
//   - cmd.RC_Steps[0].RS_StopParam := 8  // CMD_GATE_CLOSED
// ACT: викликати FSM
// ASSERT:
//   - Mechs[slot].Cmd = CMD_START
//   - Mechs[slot].CmdParam1 = 8
```

---

### GROUP G: Abort scenarios (4 тести) ⏳

| # | Тест | Статус |
|---|------|--------|
| 29 | ABORT_BY_OPERATOR (stopOpEdge) | ⏳ TODO |
| 30 | ABORT_BY_LOCAL (anyLocal) | ⏳ TODO |
| 31 | ABORT_BY_FAULT (anyFault) | ⏳ TODO |
| 32 | ABORT_BY_SAFETY (global) | ⏳ TODO |

**Шаблон:**
```scl
// TEST 30: ABORT_BY_LOCAL (anyLocal)
// ARRANGE:
//   - fsm.RF_State := RUNNING
//   - Mechs[slot].LocalManual := TRUE
// ACT: викликати FSM
// ASSERT:
//   - RF_State = STOPPING
//   - RF_AbortLatched = ROUTE_ABRT_BY_LOCAL

// TEST 31: ABORT_BY_FAULT (anyFault)
// ARRANGE:
//   - fsm.RF_State := RUNNING
//   - Mechs[slot].FLTCode := FLT_BREAKER
// ACT: викликати FSM
// ASSERT:
//   - RF_State = STOPPING
//   - RF_AbortLatched = ROUTE_ABRT_BY_FAULT
```

---

### GROUP H: Edge cases (3 тести) ⏳

| # | Тест | Статус |
|---|------|--------|
| 33 | Route with 0 steps → REJECTED | ⏳ TODO |
| 34 | StepIdx >= StepCnt → RUNNING (RC=200) | ⏳ TODO |
| 35 | START after ABORTED → new cycle | ⏳ TODO |

**Шаблон:**
```scl
// TEST 35: START after ABORTED -> new cycle
// ARRANGE (cycle 1):
//   - fsm.RF_State := ABORTED
//   - fsm.RF_ResultCode := ROUTE_ABRT_BY_OPERATOR
//   - cmd.RC_Cmd := RT_CMD_NONE
// ACT: викликати FSM
// ASSERT (cycle 1):
//   - RF_State = IDLE (cleanup)
// ARRANGE (cycle 2):
//   - cmd.RC_Cmd := RT_CMD_START (новий START)
// ACT: викликати FSM знову
// ASSERT (cycle 2):
//   - RF_State = VALIDATING (новий цикл)
//   - RF_ResultCode = 0 (очищено)
```

---

## 🚀 Як запустити тести

### Варіант 1: Всі тести автоматично

```scl
// В OB1 або test OB
"FB_TestRunner_RouteFSM"(
    Start := TRUE,
    Reset := FALSE,
    Running => #running,
    Done => #done,
    AllPassed => #allPassed
);
```

### Варіант 2: Один тест

```scl
"FB_TestRunner_RouteFSM"(
    RunSingleTest := TRUE,
    TestNumber := 20,  // Запустити тест 20
    Running => #running,
    Done => #done,
    AllPassed => #passed
);
```

### Варіант 3: Скинути результати

```scl
"FB_TestRunner_RouteFSM"(
    Reset := TRUE
);
```

---

## 📊 Аналіз результатів

**DB_TestResults_RouteFSM:**

```
TotalTests: 35
PassedTests: ?
FailedTests: ?
AllTestsRun: TRUE/FALSE

Results[1..35]:
  - TestNumber: 1..35
  - TestName: "..."
  - Passed: TRUE/FALSE
  - ErrorCode: 0 (або код помилки)
```

**Приклад перевірки через HMI:**
```
IF DB_TestResults_RouteFSM.AllTestsRun THEN
    IF DB_TestResults_RouteFSM.FailedTests = 0 THEN
        // ✅ Всі тести пройшли
    ELSE
        // ❌ Є помилки, дивись Results[i].Passed
    END_IF
END_IF
```

---

## 🔧 Налагодження тестів

### Якщо тест падає:

1. **Дивись FailMask** (якщо є у тесті)
   - Біт 0x0001: State не співпадає
   - Біт 0x0002: ResultCode не співпадає
   - Біт 0x0004: Owner не співпадає
   - Біт 0x0010: ActiveStep не співпадає

2. **Перевір стан механізмів**
   ```
   DB_Mechs.Mechs[slot].OwnerCur
   DB_Mechs.Mechs[slot].Status
   DB_Mechs.Mechs[slot].Cmd
   ```

3. **Перевір FSM**
   ```
   DB_Plc_RouteFsm.RoutesFsm[routeIdx].RF_State
   DB_Plc_RouteFsm.RoutesFsm[routeIdx].RF_ResultCode
   ```

4. **Перевір очікування**
   - Правильно встановлені Exp_State / Exp_ResultCode?
   - Чи підготовані механізми (DeviceType, OwnerCur, Enable_OK)?

---

## 📝 TODO List

### Пріоритет 1: Базові функції (GROUP D-E)
- [ ] TEST 17: Atomic lock успішний
- [ ] TEST 18: Atomic lock rollback
- [ ] TEST 20-22: Виконання кроків
- [ ] TEST 24: StartParam

### Пріоритет 2: STOPPING (GROUP F)
- [ ] TEST 26-27: StopParam обробка
- [ ] TEST 28: Reverse order

### Пріоритет 3: Abort scenarios (GROUP G)
- [ ] TEST 29-31: Різні причини ABORT

### Пріоритет 4: Edge cases (GROUP H)
- [ ] TEST 33: Empty route
- [ ] TEST 35: Restart after ABORT

---

## ✅ Acceptance Criteria

**Система вважається протестованою коли:**

- [x] Всі 16 базових тестів (A, B, C) проходять
- [ ] Всі 19 додаткових тестів (D-H) проходять
- [ ] PassedTests = 35
- [ ] FailedTests = 0
- [ ] AllTestsRun = TRUE
- [ ] Немає FailMask у Results[]

---

## 📚 Додаткові ресурси

- **FC_RouteFSM.scl** - імплементація FSM
- **route_fsm_canon.md** - канонічна FSM таблиця
- **FC_Test_RouteFSM_Part2_TEMPLATE.scl** - шаблони для решти тестів
- **FB_Test_ArbiterMech.scl** - приклади тестування арбітра

---

**Кінець документації**

🎯 **Наступний крок:** Імплементувати тести 17-35 використовуючи шаблони вище.
