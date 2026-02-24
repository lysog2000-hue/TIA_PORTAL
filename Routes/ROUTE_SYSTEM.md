# Система маршрутів — технічна документація

**Версія:** 1.0
**Дата:** 2026-02-24
**Стан коду:** FC_RouteFSM v3.3, FC_Route_Supervisor v3.0

---

## Зміст

1. [Огляд архітектури](#1-огляд-архітектури)
2. [Шари системи](#2-шари-системи)
3. [Структури даних](#3-структури-даних)
4. [Протокол SCADA → PLC (Mailbox)](#4-протокол-scada--plc-mailbox)
5. [Протокол PLC → SCADA (Status)](#5-протокол-plc--scada-status)
6. [FSM маршруту — стани та переходи](#6-fsm-маршруту--стани-та-переходи)
7. [Виконання кроків маршруту](#7-виконання-кроків-маршруту)
8. [Безпека та аварії](#8-безпека-та-аварії)
9. [Сценарії взаємодії](#9-сценарії-взаємодії)
10. [Константи та коди](#10-константи-та-коди)

---

## 1. Огляд архітектури

Система маршрутів забезпечує **автоматичне керування послідовністю механізмів** (редлери, норії, засувки, вентилятори) за командою зі SCADA.

**Маршрут** — це впорядкована послідовність до 64 кроків. Кожен крок — це команда одному механізму (`START` або `STOP`) з умовою очікування (`RUNNING` або `IDLE`).

**Паралельність:** одночасно може виконуватися до 12 незалежних маршрутів.

**Ключовий принцип:** PLC відповідає за детерміноване виконання, арбітраж і safety. SCADA відповідає за логіку процесу, вибір маршруту та UX.

---

## 2. Шари системи

```
┌─────────────────────────────────────────────────────────┐
│  SCADA                                                  │
│  - вибір маршруту, кроки                                │
│  - команди START / STOP_OP                              │
│  - відображення стану, журналювання                     │
└────────────────┬────────────────────┬───────────────────┘
                 │ DB_ScadaToPlc      │ DB_PlcToScada
                 │ _RouteCmd          │ _RouteStatus
                 ▼                    ▲
┌─────────────────────────────────────────────────────────┐
│  FC_Route_Supervisor                                    │
│  - Mailbox: детект, валідація, ACK                      │
│  - Копіювання команди у RouteExecutor                   │
│  - Виклик FC_RouteFSM для всіх 12 маршрутів             │
│  - Cleanup RouteExecutor після завершення               │
└────────────────────────┬────────────────────────────────┘
                         │ DB_Plc_RouteExecutor[1..12]
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FC_RouteFSM  (×12, незалежно)                          │
│  - Стани: IDLE → VALIDATING → STARTING →                │
│           RUNNING → STOPPING → ABORTED/REJECTED         │
│  - Читає GlobalSafetyStop, GlobalLocalManual(глоб. теги)│
│  - DB_Plc_RouteFsm[i]: persistent стан FSM              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FC_ArbiterMech                                         │
│  - Арбітраж ownership механізмів                        │
│  - CMD_SET_OWNER_SCADA / CMD_RELEASE_OWNER              │
│  - CMD_START / CMD_STOP                                 │
└────────────────────────┬────────────────────────────────┘
                         │ DB_Mechs.Mechs[0..255]
                         ▼
┌─────────────────────────────────────────────────────────┐
│  FC_Noria / FC_Redler / FC_Fan / FC_Gate2P              │
│  - Фізичне керування механізмом                         │
│  - Зміна Status: IDLE/STARTING/RUNNING/STOPPING/FAULT   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Структури даних

### 3.1 UDT_RouteCmd — команда маршруту

```
UDT_RouteCmd
├── RC_Cmd        : USINT   // RT_CMD_NONE(0) / RT_CMD_START(1) / RT_CMD_STOP_OP(2)
├── RC_StepCount  : USINT   // кількість кроків (0..64)
└── RC_Steps[0..63] : UDT_RouteStep
```

### 3.2 UDT_RouteStep — один крок маршруту

```
UDT_RouteStep
├── RS_Slot       : UINT    // індекс механізму у DB_Mechs.Mechs[0..255]
├── RS_Action     : USINT   // RS_ACT_START(1) / RS_ACT_STOP(2)
├── RS_StartParam : INT     // параметр CMD_START (напр., позиція засувки при запуску)
├── RS_StopParam  : INT     // параметр при зупинці: 0 → CMD_STOP, ≠0 → CMD_START(param)
├── RS_Wait       : USINT   // RS_WAIT_RUNNING(1) / RS_WAIT_STOPPED(2)
└── RS_TimeoutMs  : DINT    // 0 = без таймауту (резерв, не реалізовано)
```

### 3.3 UDT_RouteStatus — статус маршруту (PLC → SCADA)

```
UDT_RouteStatus
├── RS_State      : UINT    // поточний стан FSM (таблиця нижче)
├── RS_ResultCode : UINT    // код результату (таблиця нижче)
├── RS_ActiveStep : USINT   // індекс поточного кроку (0..63)
├── RS_StepSts    : USINT   // STEP_STS_IDLE/WORK/DONE/TIMEOUT
└── RS_Warning    : USINT   // 0=OK, 1=IGNORED_CMD
```

---

## 4. Протокол SCADA → PLC (Mailbox)

### 4.1 Структура mailbox (DB_ScadaToPlc_RouteCmd)

```
DB_ScadaToPlc_RouteCmd
├── HDR_Commit  : UDINT     // лічильник команд (SCADA інкрементує при відправці)
├── HDR_RouteId : USINT     // цільовий маршрут 1..12
└── CMD_Route   : UDT_RouteCmd
```

### 4.2 Алгоритм відправки команди зі SCADA

```
1. Перевірити: HDR_Commit == ACK_CommitApplied → mailbox вільний
   Якщо ні → чекати (timeout ~1 сек, потім ERROR)

2. Записати: HDR_RouteId := <RouteId>
             CMD_Route   := <команда з кроками>

3. Атомарно: HDR_Commit := HDR_Commit + 1  ← сигнал PLC що є нова команда

4. Чекати: ACK_CommitApplied == HDR_Commit  ← підтвердження від PLC
```

### 4.3 Обробка команди на PLC (FC_Route_Supervisor)

```
1. Детект:   commitIn != commitAck → нова команда

2. Валідація RouteId:
   RouteId < 1 або > 12 → ACK + RETURN (mailbox не блокується)

3. Перевірка стану маршруту:
   isActive = (State ∈ {VALIDATING, STARTING, RUNNING, STOPPING})

4. Перевірка команди:
   RT_CMD_START  + isActive     → відхилити, RS_Warning := IGNORED_CMD
   RT_CMD_START  + NOT isActive → дозволити
   RT_CMD_STOP_OP + isActive    → дозволити
   RT_CMD_STOP_OP + NOT isActive→ відхилити, RS_Warning := IGNORED_CMD
   RT_CMD_NONE / невідома       → відхилити (без warning)

5. Якщо дозволено: RouteExecutor[RouteId] := CMD_Route

6. ACK: ACK_CommitApplied := commitIn
        ACK_RouteId        := routeId
```

> **Важливо:** ACK завжди видається — навіть якщо команда відхилена. Mailbox ніколи не блокується.

### 4.4 Формат кроків для SCADA

Приклад маршруту "Запустити редлер → чекати RUNNING → запустити норію":

```
RC_Cmd       = RT_CMD_START
RC_StepCount = 2
RC_Steps[0]:
  RS_Slot      = 0        // редлер slot 0
  RS_Action    = RS_ACT_START
  RS_StartParam = 0
  RS_StopParam  = 0       // 0 → CMD_STOP при зупинці маршруту
  RS_Wait      = RS_WAIT_RUNNING
RC_Steps[1]:
  RS_Slot      = 50       // норія slot 50
  RS_Action    = RS_ACT_START
  RS_StartParam = 0
  RS_StopParam  = 0
  RS_Wait      = RS_WAIT_RUNNING
```

---

## 5. Протокол PLC → SCADA (Status)

### 5.1 Структура статусу (DB_PlcToScada_RouteStatus)

```
DB_PlcToScada_RouteStatus
├── ACK_CommitApplied : UDINT       // останній оброблений commit
├── ACK_RouteId       : USINT       // який маршрут оброблено (0 = невалідний)
└── RoutesSts[1..12]  : UDT_RouteStatus
```

### 5.2 Таблиця станів RS_State

| Код | Константа              | Значення                                  |
|-----|------------------------|-------------------------------------------|
| 0   | ROUTE_STS_IDLE         | Очікування команди                        |
| 1   | ROUTE_STS_VALIDATING   | Перевірка команди та готовності механізмів|
| 2   | ROUTE_STS_STARTING     | Атомарне захоплення ownership механізмів  |
| 4   | ROUTE_STS_RUNNING      | Виконання кроків / маршрут активний       |
| 5   | ROUTE_STS_STOPPING     | Зупинка механізмів (контрольована)        |
| 7   | ROUTE_STS_REJECTED     | Відхилено (без side-effects)              |
| 8   | ROUTE_STS_ABORTED      | Перервано (механізми зупинені, звільнені) |

> Стан 3 (LOCKING) об'єднаний зі STARTING. Стан 6 (DONE) видалено — маршрут залишається у RUNNING.

### 5.3 Таблиця ResultCode

| Код | Константа                  | Значення                                      |
|-----|----------------------------|-----------------------------------------------|
| 200 | ROUTE_OK_RUNNING           | Маршрут виконується (всі кроки пройдено)      |
| 301 | ROUTE_REJ_BY_CONTRACT      | Невалідна структура кроків (Action/Wait)      |
| 302 | ROUTE_REJ_BY_OWNER         | Механізм зайнятий іншим власником             |
| 303 | ROUTE_REJ_NOT_READY        | Механізм не готовий (Fault/Disabled/Local)    |
| 304 | ROUTE_REJ_DUPLICATE_START  | Повторний START для активного маршруту        |
| 401 | ROUTE_ABRT_BY_OPERATOR     | STOP_OP від оператора                         |
| 402 | ROUTE_ABRT_BY_FAULT        | Аварія механізму під час виконання            |
| 403 | ROUTE_ABRT_BY_LOCAL        | Перехід механізму у LocalManual               |
| 404 | ROUTE_ABRT_BY_OWNER        | Арбітр відхилив команду під час RUNNING       |
| 405 | ROUTE_ABRT_BY_SAFETY       | GlobalSafetyStop                              |

### 5.4 RS_Warning

| Код | Значення                                        |
|-----|-------------------------------------------------|
| 0   | RS_WARNING_OK — немає попереджень               |
| 1   | RS_WARNING_IGNORED_CMD — команда проігнорована  |

`RS_Warning` скидається до OK при наступній прийнятій команді для цього маршруту.
SCADA може використовувати його для інформування оператора без переривання роботи.

---

## 6. FSM маршруту — стани та переходи

### 6.1 Діаграма переходів

```
                     ┌─────────────────────┐
          RT_CMD_NONE│                     │
  ┌─────────────────►│        IDLE         │◄──────────────────────────┐
  │                  │                     │                           │
  │                  └──────────┬──────────┘                           │
  │                             │ startEdge (RT_CMD_START фронт)       │
  │                             ▼                                      │
  │                     ┌──────────────────┐                           │
  │      REJ_BY_CONTRACT│                  │ startEdge (ще раз)        │
  │  ◄──────────────────┤    VALIDATING    ├──────────► REJECTED       │
  │  ◄── REJ_BY_OWNER   │                  │                           │
  │  ◄── REJ_NOT_READY  └──────────┬───────┘                           │
  │                                │ валідація ОК                      │
  │                                ▼                                   │
  │                  ┌─────────────────────┐                           │
  │    REJ_BY_OWNER  │                     │ lockOkAll = TRUE          │
  │  ◄───────────────┤      STARTING       ├──────────────────────┐    │
  │  (відкат lock)   │                     │                      │    │
  │                  └─────────────────────┘                      │    │
  │                                                               ▼    │
  │                  ┌─────────────────────────────────────────────────┤
  │                  │                 RUNNING                         │
  │                  │  - виконання кроків по черзі                    │
  │                  │  - видає CMD_START/STOP через FC_ArbiterMech    │
  │                  │  - чекає умову кроку (RUNNING / IDLE механізму) │
  │                  └──────┬──────┬──────┬──────┬──────────────────────
  │                         │      │      │      │
  │              STOP_OP────┘      │      │      └──── cmdOk ≠ ARB_OK
  │              anyLocal──────────┘      └────────── anyFault
  │                                ▼
  │                  ┌─────────────────────┐
  │                  │      STOPPING       │ CMD_STOP кожен цикл
  │                  │  (зворотний порядок)│ (рівневе керування)
  │                  └──────────┬──────────┘
  │                             │ allStopped = TRUE
  │                             │ CMD_RELEASE_OWNER для всіх
  │                             ▼
  └─────────────────┬──── ABORTED ────────────────────────────────────►
    RT_CMD_NONE     │  ResultCode = AbortLatched
                    │  retry CMD_RELEASE_OWNER кожен цикл (якщо OwnerCur=ROUTE)
                    │
   GlobalSafetyStop─┘ (миттєво, з будь-якого стану)
```

### 6.2 REJECTED — поведінка

- Маршрут не стартував → **ніяких side-effects** (ownership не захоплено).
- FSM чекає `RT_CMD_NONE` для повернення у IDLE.
- Supervisor очищує `RouteExecutor[i]` → `RT_CMD_NONE` на наступному циклі.
- ResultCode зберігається до наступного START (для журналювання у SCADA).

### 6.3 ABORTED — поведінка

- Маршрут виконувався → механізми зупинені, **ownership звільнено**.
- Retry `CMD_RELEASE_OWNER` кожен цикл поки `OwnerCur = OWNER_ROUTE` (після SafetyStop).
- FSM чекає `RT_CMD_NONE` для повернення у IDLE.
- Після ABORTED → повторний START дозволений (як **новий запуск**).

---

## 7. Виконання кроків маршруту

### 7.1 Послідовність у RUNNING

```
RF_ActiveStep = 0 (початок)

Цикл PLC:
  stepIdx := RF_ActiveStep

  якщо stepIdx >= stepCnt:
    ResultCode := ROUTE_OK_RUNNING (200)  ← всі кроки виконано, маршрут активний
    (залишаємось у RUNNING, механізми під Owner=ROUTE)

  інакше:
    slot := RC_Steps[stepIdx].RS_Slot
    видати команду через FC_ArbiterMech (CMD_START або CMD_STOP)

    якщо RS_Wait = RS_WAIT_RUNNING:
      чекати Mechs[slot].Status = STS_RUNNING
    якщо RS_Wait = RS_WAIT_STOPPED:
      чекати Mechs[slot].Status = STS_IDLE

    коли умова виконана:
      RF_ActiveStep := RF_ActiveStep + 1  ← перейти до наступного кроку
```

> Команда видається **кожен цикл** поки умова не виконана (рівневе керування, не імпульсне).

### 7.2 Зупинка у STOPPING

Зупинка відбувається у **зворотному порядку** кроків:

```
для i від stepCnt-1 до 0:
  якщо RS_StopParam ≠ 0:
    CMD_START(RS_StopParam)  ← напр., засувка у позицію CLOSED
  інакше:
    CMD_STOP
```

Вихід зі STOPPING — коли всі механізми маршруту мають статус не у `{STARTING, RUNNING, STOPPING}`.

### 7.3 RS_StopParam — параметрична зупинка

Для засувок (Gate2P) може знадобитися зупинити у конкретній позиції замість простого CMD_STOP:

```
RS_StopParam = 0    → CMD_STOP (просто зупинити)
RS_StopParam = 1    → CMD_START(1) = закрити засувку у позицію 1
RS_StopParam = 2    → CMD_START(2) = закрити засувку у позицію 2
```

---

## 8. Безпека та аварії

### 8.1 GlobalSafetyStop (апаратна/SCADA аварійна зупинка)

```
GlobalSafetyStop = HW_ESTOP OR SCADA_ESTOP  ← глобальний тег ПЛК
```

**Дія (найвищий пріоритет, спрацьовує з будь-якого стану):**

```
для кожного механізму маршруту:
  1. CMD_STOP           → механізм починає гальмувати
  2. CMD_RELEASE_OWNER  → звільнити ownership (best effort)
     якщо ARB_WRONG_STATUS (ще STS_RUNNING/STOPPING):
       retry у ABORTED кожен цикл поки STS → IDLE або FAULT

Fsm.RF_State      := ROUTE_STS_ABORTED
Fsm.RF_ResultCode := ROUTE_ABRT_BY_SAFETY
```

### 8.2 GlobalLocalManual (глобальний LocalManual режим)

```
GlobalLocalManual ← глобальний тег ПЛК
```

- Під час **VALIDATING:** `REJECTED` з кодом `ROUTE_REJ_NOT_READY`
- Під час **RUNNING:** `anyLocal := TRUE` → перехід у `STOPPING` з кодом `ROUTE_ABRT_BY_LOCAL`

Аналогічно для `Mechs[slot].LocalManual` (локальний LocalManual конкретного механізму).

### 8.3 Аварія механізму (FLTCode ≠ 0)

- Під час **VALIDATING:** `REJECTED` з кодом `ROUTE_REJ_NOT_READY`
- Під час **RUNNING:** `anyFault := TRUE` → перехід у `STOPPING` з кодом `ROUTE_ABRT_BY_FAULT`
- Під час **STOPPING:** механізм у `STS_FAULT` рахується як зупинений → `allStopped = TRUE`

---

## 9. Сценарії взаємодії

### 9.1 Успішний запуск маршруту

```
SCADA                    FC_Route_Supervisor          FC_RouteFSM
  │                             │                         │
  │  HDR_Commit++               │                         │
  │  HDR_RouteId = 3            │                         │
  │  CMD_Route = {START, steps} │                         │
  │────────────────────────────►│                         │
  │                             │  RouteExecutor[3]       │
  │                             │  = CMD_Route            │
  │                             │  ACK_CommitApplied++    │
  │  ACK_CommitApplied updated  │────────────────────────►│ IDLE
  │◄────────────────────────────│                         │  startEdge=TRUE
  │                             │                         ▼
  │                             │                     VALIDATING
  │                             │                     (перевірка)
  │                             │                         ▼
  │                             │                     STARTING
  │                             │                     (lock всіх)
  │                             │                         ▼
  │                             │                     RUNNING
  │                             │                     крок 0: CMD_START
  │  RS_State=RUNNING           │                     чекати STS_RUNNING
  │  RS_ActiveStep=0            │◄────────────────────────│
  │◄────────────────────────────│                         │
  │                             │                     крок 1: CMD_START
  │  RS_ActiveStep=1            │◄────────────────────────│
  │◄────────────────────────────│                         │
  │                             │                         │
  │  RS_ResultCode=200          │◄──── всі кроки ─────────│
  │◄────────────────────────────│      ROUTE_OK_RUNNING   │
```

### 9.2 Оператор зупиняє маршрут (STOP_OP)

```
SCADA                    FC_Route_Supervisor          FC_RouteFSM
  │                             │                         │
  │  CMD_Route.RC_Cmd=STOP_OP   │                         │
  │────────────────────────────►│                         │
  │                             │  RouteExecutor[3]       │
  │                             │  = {STOP_OP, ...}       │
  │  ACK_CommitApplied updated  │────────────────────────►│ RUNNING
  │◄────────────────────────────│                         │  stopOpEdge=TRUE
  │                             │                         ▼
  │  RS_State=STOPPING          │                     STOPPING
  │◄────────────────────────────│                     CMD_STOP кожен цикл
  │                             │                         │
  │                             │                     allStopped=TRUE
  │                             │                     CMD_RELEASE_OWNER
  │                             │                         ▼
  │  RS_State=ABORTED           │                     ABORTED
  │  RS_ResultCode=401          │◄────────────────────────│
  │◄────────────────────────────│                         │
  │                             │  Cleanup:               │
  │                             │  RouteExecutor[3]       │
  │                             │  .RC_Cmd = RT_CMD_NONE  │
  │                             │────────────────────────►│ IDLE (наст. цикл)
```

### 9.3 Відхилення дублікату START

```
SCADA                    FC_Route_Supervisor
  │                             │
  │  CMD START для маршруту 3   │  (маршрут 3 вже RUNNING)
  │────────────────────────────►│
  │                             │  isActive = TRUE → cmdAllowed = FALSE
  │                             │  pendingWarning = RS_WARNING_IGNORED_CMD
  │                             │  RouteExecutor[3] НЕ змінюється
  │  ACK_CommitApplied updated  │
  │  RS_Warning[3] = 1          │
  │◄────────────────────────────│
  │  (маршрут 3 продовжує RUNNING)
```

### 9.4 GlobalSafetyStop під час виконання

```
PLC (глобальний тег)     FC_RouteFSM
  │                           │
  │  GlobalSafetyStop = TRUE  │
  │──────────────────────────►│ (будь-який стан)
  │                           │  для кожного slot:
  │                           │    CMD_STOP (механізм гальмує)
  │                           │    CMD_RELEASE_OWNER (best effort)
  │                           ▼
  │                       ABORTED
  │                       ResultCode = 405 (BY_SAFETY)
  │                           │
  │                       retry CMD_RELEASE_OWNER
  │                       кожен цикл поки OwnerCur=ROUTE
  │                           │
  │                       STS_STOPPING → STS_IDLE
  │                           │  CMD_RELEASE_OWNER → ARB_OK
  │                           │  OwnerCur = NONE ✓
```

---

## 10. Константи та коди

### 10.1 Команди маршруту (RC_Cmd)

| Константа       | Код | Опис                         |
|-----------------|-----|------------------------------|
| RT_CMD_NONE     | 0   | Немає команди (cleanup стан) |
| RT_CMD_START    | 1   | Запустити маршрут            |
| RT_CMD_STOP_OP  | 2   | Зупинити маршрут (оператор)  |

### 10.2 Дії кроку (RS_Action)

| Константа    | Код | Опис                          |
|--------------|-----|-------------------------------|
| RS_ACT_START | 1   | Видати CMD_START механізму    |
| RS_ACT_STOP  | 2   | Видати CMD_STOP механізму     |

### 10.3 Умови очікування (RS_Wait)

| Константа        | Код | Умова переходу до наст. кроку |
|------------------|-----|-------------------------------|
| RS_WAIT_RUNNING  | 1   | Mechs[slot].Status = STS_RUNNING |
| RS_WAIT_STOPPED  | 2   | Mechs[slot].Status = STS_IDLE    |

### 10.4 Ключові файли

| Файл                                   | Призначення                              |
|----------------------------------------|------------------------------------------|
| `Routes/FC_RouteFSM.scl`               | Логіка FSM маршруту                     |
| `Routes/FC_Route_Supervisor.scl`       | Mailbox + оркестрація FSM               |
| `Routes/DB_ScadaToPlc_RouteCmd.scl`    | Вхідний mailbox (SCADA → PLC)           |
| `Routes/DB_PlcToScada_RouteStatus.scl` | Вихідний статус (PLC → SCADA)           |
| `Routes/DB_Plc_RouteExecutor.scl`      | Внутрішній буфер команд [1..12]         |
| `Routes/DB_Plc_RouteFsm.scl`           | Persistent стани FSM [1..12]            |
| `Routes/udt/UDT_RouteCmd.scl`          | Структура команди                       |
| `Routes/udt/UDT_RouteStep.scl`         | Структура кроку                         |
| `Routes/udt/UDT_RouteStatus.scl`       | Структура статусу                       |
| `Routes/udt/UDT_RouteFsm.scl`          | Внутрішній стан FSM                     |

---

**Кінець документа**
