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
├── Startup.scl               — OB инициализации v0.2 (сброс всех HAL + таймингов)
├── Constant.csv              — все константы проекта (импорт в TIA)
├── Mechs.csv / Mechs.xlsx    — конфигурация механизмов
├── graph.json                — граф устройств (186 устройств, источник для генераторов)
├── generate_all_alarms.py    — генератор HMIAlarms_All.xlsx из graph.json
├── JsonToSQL.py              — создание БД ElevatorRouting из graph.json
├── CreateRunTimeDB.py        — создание БД RunTime для моточасов
├── RuntimeLogger.js          — JS скрипт SCADA: запись статусов механизмов в RunTime
├── Core/
│   ├── FC_ArbiterMech.scl    — арбитраж владельца механизма
│   ├── FC_DeviceRunner.scl   — диспетчер: цикл по слотам, вызов FC по DeviceType
│   └── FC_TimeElapsedMs.scl  — таймер на TIME_TCK()
├── Mechs/
│   ├── Udts/                 — UDT структуры каждого типа
│   ├── FC_Redler.scl         — v0.5
│   ├── FC_Noria.scl          — v0.4
│   ├── FC_Fan.scl            — v1.3
│   ├── FC_Gate2P.scl
│   ├── FC_Feeder.scl         — v0.2
│   ├── FC_Separator.scl      — v0.2
│   ├── FC_Valve3P.scl
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
│   ├── FC_SimRedler.scl      — v2.1 (DI_Feedback_OK + SimFault_Feedback)
│   ├── FC_SimNoria.scl       — v2.2 (DI_Feedback_OK + SimFault_Feedback)
│   ├── FC_SimFan.scl         — v2.1 (SimFault_Feedback)
│   ├── FC_SimGate2P.scl
│   ├── FC_SimSeparator.scl
│   ├── FC_SimFeeder.scl
│   └── UDT_Sim*.scl
├── SCADA_Scripts/
│   └── DB_Helper/
│       ├── GlobalDefinitions.js  — глобальные переменные и функции маршрутов
│       └── Main.js               — обработчики кнопок SCADA
├── FB_Test_Redler.scl        — v0.2, 18 кейсов
├── FB_Test_Noria.scl         — v0.2, 19 кейсов
├── FB_Test_Fan.scl           — v0.2, 14 кейсов
├── FB_Test_Gate2P.scl
├── FB_Test_Separator.scl
├── FB_Test_Valve3P.scl
└── docs/
```

---

## Слоты механизмов (FC_DeviceRunner)

| Тип            | Слоты     | Константа типа         |
|----------------|-----------|------------------------|
| Redler         | 1–39      | TYPE_REDLER = 2        |
| Noria          | 51–62     | TYPE_NORIA = 1         |
| Gate2P         | 116–182   | TYPE_GATE2P = 3        |
| Valve3P        | 201–229   | TYPE_VALVE3P = 5       |
| Silos          | 251–278   | TYPE_SILOS = 8         |
| Sushka         | 281–284   | TYPE_SUSHKA = 9        |
| ReceivingPit   | 305–306   | TYPE_RECEIVING_PIT = 6 |
| Separator      | 311–313   | TYPE_SEPARATOR = 7     |
| Feeder         | 314–316   | TYPE_FEEDER = 10       |
| Fan            | 317–319   | TYPE_FAN = 4           |

---

## Архитектура механизмов

### UDT_BaseMechanism — общие поля
```
SlotId, DeviceType, TypedIndex
Status, FLTCode, Cmd, CmdParam1, LastCmd
OwnerCur, OwnerCurId
Enable_OK, LocalManual
Force_Code : INT  — битовая маска форсирования защит
Status_Param : INT
```

### UDT типизированных механизмов — поля таймингов
| Тип | Поля таймингов |
|-----|----------------|
| Redler | StartMs, SpeedLostMs, FeedbackLostMs, StopMs |
| Noria | StartMs, SpeedLostMs, FeedbackLostMs, StopMs |
| Fan | StartMs, FeedbackLostMs, StopMs |
| Separator | StartMs, FeedbackLostMs, StopMs |
| Feeder | StartMs, FeedbackLostMs, StopMs |

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

## Аварии (FLTCode) и Force_Code биты

| FLTCode константа      | Значение | Force бит | Маска | Механизмы                             |
|------------------------|----------|-----------|-------|---------------------------------------|
| FLT_NONE               | 0        | —         | —     | все                                   |
| FLT_OVERFLOW           | 10       | BIT1      | 2     | Redler, Noria                         |
| FLT_BREAKER            | 11       | BIT0      | 1     | все                                   |
| FLT_NO_RUNFB           | 12       | BIT2      | 4     | Redler, Noria (тахо)                  |
| FLT_NO_FEEDBACK        | 14       | BIT8      | 256   | Redler, Noria, Fan, Separator, Feeder |
| FLT_ALINGMENT          | 15       | BIT3      | 8     | Noria                                 |
| FLT_GATE_MOVE_TIMEOUT  | 16       | BIT4      | 16    | Gate2P                                |
| FLT_GATE_POS_UNKNOWN   | 17       | BIT5      | 32    | Gate2P                                |
| FLT_BOTH_SENSORS       | 18       | не форс.  | —     | Gate2P                                |
| FLT_STOP_TIMEOUT       | 19       | BIT6      | 64    | Redler, Noria, Fan, Separator, Feeder |

---

## Логика переходов состояний

| Механизм  | STARTING→RUNNING    | STOPPING→IDLE        | Таймаут выбега (FLT_STOP_TIMEOUT) |
|-----------|---------------------|----------------------|-----------------------------------|
| Redler    | DI_Speed_OK=TRUE    | DI_Speed_OK=FALSE    | TimeoutMs_Redler_Stop (10000 мс)  |
| Noria     | DI_Speed_OK=TRUE    | DI_Speed_OK=FALSE    | TimeoutMs_Noria_Stop (10000 мс)   |
| Fan       | DI_Feedback_OK=TRUE | DI_Feedback_OK=FALSE | TimeoutMs_Fan_Stop (10000 мс)     |
| Separator | DI_Feedback_OK=TRUE | DI_Feedback_OK=FALSE | TimeoutMs_Separator_Stop (10000 мс)|
| Feeder    | DI_Feedback_OK=TRUE | DI_Feedback_OK=FALSE | TimeoutMs_Feeder_Stop (10000 мс)  |

### RUNNING: дополнительные аварии
| Механизм  | FLT_NO_RUNFB (тахо)                          | FLT_NO_FEEDBACK (контактор)                      |
|-----------|----------------------------------------------|--------------------------------------------------|
| Redler    | DI_Speed_OK потеря + TimeoutMs_Redler_SpeedPause    | DI_Feedback_OK потеря + TimeoutMs_Redler_FeedbackPause |
| Noria     | DI_Speed_OK потеря + TimeoutMs_Noria_SpeedPause     | DI_Feedback_OK потеря + TimeoutMs_Noria_FeedbackPause  |
| Fan       | —                                            | DI_Feedback_OK потеря + TimeoutMs_Fan_FeedbackPause    |
| Separator | —                                            | DI_Feedback_OK потеря + TimeoutMs_Separator_FeedbackPause |
| Feeder    | —                                            | DI_Feedback_OK потеря + TimeoutMs_Feeder_FeedbackPause |

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

**Процедуры:**
- `UpdateMechStatus @MechanismId, @IsRunning` — SCADA вызывает каждые N секунд. Обновляет только при смене состояния. Сама считает наработку.
- `ResetRunTime @MechanismId` — сброс наработки

**Views:**
- `vw_RunTimeHours` — наработка в днях/часах/минутах/секундах
- `vw_EventHistory` — история с именами механизмов

**Логика:**
- SCADA пишет `IsRunning=1` (запуск) или `IsRunning=0` (остановка)
- Процедура сама считает `DATEDIFF` и пишет в `RunTimeSummary` и `EventHistory`
- `StatusLog` всегда 60 строк — не растёт

---

## SCADA Scripts (WinCC Unified JavaScript)

### SCADA_Scripts/DB_Helper/GlobalDefinitions.js
Глобальные переменные и функции для маршрутов:
- `routeBuffer`, `variantList` — буферы данных
- `RunQueryAndCache(startId, endId, midId)` — запрос маршрута из SQL
- `GetActiveRouteData(vId)` — данные активного маршрута
- `GetVariantList()` — список вариантов
- `GetVariantFromBuffer(variantId)` — шаги варианта
- `resetMechanism(obj)` — сброс цвета SVG механизма

### SCADA_Scripts/DB_Helper/Main.js
Обработчики кнопок:
- `Btn_OpenList_OnTapped` — запрос маршрутов из ElevatorRouting, запись в теги таблицы
- `Btn_OpenList_OnUp` — открытие popup экрана Table
- `Circle_5_BackColor_OnPropertyChanged` — покраска механизмов на мнемосхеме
- `Apply_OnTapped` — запись выбранного маршрута в PLC теги
- `Btn_OpenMotoHours_OnTapped` — загрузка моточасов из RunTime в таблицу

### RuntimeLogger.js
Скрипт UAJobScheduler (запускается по таймеру):
- Читает теги `DB_Mechs_Mechs{ID}_Status` для 60 механизмов
- Вызывает `EXEC UpdateMechStatus` для каждого
- DSN=RunTime, HMI_User

### Теги SCADA для таблиц
| Тег | Тип | Назначение |
|-----|-----|------------|
| TableDataString | WString | Данные таблицы маршрутов |
| ColumnStyle | WString | Колонки таблицы маршрутов |
| Moto_TableDataString | WString[5000] | Данные таблицы моточасов |
| Moto_ColumnStyle | WString[500] | Колонки таблицы моточасов |

### Кастомный веб-контрол таблицы
- Tabulator.js в WinCC Unified Custom Web Control
- Свойства: `TableDataString`, `ColumnStyleString`, `SelectedRowIndex`
- Событие: `RowClick`
- `layout: "fitColumns"` — ширины колонок пропорциональные

---

## Симуляторы

Каждый симулятор читает `DO_Run` и пишет DI-сигналы механизма.
Конфиг: `DB_SimConfig.<Type>[idx]`, состояние: `DB_SimMechs.<Type>[idx]`.

### Параметры симуляции аварий по типам

| Параметр конфига              | Redler | Noria | Fan | Separator | Feeder |
|-------------------------------|--------|-------|-----|-----------|--------|
| SimFault_Breaker              | ✅     | ✅    | ✅  | ✅        | ✅     |
| SimFault_Overflow             | ✅     | ✅    | —   | —         | —      |
| SimFault_Alignment            | —      | ✅    | —   | —         | —      |
| SimFault_Feedback             | ✅     | ✅    | ✅  | —         | —      |

> FLT_STOP_TIMEOUT симуляторами не симулируется — это аварийная ситуация реального железа

---

## HMI Аварии (HMIAlarms_All.xlsx)

Генерируется скриптом `generate_all_alarms.py` из `graph.json`.
186 устройств, 604 аварии. Аварии по типам:

| Тип | Биты аварий |
|-----|-------------|
| Redler | BIT0(Breaker), BIT1(Overflow), BIT2(Speed), BIT6(StopTimeout), BIT8(Feedback) |
| Noria | BIT0, BIT1, BIT2, BIT3(Alingment), BIT6(StopTimeout), BIT8(Feedback) |
| Fan | BIT0, BIT6(StopTimeout), BIT8(Feedback) |
| Separator | BIT0, BIT6(StopTimeout), BIT8(Feedback) |
| Feeder | BIT0, BIT6(StopTimeout), BIT8(Feedback) |
| Gate2P | BIT0, BIT4(TimeOut), BIT5(PosUnknown) |
| Valve3P | BIT0, BIT4(TimeOut), BIT5(PosUnknown) |
| Silos | BIT0 |
| Sushka | BIT0 |
| ReceivingPit | BIT0 |

---

## Порядок загрузки в TIA Portal

1. Constant.csv (теги-константы)
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
- Constant.xlsx vs Constant.csv — не синхронизированы (задача в очереди)
- Реверсивный редлер — план есть, реализация отложена
- docs/ — документация помечена "в разработке"
