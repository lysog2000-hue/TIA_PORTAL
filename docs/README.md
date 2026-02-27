# Документація проекту Elevator Automation

**Версія:** 1.0  
**Дата:** 2026-02-27

---

## 📚 Навігатор по документації

### Основна документація

| # | Файл | Опис |
|---|------|------|
| 1 | [`design_rules_scada_plc_route_canon.md`](design_rules_scada_plc_route_canon.md) | Правила проєктування SCADA ↔ PLC |
| 2 | [`force_bits_and_faults.md`](force_bits_and_faults.md) | Форсування захистів, FLTCode таблиці |
| 3 | [`mechanism_architecture.md`](mechanism_architecture.md) | Система керування механізмами |
| 4 | [`route_system_architecture.md`](route_system_architecture.md) | Система маршрутів (простою мовою) |
| 5 | [`manual_control.md`](manual_control.md) | Ручний режим керування механізмами |
| 6 | [`code_generator.md`](code_generator.md) | Генерація коду з Excel |

### Повна специфікація

| Файл | Опис |
|------|------|
| [`../Routes/ROUTE_SYSTEM.md`](../Routes/ROUTE_SYSTEM.md) | Система маршрутів — детальна документація |

---

## 📋 Опис документів

### 1. Design Rules — SCADA ↔ PLC Route Canon

**[`design_rules_scada_plc_route_canon.md`](design_rules_scada_plc_route_canon.md)**

"Залізобетонні" правила архітектури:
- Розподіл відповідальності SCADA / PLC
- Route FSM без PAUSE
- ABORT = "все вільно"
- Fault завжди аварія
- VALIDATING гарантує готовність
- REJECT ≠ ABORT

**Для кого:** Архітектори, розробники SCADA та PLC

---

### 2. Force Bits and Faults

**[`force_bits_and_faults.md`](force_bits_and_faults.md)**

Таблиці форсування та аварій:
- Єдина таблиця Force_Code бітів
- Єдина таблиця FLTCode
- Позиційні константи Gate2P

**Для кого:** Розробники PLC, налагоджувачі

---

### 3. Архітектура системи механізмів

**[`mechanism_architecture.md`](mechanism_architecture.md)**

Система керування механізмами:
- Базова структура `UDT_BaseMechanism` (спільні поля для всіх)
- Типи механізмів (Redler, Noria, Fan, Gate2P)
- Арбітраж керування (хто має право керувати)
- Стани, команди, аварії
- Форсування захистів

**Для кого:** Розробники PLC, інженери АСУ ТП

---

### 4. Архітектура системи маршрутів

**[`route_system_architecture.md`](route_system_architecture.md)**

Система автоматичного виконання маршрутів простою мовою:
- Як працює система (SCADA → PLC → механізми)
- Команди та статуси
- Стани маршруту (IDLE/VALIDATING/RUNNING/STOPPING)
- Безпека та аварії
- Приклад маршруту з поясненням

**Для кого:** Інженери АСУ ТП, налагоджувачі, оператори

---

### 5. Ручний режим керування

**[`manual_control.md`](manual_control.md)**

Ручне керування механізмами повз маршрути:
- Власники (Owner) — хто має право керувати
- Як взяти механізм під керування (алгоритм)
- Команди ручного керування (START, STOP, RESET)
- Приклади: запуск редлера, скидання аварії, засувка
- Конфліктні ситуації (Route vs SCADA)
- LocalManual — локальний режим на шафі

**Для кого:** Оператори, налагоджувачі, інженери АСУ ТП

---

### 6. Code Generator

**[`code_generator.md`](code_generator.md)**

Python-генератор коду з Excel:
- Встановлення та запуск
- Вхідні/вихідні файли
- Структура конфігурації
- Валідація даних
- Приклад використання

**Для кого:** Розробники, DevOps

---

### 7. Route System — повна специфікація

**[`../Routes/ROUTE_SYSTEM.md`](../Routes/ROUTE_SYSTEM.md)**

Детальна технічна документація:
- Діаграми переходів станів
- Приклади сценаріїв взаємодії
- Таблиці констант та кодів
- Алгоритми виконання кроків

**Для кого:** Розробники PLC, інтегратори

---

## 🗂️ Структура папки docs

```
docs/
├── README.md                           # Цей файл — навігатор
├── design_rules_scada_plc_route_canon.md  # Правила проєктування
├── force_bits_and_faults.md            # Force bits таблиці
├── mechanism_architecture.md           # Система механізмів
├── route_system_architecture.md        # Система маршрутів
├── manual_control.md                   # Ручний режим керування
└── code_generator.md                   # Генерація коду
```

---

## 🔗 Посилання на розділи проекту

| Розділ | Файл | Опис |
|--------|------|------|
| **Головна** | [`../README.md`](../README.md) | Загальний опис проекту |
| **Маршрути** | [`../Routes/`](../Routes/) | Система маршрутів (код + документація) |
| **Механізми** | [`../Mechs/`](../Mechs/) | Бібліотека механізмів |
| **Генератор** | [`../db_gen/`](../db_gen/) | Python-генератор коду |
| **Симуляція** | [`../Mech_Simulate/`](../Mech_Simulate/) | Симулятори механізмів |
| **Ядро** | [`../Core/`](../Core/) | Базові функції арбітражу |

---

## 📖 Як читати документацію

### Для нових розробників

1. **Почати з** [`../README.md`](../README.md) — загальний огляд
2. **Прочитати** [`design_rules_scada_plc_route_canon.md`](design_rules_scada_plc_route_canon.md) — принципи архітектури
3. **Вивчити** [`mechanism_architecture.md`](mechanism_architecture.md) — базові компоненти
4. **Переглянути** [`route_system_architecture.md`](route_system_architecture.md) — система маршрутів

### Для розробників SCADA

1. [`design_rules_scada_plc_route_canon.md`](design_rules_scada_plc_route_canon.md) — правила взаємодії
2. [`route_system_architecture.md`](route_system_architecture.md) — протокол маршрутів
3. [`../Routes/ROUTE_SYSTEM.md`](../Routes/ROUTE_SYSTEM.md) — повна специфікація

### Для розробників PLC

1. [`mechanism_architecture.md`](mechanism_architecture.md) — механізми (ООП)
2. [`route_system_architecture.md`](route_system_architecture.md) — маршрути
3. [`force_bits_and_faults.md`](force_bits_and_faults.md) — аварії та форсування
4. [`code_generator.md`](code_generator.md) — генерація коду

### Для налагоджувачів

1. [`force_bits_and_faults.md`](force_bits_and_faults.md) — таблиці FLTCode та Force_Code
2. [`mechanism_architecture.md`](mechanism_architecture.md) — стани та команди
3. [`../Routes/ROUTE_SYSTEM.md`](../Routes/ROUTE_SYSTEM.md) — коди помилок маршрутів

---

*Документація в розробці*
