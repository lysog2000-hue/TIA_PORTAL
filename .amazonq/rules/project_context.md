# Elevator Automation System — контекст проекта

## Общее
- Платформа: Siemens TIA Portal v19
- Язык: SCL (Structured Control Language)
- Назначение: автоматизация элеватора (зерновой терминал)
- SCADA: WinCC Unified (JavaScript)
- SQL Server: DESKTOP-4462UFF\SQLEXPRESS
- **Всегда отвечать на русском языке**

---

## Структура репозитория

```
tia_repo/
├── Main.scl                  — главный OB (цикл: симуляторы → ручное → маршруты → механизмы)
├── Startup.scl               — OB инициализации v0.3 (сброс всех HAL + таймингов + LastStopMs)
├── Constant.csv              — все константы проекта (импорт в TIA)
├── Constant_project.csv      — дополнительные константы проекта
├── Mechs.csv / Mechs.xlsx    — конфигурация механизмов (счётчики: REDLERS_COUNT=38 и т.д.)
├── graph.json                — граф устройств (186 устройств, источник для генераторов)
├── generate_all_alarms.py    — генератор HMIAlarms_All.xlsx из graph.json (696 аварий)
├── JsonToSQL.py              — создание БД ElevatorRouting из graph.json
├── CreateRunTimeDB.py        — создание БД RunTime для моточасов
├── RuntimeLogger.js          — JS скрипт SCADA: запись статусов механизмов в RunTime
├── Core/
│   ├── FC_ArbiterMech.scl    — арбитраж владельца механизма
│   ├── FC_DeviceRunner.scl   — диспетчер: цикл по слотам, вызов FC по DeviceType
│   └── FC_TimeElapsedMs.scl  — таймер на TIME_TCK()
├── Mechs/
│   ├── Udts/                 — UDT структуры каждого типа
│   ├── FC_Redler.scl         — v0.6
│   ├── FC_Noria.scl          — v0.5
│   ├── FC_Fan.scl            — v1.4
│   ├── FC_Gate2P.scl         — v1.5
│   ├── FC_Feeder.scl         — v0.3
│   ├── FC_Separator.scl      — v0.3
│   ├── FC_Valve3P.scl        — v1.1
│   ├── FC_Silos.scl          — закомментирован в DeviceRunner
│   ├── FC_Sushka.scl         — закомментирован в DeviceRunner
│   └── FC_ReceivingPit.scl   — закомментирован в DeviceRunner
├── Routes/
│   ├── FC_RouteFSM.scl       — v4.0
│   ├── FC_Route_Supervisor.scl — v3.2.2
│   └── udt/
├── Manual/
│   └── FC_ManualMechCmdHandler.scl
├── Mech_Simulate/
│   ├── DB_SimMechs.scl
│   ├── DB_SimConfig.scl
│   ├── FC_SimRedler.scl      — v2.1
│   ├── FC_SimNoria.scl       — v2.2
│   ├── FC_SimFan.scl         — v2.1
│   ├── FC_SimGate2P.scl
│   ├── FC_SimSeparator.scl
│   ├── FC_SimFeeder.scl
│   └── UDT_Sim*.scl
├── SCADA_Scripts/
│   └── DB_Helper/
│       ├── GlobalDefinitions.js
│       └── Main.js
├── docs/
│   ├── force_bits_and_faults.md  — таблица FLTCode битів та Force_Code (актуальна)
│   ├── fltcode_bitmask.md        — опис переходу на бітову маску
│   └── min_restart_interval.md   — мінімальний інтервал перезапуску
└── FB_Test_*.scl
```

---

## Слоты механизмов (FC_DeviceRunner)

| Тип            | Слоты     | Константа типа         | Кол-во |
|----------------|-----------|------------------------|--------|
| Redler         | 1–39      | TYPE_REDLER = 2        | 39     |
| Noria          | 51–62     | TYPE_NORIA = 1         | 12     |
| Gate2P         | 116–182   | TYPE_GATE2P = 3        | 62     |
| Valve3P        | 201–229   | TYPE_VALVE3P = 5       | 30     |
| Silos          | 251–278   | TYPE_SILOS = 8         | 28     |
| Sushka         | 281–284   | TYPE_SUSHKA = 9        | 4      |
| ReceivingPit   | 305–306   | TYPE_RECEIVING_PIT = 6 | 2      |
| Separator      | 311–313   | TYPE_SEPARATOR = 7     | 3      |
| Feeder         | 314–316   | TYPE_FEEDER = 10       | 3      |
| Fan            | 317–319   | TYPE_FAN = 4           | 3      |

