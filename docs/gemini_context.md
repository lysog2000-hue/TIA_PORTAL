# Gemini Project Map — Элеватор (TIA Portal v19)

## 🏗 Архитектура и Правила (Canon)
### Core & Control
- **Разделение ответственности**: SCADA отвечает за процессы (что и когда), PLC — за детерминированное выполнение и безопасность.
- **Приоритеты Ownership**: `LocalManual` (шкаф) > `OWNER_LOCAL` > `OWNER_SCADA` / `OWNER_ROUTE`. Захват возможен только в `IDLE` или `FAULT`.
- **Мета-команды**: `CMD_SET_OWNER_SCADA` (захват без действия) и `CMD_RELEASE_OWNER` (освобождение).

### Мониторинг и Защита
- **Faults**: Битовая маска `FLTCode` (WORD). Любой бит != 0 — это авария, приводящая к `ABORT` маршрута.
- **Force_Code**: Игнорирование защит для наладки (BIT0-Breaker, BIT4-MoveTimeout, BIT8-Feedback).
- **Restart**: Защита от частого пуска через `LastStopMs` (5с для вентиляторов, 3с для прочих).

### Система маршрутов (Routes)
- **Mailbox**: Квитирование через `HDR_Commit` / `Ack_CommitApplied`. 12 параллельных маршрутов.
- **FSM v4.0**: Состояния `IDLE` -> `VALIDATING` -> `STARTING` -> `RUNNING` -> `STOPPING`.
- **Reject vs Abort**:
  - `REJECT`: Ошибка при валидации, без побочных эффектов, механизмы не захвачены.
  - `ABORT`: Прерывание активного маршрута, механизмы останавливаются и освобождаются.
- **Safety**: `GlobalSafetyStop` останавливает все механизмы немедленно и сбрасывает владение.

### Интеграция с SQL
- **FindRoute**: Хранимая процедура для поиска путей по ID портов.
- **vw_RunTimeHours**: Представление для учета наработки оборудования.

## 🌪 Зерносушилка (Sushka)
### Структура данных (`UDT_Sushka` v0.4)
- **Fans [1..7]**: Индивидуальные статусы, фидбеки и `LastStopMs`.
- **Burners [1..2]**: Авто-режим, контроль пламени, управление мощностью (`AQ_Power`).
- **Discharge**: Выгрузка с расчетом `Status` (Idle/Running/Fault) в PLC.
- **Temps [1..16]**: Массив температур из `PLCTags.csv`.

### Логика управления (`FC_Sushka`)
- **Пуск (Starting)**: Последовательный запуск Fans(1-7) -> Burners(1-2) с задержкой 3с.
- **Работа (Running)**: Burners на 50% мощности, разрешена выгрузка.
- **Останов (Stopping)**: Обратный порядок. Мощность горелок 20% -> Выключение Burners -> Выключение Fans(7-1).
- **Безопасность**: 
  - Горелки не включаются без режима AUTO.
  - Минимальный интервал отдыха для вентиляторов (5000мс).
  - При любой аварии — мгновенный стоп всех узлов.
  - Блокировка: Горелки работают только в режиме `AUTO` и при наличии воздуха.

## 📂 Карта путей
| Тип файла | Путь в репозитории |
|-----------|--------------------|
| **UDTs**  | `Mechs/Udts/UDT_*.scl` |
| **Логика**| `Mechs/FC_*.scl` |
| **Ядро**  | `Core/FC_ArbiterMech.scl`, `Core/FC_DeviceRunner.scl` |
| **Маршруты**| `Routes/FC_RouteFSM.scl`, `Routes/FC_Route_Supervisor.scl` |
| **Симуляция**| `Mech_Simulate/FC_Sim*.scl` |
| **SCADA** | `SCADA_Scripts/DB_Helper/*.js` |
| **Теги**  | `PLCTags.csv`, `Constant.csv` |

## 🎨 SCADA (WinCC Unified)
### Статусы механизмов
- **0 (Idle)**: `#808080` (Серый)
- **1 (Starting)**: `#99CC00` (Салатовый)
- **2 (Running)**: `#00FF00` (Зеленый)
- **3 (Stopping)**: `#00FFFF` (Циан)
- **4 (Fault)**: `#FF0000` (Красный)

### Обращение к Faceplate
- Использовать Property Interface (например, `Sushka`).
- Синтаксис: `Sushka.Fans[1].Status` или `Sushka.Discharge.DI_Feedback_OK`.

## 🛠 Инструментарий
- **Python Generator**: `generate_plc_config.py` — генерация HAL и конфига из Excel.
- **JS Generators**: `generate_StartPortId.py` — обновление маппинга имен для SCADA.
- **Check Tool**: `check_full.py` — валидация констант и тегов между CSV и SCL.

---
*Этот файл обновляется Gemini при значительных изменениях в архитектуре.*