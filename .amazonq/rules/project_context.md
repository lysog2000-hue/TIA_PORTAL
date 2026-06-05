﻿# Elevator Automation System — контекст проекта

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
├── Main.scl                  — главный OB
├── Startup.scl               — OB инициализации v0.3
├── Constant.csv              — все константы проекта
├── Constant_project.csv      — дополнительные константы
├── Mechs.csv                 — счётчики механизмов
├── graph.json                — граф устройств (186 устройств)
├── generate_all_alarms.py    — генератор HMIAlarms_All.xlsx (696 аварий)
├── JsonToSQL.py              — создание БД ElevatorRouting
├── CreateRunTimeDB.py        — создание БД RunTime
├── RuntimeLogger.js          — JS скрипт SCADA: запись моточасов
├── Core/
│   ├── FC_ArbiterMech.scl    — арбитраж владельца (auto-release после CMD_RESET)
│   ├── FC_DeviceRunner.scl   — диспетчер механизмов (FC_Silos раскомментирован)
│   └── FC_TimeElapsedMs.scl
├── Mechs/
│   ├── Udts/
│   │   ├── UDT_BaseMechanism.scl
│   │   ├── UDT_Redler.scl        — v0.4 (LastStopMs)
│   │   ├── UDT_Noria.scl         — v0.4 (LastStopMs)
│   │   ├── UDT_Fan.scl           — v1.1 (LastStopMs)
│   │   ├── UDT_Separator.scl     — v0.3 (LastStopMs)
│   │   ├── UDT_Feeder.scl        — v0.2 (LastStopMs)
│   │   ├── UDT_Gate2P.scl
│   │   ├── UDT_Valve3P.scl
│   │   ├── UDT_Silos.scl         — DI_LevelHigh_OK, DI_LevelLow_OK, AI_Level, GrainType
│   │   ├── UDT_ReceivingPit.scl  — GrainType : INT
│   │   ├── UDT_Sushka.scl        — v0.6 (Fans[1..7], Burners[1..2], Discharge, FLTCode:DWord)
│   │   ├── UDT_Sushka_Fan.scl    — DI_Breaker_OK, DI_Feedback_OK, DO_Run, Status, LastStopMs
│   │   ├── UDT_Sushka_Burner.scl — DI_Breaker_OK, DI_Temp_OK, DI_Alarm, DI_Auto_OK, AQ_Power, AI_Power
│   │   └── UDT_Sushka.scl
│   ├── DB_Mechs.scl          — VAR обычные + VAR RETAIN (Redler/Noria/Fan/Sep/Feeder/Silos/ReceivingPit)
│   ├── FC_Redler.scl         — v0.6
│   ├── FC_Noria.scl          — v0.5
│   ├── FC_Fan.scl            — v1.4
│   ├── FC_Gate2P.scl         — v1.5
│   ├── FC_Valve3P.scl        — v1.1
│   ├── FC_Separator.scl      — v0.3
│   ├── FC_Feeder.scl         — v0.3
│   ├── FC_Silos.scl          — v0.2 (FLT_HIGH_LEVEL, forceHighLevel BIT9)
│   ├── FC_Sushka.scl         — базовый
│   └── FC_Sushka_1B.scl      — v0.8 (сушилка с 1 горелкой, 7 вентиляторов, пошаговый запуск)
├── Routes/
│   ├── FC_RouteFSM.scl       — v4.6 (Fast Stop implementation)
│   ├── FC_Route_Supervisor.scl — v3.2.2
│   └── udt/
├── Manual/
│   └── FC_ManualMechCmdHandler.scl
├── Mech_Simulate/
│   └── FC_SimSilos.scl       — v1.1 (инициализация DI_LevelHigh_OK=TRUE)
├── SCADA_Scripts/
│   └── DB_Helper/
│       ├── DB_Helper.js      — RunQueryAndCache, GetVariantFromBuffer и т.д.
│       └── Main.js           — Apply_OnTapped (routeIdx из ResultCode), Button_9 (остановка)
└── docs/
    ├── force_bits_and_faults.md  — актуальная таблица Force_Code и FLTCode
    ├── fltcode_bitmask.md
    └── min_restart_interval.md
