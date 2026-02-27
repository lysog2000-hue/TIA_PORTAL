# Код-генератор PLC — документація

**Версія:** 3.0  
**Дата:** 2026-01-14  
**Мова:** Python 3.8+

---

## 📋 Зміст

1. [Огляд](#1-огляд)
2. [Встановлення](#2-встановлення)
3. [Вхідні дані](#3-вхідні-дані)
4. [Вихідні файли](#4-вихідні-файли)
5. [Структура конфігурації](#5-структура-конфігурації)
6. [Валідація](#6-валідація)
7. [Приклад використання](#7-приклад-використання)

---

## 1. Огляд

Генератор `generate_plc_config.py` автоматизує створення PLC-коду для системи механізмів елеватора на основі конфігураційного Excel-файлу.

### 1.1 Що генерує

| Файл | Опис |
|------|------|
| `DB_Mechs.scl` | Масиви механізмів (UDT arrays) |
| `FC_InitMechs.scl` | Ініціалізація мапінгу слот → тип/індекс |
| `FC_DeviceRunner.scl` | Циклічний виклик функцій механізмів |
| `FC_HAL_Read.scl` | Читання входів (символьні імена) |
| `FC_HAL_Write.scl` | Запис виходів (символьні імена) |
| `PLC_Tags.xlsx` | Таблиця тегів для імпорту в TIA Portal |

### 1.2 Архітектура

```
┌─────────────────────┐
│ elevator_config.xlsx│
│  - CONFIG           │
│  - REDLERS          │
│  - NORIAS           │
│  - GATES            │
│  - FANS             │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ generate_plc_config │
│  PLCCodeGenerator   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  generated/                             │
│  ├── DB_Mechs.scl                       │
│  ├── FC_InitMechs.scl                   │
│  ├── FC_DeviceRunner.scl                │
│  ├── FC_HAL_Read.scl                    │
│  ├── FC_HAL_Write.scl                   │
│  └── PLC_Tags.xlsx                      │
└─────────────────────────────────────────┘
```

---

## 2. Встановлення

### 2.1 Вимоги

- Python 3.8 або вище
- pip

### 2.2 Встановлення залежностей

```bash
cd db_gen
pip install pandas openpyxl
```

### 2.3 Запуск

```bash
python generate_plc_config.py
```

---

## 3. Вхідні дані

### 3.1 Excel файл `elevator_config.xlsx`

Файл має містити наступні аркуші:

| Аркуш | Опис |
|-------|------|
| `CONFIG` | Загальна конфігурація проекту |
| `REDLERS` | Конфігурація редлерів |
| `NORIAS` | Конфігурація норій |
| `GATES` | Конфігурація засувок |
| `FANS` | Конфігурація вентиляторів |

### 3.2 Аркуш CONFIG

| Параметр | Опис | Приклад |
|----------|------|---------|
| `ProjectName` | Назва проекту | `Elevator_Main` |
| `Author` | Автор | `AutoGen` |
| `Version` | Версія | `1.0.0` |
| `PLC_Type` | Тип PLC | `S7-1200` |

### 3.3 Аркуші механізмів

Кожен аркуш містить стовпці:

#### Спільні стовпці

| Стовпець | Тип | Опис |
|----------|-----|------|
| `Enabled` | BOOL | `TRUE` = механізм активний |
| `Slot` | INT | Фізичний слот (0..255) |
| `Name` | STRING | Назва механізму |
| `Location` | STRING | Розташування |
| `TypedIdx` | INT | Індекс у масиві типу (0..N-1) |

#### I/O стовпці (залежать від типу)

| Тип | DI стовпці | DO стовпці |
|-----|------------|------------|
| **Redler** | `DI_Speed`, `DI_Breaker`, `DI_Overflow` | `DO_Run` |
| **Noria** | `DI_Speed`, `DI_Breaker`, `DI_UpperLevel`, `DI_LowerLevel` | `DO_Run` |
| **Gate** | `DI_Opened`, `DI_Closed` | `DO_Open`, `DO_Close` |
| **Fan** | `DI_Breaker` | `DO_Run` |

**Значення I/O:** адреси у форматі `%I0.0` / `%Q0.0` або символьні імена.

---

## 4. Вихідні файли

### 4.1 DB_Mechs.scl

Визначає масиви механізмів:

```scl
DATA_BLOCK "DB_Mechs"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

VAR
    Mechs : ARRAY [0..255] OF "UDT_BaseMechanism";
    Redler : ARRAY [0..3] OF "UDT_Redler";
    Noria : ARRAY [0..2] OF "UDT_Noria";
    Gate : ARRAY [0..5] OF "UDT_Gate2P";
    Fan : ARRAY [0..2] OF "UDT_Fan";
END_VAR

BEGIN
END_DATA_BLOCK
```

### 4.2 FC_InitMechs.scl

Ініціалізує мапінг слот → тип/індекс:

```scl
FUNCTION "FC_InitMechs" : VOID
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

BEGIN
    // Ініціалізація всіх слотів у TYPE_NONE
    FOR i := 0 TO 255 DO
        "DB_Mechs".Mechs[i].DeviceType := "DB_Const".TYPE_NONE;
        "DB_Mechs".Mechs[i].TypedIndex := UINT#16#FFFF;
    END_FOR;

    // REDLERS
    "DB_Mechs".Mechs[0].DeviceType := "DB_Const".TYPE_REDLER;
    "DB_Mechs".Mechs[0].TypedIndex := 0;
    
    "DB_Mechs".Mechs[1].DeviceType := "DB_Const".TYPE_REDLER;
    "DB_Mechs".Mechs[1].TypedIndex := 1;

    // NORIAS
    "DB_Mechs".Mechs[50].DeviceType := "DB_Const".TYPE_NORIA;
    "DB_Mechs".Mechs[50].TypedIndex := 0;
    
    // ... інші механізми
END_FUNCTION
```

### 4.3 FC_DeviceRunner.scl

Викликає функції механізмів у циклі:

```scl
FUNCTION "FC_DeviceRunner" : VOID
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

BEGIN
    // REDLERS (slot 0..10)
    FOR slot := 0 TO 10 DO
        IF Mechs[slot].DeviceType = "DB_Const".TYPE_REDLER THEN
            idx := Mechs[slot].TypedIndex;
            "FC_Redler"(R := Redler[idx], B := Mechs[slot]);
        END_IF;
    END_FOR;

    // NORIAS (slot 50..60)
    FOR slot := 50 TO 60 DO
        IF Mechs[slot].DeviceType = "DB_Const".TYPE_NORIA THEN
            idx := Mechs[slot].TypedIndex;
            "FC_Noria"(N := Noria[idx], B := Mechs[slot]);
        END_IF;
    END_FOR;
    
    // ... інші механізми
END_FUNCTION
```

### 4.4 FC_HAL_Read.scl

Читає фізичні входи у структури механізмів:

```scl
FUNCTION "FC_HAL_Read" : VOID
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

BEGIN
    // REDLER 1 (Slot 0, Location: Галерея 1)
    Redler[0].DI_Speed_OK    := "Redler_1_DI_Speed";
    Redler[0].DI_Breaker_OK  := "Redler_1_DI_Breaker";
    Redler[0].DI_Overflow_OK := "Redler_1_DI_Overflow";

    // NORIA 1 (Slot 50, Location: Робоча башта)
    Noria[0].DI_Speed_OK      := "Noria_1_DI_Speed";
    Noria[0].DI_Breaker_OK    := "Noria_1_DI_Breaker";
    Noria[0].DI_UpperLevel_OK := "Noria_1_DI_UpperLevel";
    Noria[0].DI_LowerLevel_OK := "Noria_1_DI_LowerLevel";
    
    // ... інші механізми
END_FUNCTION
```

### 4.5 FC_HAL_Write.scl

Записує виходи механізмів у фізичні адреси:

```scl
FUNCTION "FC_HAL_Write" : VOID
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

BEGIN
    // REDLER 1 (Slot 0, Location: Галерея 1)
    "Redler_1_DO_Run" := Redler[0].DO_Run;

    // NORIA 1 (Slot 50, Location: Робоча башта)
    "Noria_1_DO_Run" := Noria[0].DO_Run;
    
    // ... інші механізми
END_FUNCTION
```

### 4.6 PLC_Tags.xlsx

Таблиця тегів для імпорту в TIA Portal.

**Формат:**

| Name | Path | Data Type | Logical Address | Comment | Hmi Visible | Hmi Accessible | Hmi Writeable |
|------|------|-----------|-----------------|---------|-------------|----------------|---------------|
| `Redler_1_DI_Speed` | `IO_tags` | `Bool` | `%I0.0` | Редлер 1 - Тахо-датчик (Галерея 1) | `True` | `True` | `True` |
| `Redler_1_DO_Run` | `IO_tags` | `Bool` | `%Q0.0` | Редлер 1 - Контактор пуску (Галерея 1) | `True` | `True` | `True` |

**Імпорт у TIA Portal:**

1. Відкрити TIA Portal
2. Project tree → PLC tags → Import tags
3. Обрати `PLC_Tags.xlsx`
4. Підтвердити імпорт

---

## 5. Структура конфігурації

### 5.1 Приклад CONFIG

| Parameter | Value |
|-----------|-------|
| `ProjectName` | `Elevator_Main` |
| `Author` | `Automation Team` |
| `Version` | `2.0.0` |
| `PLC_Type` | `S7-1200` |

### 5.2 Приклад REDLERS

| Enabled | Slot | Name | Location | TypedIdx | DI_Speed | DI_Breaker | DI_Overflow | DO_Run |
|---------|------|------|----------|----------|----------|------------|-------------|--------|
| `TRUE` | 0 | `Редлер 1` | `Галерея 1` | 0 | `%I0.0` | `%I0.1` | `%I0.2` | `%Q0.0` |
| `TRUE` | 1 | `Редлер 2` | `Галерея 2` | 1 | `%I0.3` | `%I0.4` | `%I0.5` | `%Q0.1` |
| `FALSE` | 2 | `Редлер 3` | `Галерея 3` | 2 | — | — | — | — |

### 5.3 Приклад NORIAS

| Enabled | Slot | Name | Location | TypedIdx | DI_Speed | DI_Breaker | DI_UpperLevel | DI_LowerLevel | DO_Run |
|---------|------|------|----------|----------|----------|------------|---------------|---------------|--------|
| `TRUE` | 50 | `Норія 1` | `Робоча башта` | 0 | `%I1.0` | `%I1.1` | `%I1.2` | `%I1.3` | `%Q1.0` |
| `TRUE` | 51 | `Норія 2` | `Підбій` | 1 | `%I1.4` | `%I1.5` | `%I1.6` | `%I1.7` | `%Q1.1` |

### 5.4 Приклад GATES

| Enabled | Slot | Name | Location | TypedIdx | DI_Opened | DI_Closed | DO_Open | DO_Close |
|---------|------|------|----------|----------|-----------|-----------|---------|----------|
| `TRUE` | 100 | `Засувка 1` | `Перехід 1` | 0 | `%I2.0` | `%I2.1` | `%Q2.0` | `%Q2.1` |
| `TRUE` | 101 | `Засувка 2` | `Перехід 2` | 1 | `%I2.2` | `%I2.3` | `%Q2.2` | `%Q2.3` |

### 5.5 Приклад FANS

| Enabled | Slot | Name | Location | TypedIdx | DI_Breaker | DO_Run |
|---------|------|------|----------|----------|------------|--------|
| `TRUE` | 150 | `Вентилятор 1` | `Аспірація 1` | 0 | `%I3.0` | `%Q3.0` |
| `TRUE` | 151 | `Вентилятор 2` | `Аспірація 2` | 1 | `%I3.1` | `%Q3.1` |

---

## 6. Валідація

Генератор виконує наступні перевірки:

### 6.1 Унікальність Slot

```
❌ Дублікати slot: [0, 5, 10]
```

Кожен слот має бути унікальним серед усіх механізмів.

### 6.2 Унікальність TypedIdx

```
❌ Дублікати TypedIdx у Редлери
```

Індекс у межах типу має бути унікальним.

### 6.3 Конфлікт I/O адрес

```
❌ Конфлікт I/O: %I0.0 використовується у 'Редлер 1' та 'Редлер 2'
```

Кожна I/O адреса має використовуватися тільки один раз.

### 6.4 Перевірка наявності аркушів

Якщо аркуш відсутній — генератор продовжує роботу з порожнім списком механізмів цього типу.

---

## 7. Приклад використання

### 7.1 Підготовка конфігурації

1. Створити `elevator_config.xlsx` за зразком
2. Заповнити аркуші механізмами
3. Зберегти файл

### 7.2 Генерація

```bash
cd db_gen
python generate_plc_config.py
```

**Вивід:**

```
📖 Завантаження elevator_config.xlsx...
✅ Завантажено:
   - Редлерів: 4
   - Норій: 2
   - Засувок: 6
   - Вентиляторів: 3
✅ Валідація пройдена

📝 Генерація файлів у ./generated...
✅ DB_Mechs.scl
✅ FC_InitMechs.scl
✅ FC_DeviceRunner.scl
✅ FC_HAL_Read.scl
✅ FC_HAL_Write.scl
✅ PLC_Tags.xlsx

🎉 Генерацію завершено!
```

### 7.3 Імпорт у TIA Portal

1. Скопіювати `.scl` файли у проект TIA Portal
2. Імпортувати `PLC_Tags.xlsx` як таблицю тегів
3. Скомпілювати проект

### 7.4 Оновлення конфігурації

При зміні конфігурації:

1. Оновити `elevator_config.xlsx`
2. Запустити генератор знову
3. Замінити файли у TIA Portal
4. Скомпілювати повторно

---

## 8. Розширення

### 8.1 Додавання нового типу механізму

1. Додати аркуш у `elevator_config.xlsx` (напр., `CONVEYORS`)
2. Додати обробку у `generate_plc_config.py`:
   - Завантаження з Excel
   - Валідація
   - Генерація `FC_HAL_Read` / `FC_HAL_Write`
   - Додавання у `FC_DeviceRunner`
3. Додати UDT/FC для нового типу у `Mechs/`

### 8.2 Додавання нових I/O сигналів

1. Додати стовпець у аркуш механізму
2. Оновити `_add_tag()` для генерації тега
3. Оновити `FC_HAL_Read` / `FC_HAL_Write` шаблони

---

## 9. Структура класу PLCCodeGenerator

```python
class PLCCodeGenerator:
    """Генератор PLC коду з Excel конфігурації"""

    def __init__(self, excel_path: str):
        # Ініціалізація шляху та змінних

    def load_excel(self):
        # Завантажити всі аркуші з Excel

    def validate_excel(self):
        # Валідація конфігурації

    def build_tags_table(self):
        # Побудувати таблицю тегів з усіх механізмів

    def generate_plc_tags_excel(self) -> pd.DataFrame:
        # Генерація Excel файлу з таблицею тегів

    def generate_db_mechs(self) -> str:
        # Генерація DB_Mechs.scl

    def generate_fc_init_mechs(self) -> str:
        # Генерація FC_InitMechs.scl

    def generate_fc_device_runner(self) -> str:
        # Генерація FC_DeviceRunner.scl

    def generate_fc_hal_read(self) -> str:
        # Генерація FC_HAL_Read.scl

    def generate_fc_hal_write(self) -> str:
        # Генерація FC_HAL_Write.scl

    def generate_all(self, output_dir: str = "./generated"):
        # Генерувати всі файли
```

---

## 10. Файли проекту

```
db_gen/
├── generate_plc_config.py      # Головний скрипт генератора
├── elevator_config.xlsx        # Конфігураційний файл
└── generated/                  # Вихідні файли
    ├── DB_Mechs.scl
    ├── FC_InitMechs.scl
    ├── FC_DeviceRunner.scl
    ├── FC_HAL_Read.scl
    ├── FC_HAL_Write.scl
    └── PLC_Tags.xlsx
```

---

**Кінець документа**