Счётчики в Mechs.csv: REDLERS_COUNT=38, NORIAS_COUNT=11, FANS_COUNT=2, SEPARATORS_COUNT=2, FEEDERS_COUNT=2, GATES2P_COUNT=80, VALVES3P_COUNT=29, SILOS_COUNT=27, SUSHKAS_COUNT=3, MECHS_COUNT=319

---

## Архитектура механизмов

### UDT_BaseMechanism — общие поля
```
SlotId, DeviceType, TypedIndex
Status, FLTCode : WORD,  Cmd, CmdParam1, LastCmd
OwnerCur, OwnerCurId
Enable_OK, LocalManual
Force_Code : INT  — битовая маска форсирования защит
Status_Param : INT
```

### UDT типизированных механизмов — поля таймингов
| Тип | Поля таймингов |
|-----|----------------|
| Redler | StartMs, SpeedLostMs, FeedbackLostMs, StopMs, **LastStopMs** |
| Noria | StartMs, SpeedLostMs, FeedbackLostMs, StopMs, **LastStopMs** |
| Fan | StartMs, FeedbackLostMs, StopMs, **LastStopMs** |
| Separator | StartMs, FeedbackLostMs, StopMs, **LastStopMs** |
| Feeder | StartMs, FeedbackLostMs, StopMs, **LastStopMs** |

> `LastStopMs` — метка времени последней остановки, используется для минимального интервала перезапуска

### Состояния механизма (Status)
| Константа    | Значение | Описание          |
|--------------|----------|-------------------|
| STS_IDLE     | 0        | Готов             |
| STS_STARTING | 1        | Запуск            |
| STS_RUNNING  | 2        | Работа            |
| STS_STOPPING | 3        | Остановка         |
| STS_FAULT    | 4        | Авария            |
| STS_DISABLED | 10       | Enable_OK = FALSE |
| STS_LOCAL    | 11       | LocalManual = TRUE|

### Команды механизма (Cmd)
| Константа          | Значение |
|--------------------|----------|
| CMD_NONE           | 0        |
| CMD_START          | 1        |
| CMD_STOP           | 2        |
| CMD_RESET          | 3        |
| CMD_RELEASE_OWNER  | 5        |
| CMD_SET_OWNER_SCADA| 8        |
| CMD_GATE_POS0      | 6        |
| CMD_GATE_POS1      | 7        |

---

## FLTCode — битовая маска (WORD)

> FLTCode теперь битовая маска — механизм может иметь несколько аварий одновременно.
> Установка: `#B.FLTCode := #B.FLTCode OR "FLT_XXX"`
> Сброс: `#B.FLTCode := #B.FLTCode AND NOT "FLT_XXX"`
> Проверка: `IF (#B.FLTCode AND "FLT_XXX") <> 0 THEN`

| Бит  | Маска | FLT константа         | Redler | Noria | Fan | Sep | Feed | Gate2P | Valve3P |
|------|-------|-----------------------|:------:|:-----:|:---:|:---:|:----:|:------:|:-------:|
| BIT0 | 1     | FLT_BREAKER           | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BIT1 | 2     | FLT_OVERFLOW          | ✅ | ✅ | — | — | — | — | — |
| BIT2 | 4     | FLT_NO_RUNFB          | ✅ | ✅ | — | — | — | — | — |
| BIT3 | 8     | FLT_ALINGMENT         | — | ✅ | — | — | — | — | — |
| BIT4 | 16    | FLT_NO_FEEDBACK       | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| BIT5 | 32    | FLT_GATE_MOVE_TIMEOUT | — | — | — | — | — | ✅ | — |
| BIT6 | 64    | FLT_GATE_POS_UNKNOWN  | — | — | — | — | — | ✅ | — |
| BIT7 | 128   | FLT_BOTH_SENSORS      | — | — | — | — | — | ✅ | — |
| BIT8 | 256   | FLT_STOP_TIMEOUT      | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| BIT9 | 512   | FLT_VALVE_MOVE_TIMEOUT| — | — | — | — | — | — | ✅ |
| BIT10| 1024  | FLT_VALVE_POS_UNKNOWN | — | — | — | — | — | — | ✅ |
| BIT11| 2048  | FLT_VALVE_MULTIPLE_POS| — | — | — | — | — | — | ✅ |
| BIT12| 4096  | FLT_INTERLOCK         | резерв | резерв | резерв | резерв | резерв | резерв | резерв |

---

## Force_Code — битовая маска (INT)