```

---

## Слоты механизмов (FC_DeviceRunner)

| Тип | Слоты | Константа | Кол-во |
|-----|-------|-----------|--------|
| Redler | 1–39 | TYPE_REDLER = 2 | 39 |
| Noria | 51–62 | TYPE_NORIA = 1 | 12 |
| Gate2P | 116–182 | TYPE_GATE2P = 3 | 62 |
| Valve3P | 201–229 | TYPE_VALVE3P = 5 | 30 |
| Silos | 251–278 | TYPE_SILOS = 8 | 28 |
| Sushka | 281–284 | TYPE_SUSHKA = 9 | 4 |
| ReceivingPit | 305–306 | TYPE_RECEIVING_PIT = 6 | 2 |
| Separator | 311–313 | TYPE_SEPARATOR = 7 | 3 |
| Feeder | 314–316 | TYPE_FEEDER = 10 | 3 |
| Fan | 317–319 | TYPE_FAN = 4 | 3 |

---

## FLTCode — битовая маска (WORD)

| Бит | Маска | Константа | Механизмы |
|-----|-------|-----------|-----------|
| BIT0 | 1 | FLT_BREAKER | все |
| BIT1 | 2 | FLT_OVERFLOW | Redler, Noria |
| BIT2 | 4 | FLT_NO_RUNFB | Redler, Noria |
| BIT3 | 8 | FLT_ALINGMENT | Noria |
| BIT4 | 16 | FLT_NO_FEEDBACK | Redler, Noria, Fan, Sep, Feeder |
| BIT5 | 32 | FLT_GATE_MOVE_TIMEOUT | Gate2P |
| BIT6 | 64 | FLT_GATE_POS_UNKNOWN | Gate2P |
| BIT7 | 128 | FLT_BOTH_SENSORS | Gate2P |
| BIT8 | 256 | FLT_STOP_TIMEOUT | Redler, Noria, Fan, Sep, Feeder |
| BIT9 | 512 | FLT_VALVE_MOVE_TIMEOUT | Valve3P |
| BIT10 | 1024 | FLT_VALVE_POS_UNKNOWN | Valve3P |
| BIT11 | 2048 | FLT_VALVE_MULTIPLE_POS | Valve3P |
| BIT12 | 4096 | FLT_INTERLOCK | резерв |
| BIT13 | 8192 | FLT_HIGH_LEVEL | Silos |

---

## Force_Code — битовая маска (INT)

| Бит | Маска | Форсирует |
|-----|-------|-----------|
| BIT0 | 1 | FLT_BREAKER |
| BIT1 | 2 | FLT_OVERFLOW |
| BIT2 | 4 | FLT_NO_RUNFB |
| BIT3 | 8 | FLT_ALINGMENT |
| BIT4 | 16 | FLT_GATE/VALVE_MOVE_TIMEOUT |
| BIT5 | 32 | FLT_GATE/VALVE_POS_UNKNOWN |
| BIT6 | 64 | FLT_STOP_TIMEOUT |
| BIT8 | 256 | FLT_NO_FEEDBACK |
| BIT9 | 512 | FLT_HIGH_LEVEL (Silos) |
| BIT10 | 1024 | forceGrainType (Silos — пропустить проверку зерна) |

---

## Минимальный интервал перезапуска

| Константа | Значение |
|-----------|----------|
| TimeoutMs_Redler_MinRestart | 3000 мс |
| TimeoutMs_Noria_MinRestart | 3000 мс |
| TimeoutMs_Fan_MinRestart | 5000 мс |
| TimeoutMs_Separator_MinRestart | 3000 мс |
| TimeoutMs_Feeder_MinRestart | 3000 мс |

---

## RS_ResultCode — битовая маска (WORD)

| Бит | Маска | Константа |
|-----|-------|-----------|
| BIT0 | 1 | ROUTE_REJ_BY_SAFETY |
| BIT1 | 2 | ROUTE_REJ_BY_OWNER |
| BIT2 | 4 | ROUTE_REJ_BY_CONTRACT |
| BIT3 | 8 | ROUTE_REJ_NOT_READY |
| BIT4 | 16 | ROUTE_REJ_DUPLICATE_START |
| BIT5 | 32 | ROUTE_REJ_GRAIN_NOT_SET |
| BIT6 | 64 | ROUTE_REJ_GRAIN_MISMATCH |
| BIT8 | 256 | ROUTE_ABRT_BY_OPERATOR |
| BIT9 | 512 | ROUTE_ABRT_BY_SAFETY |
| BIT10 | 1024 | ROUTE_ABRT_BY_LOCAL |
| BIT11 | 2048 | ROUTE_ABRT_BY_FAULT |
| BIT12 | 4096 | ROUTE_ABRT_BY_OWNER |
| BIT13 | 8192 | ROUTE_ABRT_STARTING_FAILED |
| BIT15 | 32768 | ROUTE_OK_RUNNING |

---

## RS_State — состояния маршрута (UINT)

| Значение | Константа |
|----------|-----------|
| 0 | ROUTE_STS_IDLE |
| 1 | ROUTE_STS_VALIDATING |
| 2 | ROUTE_STS_STARTING |
| 4 | ROUTE_STS_RUNNING |
| 5 | ROUTE_STS_STOPPING |
| 7 | ROUTE_STS_REJECTED |
| 8 | ROUTE_STS_ABORTED |

---

## GrainType логика (FC_RouteFSM v4.5)

- Силос в маршруте и GrainType=0 → ROUTE_REJ_GRAIN_NOT_SET
- Яма в маршруте и GrainType=0 → ROUTE_REJ_GRAIN_NOT_SET
- Силос и яма, типы не совпадают → ROUTE_REJ_GRAIN_MISMATCH
- Силос Force_Code BIT10(1024) → пропустить проверку зерна
- Только силос с GrainType≠0 → OK
- Нет ни силоса ни ямы → OK

---

## DB_Mechs — VAR RETAIN

Следующие массивы помечены как RETAIN (сохраняются при потере питания):
- Redler, Noria, Fan, Separator, Feeder, Silos, ReceivingPit

Обычные VAR (сбрасываются):
- Mechs, Gate2P, Valve3P, Sushka

---

## FC_Sushka_1B v0.8 — сушилка с 1 горелкой

- 7 вентиляторов (UDT_Sushka_Fan) — пошаговый запуск/остановка
- 1 горелка (UDT_Sushka_Burner) — шаг 8
- FLTCode: DWord (27 бит)
- Биты 0-6: Breaker вентиляторов, 7-13: Feedback вентиляторов
- Биты 14-15: Breaker горелок, 16-17: Feedback горелок
- Биты 18-19: Temp горелок, 20-21: Alarm горелок, 22-23: Auto горелок
- Бит 24: Discharge Feedback, 25: Level High, 26: Level Low
- Управление выгрузкой: PWM на базе DischargePercent (0-100%)
- LastStopMs для каждого вентилятора (мининтервал 5000 мс)

---

## SCADA Scripts

### DB_Helper.js
- `routeBuffer`, `variantList` — буферы данных
- `RunQueryAndCache(startId, endId, midId)` — запрос маршрута из SQL
- `GetVariantFromBuffer(variantId)` — шаги варианта
- `GetActiveRouteData(vId)` — данные для покраски механизмов
- `resetMechanism(obj)` — сброс цвета SVG

### Main.js
- `Apply_OnTapped` — запись маршрута в PLC:
  - Ищет свободный слот (ResultCode_Route1..4 != 32768)
  - HDR_RouteId = routeIdx (1-4), не SQL VariantId
  - RC_Cmd = 1 (RT_CMD_START)
- `Button_9_OnTapped` — остановка маршрута:
  - Читает RouteID тег (устанавливается оператором)
  - RC_Cmd = 2 (RT_CMD_STOP_OP)
- `Btn_OpenList_OnTapped` — запрос маршрутов из SQL
- `Circle_5_BackColor_OnPropertyChanged` — покраска механизмов на мнемосхеме

### ⚠️ Известная проблема
При остановке маршрута Button_9 пишет весь CMD_Route (включая RC_Steps от последнего запущенного маршрута) в RouteExecutor нужного слота, перезаписывая оригинальные шаги. Нужно исправить FC_Route_Supervisor: при STOP_OP копировать только RC_Cmd, не трогать шаги.

---

## SQL Базы данных

### ElevatorRouting (JsonToSQL.py)
- FindRoute — поиск маршрута, убирает только подряд идущие повторы механизмов (LAG)

### RunTime (CreateRunTimeDB.py)
- Моточасы для 60 механизмов

---

## Незавершённое

- FC_Route_Supervisor: при STOP_OP копирует весь CMD_Route включая чужие шаги → нужно копировать только RC_Cmd
- FB_Test_*.scl — тесты используют старую логику FLTCode (= вместо AND)
- Реверсивный редлер — отложено