| Бит  | Маска | Переменная       | Форсирует FLT                              |
|------|-------|------------------|--------------------------------------------|
| BIT0 | 1     | forceBreaker     | FLT_BREAKER                                |
| BIT1 | 2     | forceOverflow    | FLT_OVERFLOW                               |
| BIT2 | 4     | forceSpeed       | FLT_NO_RUNFB                               |
| BIT3 | 8     | forceAlingment   | FLT_ALINGMENT                              |
| BIT4 | 16    | forceMoveTimeout | FLT_GATE_MOVE_TIMEOUT / FLT_VALVE_MOVE_TIMEOUT |
| BIT5 | 32    | forcePosUnknown  | FLT_GATE_POS_UNKNOWN / FLT_VALVE_POS_UNKNOWN |
| BIT6 | 64    | forceStopTimeout | FLT_STOP_TIMEOUT                           |
| BIT8 | 256   | forceFeedback    | FLT_NO_FEEDBACK                            |

> FLT_BOTH_SENSORS и FLT_VALVE_MULTIPLE_POS — не форсируются

---

## Минимальный интервал перезапуска

При переходе STOPPING→IDLE сохраняется `LastStopMs := TIME_TCK()`.
CMD_START выполняется только если прошло >= минимального интервала.

| Константа                    | Значение |
|------------------------------|----------|
| TimeoutMs_Redler_MinRestart  | 3000 мс  |
| TimeoutMs_Noria_MinRestart   | 3000 мс  |
| TimeoutMs_Fan_MinRestart     | 5000 мс  |
| TimeoutMs_Separator_MinRestart | 3000 мс |
| TimeoutMs_Feeder_MinRestart  | 3000 мс  |

---

## Таймауты (Constant.csv, тип DInt, мс)

| Константа                          | Значение |
|------------------------------------|----------|
| TimeoutMs_Redler_Start             | 5000     |
| TimeoutMs_Redler_SpeedPause        | 2000     |
| TimeoutMs_Redler_FeedbackPause     | 2000     |
| TimeoutMs_Redler_Stop              | 10000    |
| TimeoutMs_Noria_Start              | 5000     |
| TimeoutMs_Noria_SpeedPause         | 2000     |
| TimeoutMs_Noria_FeedbackPause      | 2000     |
| TimeoutMs_Noria_Stop               | 10000    |
| TimeoutMs_Fan_Feedback             | 5000     |
| TimeoutMs_Fan_FeedbackPause        | 2000     |
| TimeoutMs_Fan_Stop                 | 10000    |
| TimeoutMs_Separator_Feedback       | 5000     |
| TimeoutMs_Separator_FeedbackPause  | 2000     |
| TimeoutMs_Separator_Stop           | 10000    |
| TimeoutMs_Feeder_Feedback          | 5000     |
| TimeoutMs_Feeder_FeedbackPause     | 2000     |
| TimeoutMs_Feeder_Stop              | 10000    |
| TimeoutMs_Gate_Move                | 10000    |
| TimeoutMs_Gate_Position_Unknown    | 15000    |
| TimeoutMs_Valve_Move               | 15000    |
| TimeoutMs_Valve_Position_Unknown   | 15000    |

---

## Арбитраж владельцев (FC_ArbiterMech)

| Owner         | Код | Описание                    |
|---------------|-----|-----------------------------|
| OWNER_NONE    | 0   | Свободен                    |
| OWNER_SCADA   | 1   | Ручное управление со SCADA  |
| OWNER_ROUTE   | 2   | Под управлением маршрута    |

Приоритет: LocalManual > OWNER_LOCAL > OWNER_SCADA = OWNER_ROUTE (кто первый)

Коды возврата: ARB_OK=0, ARB_LOCAL_MANUAL=1, ARB_OWNER_BUSY=2, ARB_WRONG_STATUS=3, ARB_SLOT_INVALID=4, ARB_CMD_BLOCKED=5, ARB_CMD_INVALID=6

---

## Система маршрутов

- До 12 параллельных маршрутов (ROUTES_COUNT=12)
- До 64 шагов в маршруте (ROUTE_MAX_STEPS=64)
- Каждый шаг: RS_Slot + RS_Action (START/STOP) + RS_Wait (RUNNING/STOPPED) + RS_StartParam + RS_StopParam

### Состояния маршрута (RS_State)
IDLE(0) → VALIDATING(1) → STARTING(2) → RUNNING(4) → STOPPING(5) → ABORTED(8) / REJECTED(7)

### Mailbox протокол SCADA→PLC
1. SCADA инкрементирует HDR_Commit
2. PLC обрабатывает, копирует в RouteExecutor
3. PLC подтверждает: ACK_CommitApplied := HDR_Commit

---

## SQL Базы данных

### ElevatorRouting (JsonToSQL.py)
- `Mechanisms` — справочник устройств из graph.json
- `Ports` — порты устройств
- `Connections` — связи между устройствами
- `RouteCache` — кэш маршрутов
- `FindRoute` — хранимая процедура поиска маршрута

### RunTime (CreateRunTimeDB.py)
БД для моточасов механизмов (Redler, Noria, Fan, Separator, Feeder — 60 устройств)

| Таблица | Строк | Описание |
|---------|-------|----------|
| Mechanisms | 60 | Справочник (фиксированный) |
| StatusLog | 60 | Текущее состояние (фиксированный, не растёт) |
| RunTimeSummary | 60 | Итоговая наработка в секундах |
| EventHistory | растёт | История запусков/остановок |

---

## SCADA Scripts (WinCC Unified JavaScript)

### SCADA_Scripts/DB_Helper/GlobalDefinitions.js
- `routeBuffer`, `variantList` — буферы данных
- `RunQueryAndCache(startId, endId, midId)` — запрос маршрута из SQL
- `GetActiveRouteData(vId)`, `GetVariantList()`, `GetVariantFromBuffer(variantId)`
- `resetMechanism(obj)` — сброс цвета SVG механизма

### SCADA_Scripts/DB_Helper/Main.js
- `Btn_OpenList_OnTapped` — запрос маршрутов из ElevatorRouting
- `Apply_OnTapped` — запись выбранного маршрута в PLC теги
- `Btn_OpenMotoHours_OnTapped` — загрузка моточасов из RunTime

### RuntimeLogger.js
- Читает теги `DB_Mechs_Mechs{ID}_Status` для 60 механизмов
- Вызывает `EXEC UpdateMechStatus` для каждого
- DSN=RunTime, HMI_User

---

## Симуляторы

| Параметр конфига   | Redler | Noria | Fan | Separator | Feeder |
|--------------------|--------|-------|-----|-----------|--------|
| SimFault_Breaker   | ✅ | ✅ | ✅ | ✅ | ✅ |
| SimFault_Overflow  | ✅ | ✅ | — | — | — |
| SimFault_Alignment | — | ✅ | — | — | — |
| SimFault_Feedback  | ✅ | ✅ | ✅ | — | — |

> FLT_STOP_TIMEOUT симуляторами не симулируется

---

## HMI Аварии (HMIAlarms_All.xlsx)

Генерируется `generate_all_alarms.py` из `graph.json`. 186 устройств, **696 аварий**.

| Тип | Биты аварий (номера бит в WORD) |
|-----|--------------------------------|
| Redler | BIT0(Breaker), BIT1(Overflow), BIT2(Speed), BIT4(Feedback), BIT8(StopTimeout) |
| Noria | BIT0, BIT1, BIT2, BIT3(Alingment), BIT4(Feedback), BIT8(StopTimeout) |
| Fan | BIT0, BIT4(Feedback), BIT8(StopTimeout) |
| Separator | BIT0, BIT4(Feedback), BIT8(StopTimeout) |
| Feeder | BIT0, BIT4(Feedback), BIT8(StopTimeout) |
| Gate2P | BIT0, BIT5(MoveTimeout), BIT6(PosUnknown), BIT7(BothSensors) |
| Valve3P | BIT0, BIT9(MoveTimeout), BIT10(PosUnknown), BIT11(MultiplePOS) |
| Silos | BIT0 |
| Sushka | BIT0 |
| ReceivingPit | BIT0 |

---

## Порядок загрузки в TIA Portal

1. Constant.csv + Mechs.csv (теги-константы)
2. UDT структуры (Mechs/Udts/, Mech_Simulate/UDT_Sim*.scl, Routes/udt/, Manual/UDTs/)
3. DB блоки (Mechs/DB_Mechs.scl, Routes/DB_*.scl, Mech_Simulate/DB_Sim*.scl, Manual/DB_*.scl)
4. FC/FB механизмов (Core/, Mechs/, Manual/)
5. FC симуляторов (Mech_Simulate/FC_Sim*.scl)
6. FC маршрутов (Routes/FC_Route*.scl)
7. FB тестов (FB_Test_*.scl)
8. Main.scl, Startup.scl

---

## Незавершённое / в разработке

- FC_Silos, FC_Sushka, FC_ReceivingPit — закомментированы в FC_DeviceRunner
- scl_generator/ — пустая папка
- Constant.xlsx vs Constant.csv — не синхронизированы
- FB_Test_*.scl — тесты используют старую логику сравнения FLTCode (= вместо AND), требуют обновления под битовую маску
- Реверсивный редлер — план есть, реализация отложена
