# Універсальний контракт керування механізмами елеватора

**Версія:** v2.1.1 (With Dynamic Counts)  
**Дата:** 2026-01-29  
**Базується на:** v2.1.0  
**Статус:** ЗАТВЕРДЖЕНО

---

## 📋 Зміст

1. [Терміни та визначення](#1-терміни-та-визначення)
2. [Архітектура системи](#2-архітектура-системи)
3. [Контракт механізму](#3-контракт-механізму)
4. [Команди та стани](#4-команди-та-стани)
5. [Арбітраж та ownership](#5-арбітраж-та-ownership)
6. [Маршрути](#6-маршрути)
7. [Manual Control (ручне керування)](#7-manual-control-ручне-керування-зі-scada)
8. [Safety та інтерлоки](#8-safety-та-інтерлоки)
9. [Fault handling](#9-fault-handling)
10. [Розподіл відповідальності](#10-розподіл-відповідальності)
11. [Політики системи](#11-політики-системи)
12. [Acceptance-кейси](#12-acceptance-кейси)
13. [Гарантії та інваріанти](#13-гарантії-та-інваріанти)
14. [**🆕 Константи кількості механізмів**](#14-константи-кількості-механізмів)

---

## 14. Константи кількості механізмів

### 14.1 Принцип динамічного розміру масивів

**Проблема:**
Раніше розміри масивів були жорстко закодовані у кожному DB:
```scl
// ❌ Старий підхід (hard-coded)
Redler : ARRAY [0..49] OF "UDT_Redler";
Noria  : ARRAY [0..49] OF "UDT_Noria";
```

При зміні кількості механізмів потрібно було:
1. Редагувати DB_Mechs
2. Редагувати всі DB симуляторів
3. Редагувати FC_InitMechs
4. Ризик неузгодженості між різними місцями

**Рішення:**
Всі розміри масивів визначаються через **глобальні константи**:
```scl
// ✅ Новий підхід (dynamic)
Redler : ARRAY [0.."REDLERS_COUNT"] OF "UDT_Redler";
Noria  : ARRAY [0.."NORIAS_COUNT"] OF "UDT_Noria";
```

### 14.2 Набір констант

**DB_Const або окремий DB_Counts:**

```scl
// ==============================================================================
// Константи кількості механізмів
// ==============================================================================
// Редагується ТІЛЬКИ в одному місці
// Автоматично поширюється на всі DB та FC
// ==============================================================================

CONST
    // === Загальна кількість слотів ===
    MECHS_COUNT     : UINT := 255;    // 0..255 (256 слотів загалом)
    
    // === Кількість механізмів по типам ===
    REDLERS_COUNT   : UINT := 49;     // 0..49 (50 редлерів, slot 0..49)
    NORIAS_COUNT    : UINT := 49;     // 0..49 (50 норій, slot 50..99)
    GATES2P_COUNT   : UINT := 49;     // 0..49 (50 засувок, slot 100..149)
    FANS_COUNT      : UINT := 49;     // 0..49 (50 вентиляторів, slot 150..199)
    
    // === Макс. індекс у типізованих масивах ===
    // (для ініціалізації та валідації)
    REDLER_MAX_IDX  : UINT := 49;     // max TypedIndex для редлерів
    NORIA_MAX_IDX   : UINT := 49;     // max TypedIndex для норій
    GATE_MAX_IDX    : UINT := 49;     // max TypedIndex для засувок
    FAN_MAX_IDX     : UINT := 49;     // max TypedIndex для вентиляторів
    
    // === Slot ranges (документація) ===
    // Редлери:     0..49   (50 шт)
    // Норії:      50..99   (50 шт)
    // Засувки:   100..149  (50 шт)
    // Вентилятори: 150..199 (50 шт)
    // Резерв:     200..255  (56 слотів)
END_CONST
```

### 14.3 Використання констант у DB

#### DB_Mechs.scl

```scl
DATA_BLOCK "DB_Mechs"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 2.0

VAR
    // ===================================================================
    // Базова шина механізмів (усі слоти 0..MECHS_COUNT)
    // ===================================================================
    Mechs : ARRAY [0.."MECHS_COUNT"] OF "UDT_BaseMechanism";
    
    // ===================================================================
    // Типізовані масиви (розмір визначається константами)
    // ===================================================================
    Redler : ARRAY [0.."REDLERS_COUNT"] OF "UDT_Redler";
    Noria  : ARRAY [0.."NORIAS_COUNT"] OF "UDT_Noria";
    Gate   : ARRAY [0.."GATES2P_COUNT"] OF "UDT_Gate2P";
    Fan    : ARRAY [0.."FANS_COUNT"] OF "UDT_Fan";
    
END_VAR

BEGIN
END_DATA_BLOCK
```

**Переваги:**
- ✅ Один раз змінив константу → автоматично оновились всі масиви
- ✅ Немає ризику неузгодженості розмірів
- ✅ Зрозуміло, які обмеження системи

#### DB_SimRedlers.scl

```scl
DATA_BLOCK "DB_SimRedlers"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 2.0
NON_RETAIN 

VAR
    // === Масив станів симуляторів ===
    // Індекс відповідає DB_Mechs.Redler[idx]
    State : ARRAY[0.."REDLERS_COUNT"] OF "UDT_SimRedlerState";
END_VAR

BEGIN
END_DATA_BLOCK
```

#### DB_SimRedlersConfig.scl

```scl
DATA_BLOCK "DB_SimRedlersConfig"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 2.0
RETAIN

VAR
    // === Масив конфігурацій ===
    Redler : ARRAY[0.."REDLERS_COUNT"] OF "UDT_SimRedlerConfig";
END_VAR

BEGIN
    // Початкові налаштування можна залишити порожніми
    // або заповнити через HMI
END_DATA_BLOCK
```

### 14.4 Використання констант у FC

#### FC_InitMechs.scl

```scl
FUNCTION "FC_InitMechs" : VOID
{ S7_Optimized_Access := 'TRUE' }

VAR_TEMP
    i : INT;
END_VAR

BEGIN
    // ✅ Правильно: використовуємо константу
    FOR i := 0 TO "MECHS_COUNT" DO
        "DB_Mechs".Mechs[i].DeviceType := TYPE_NONE;
        "DB_Mechs".Mechs[i].TypedIndex := UINT#16#FFFF;
    END_FOR;
    
    // Далі мапінг конкретних механізмів...
END_FUNCTION
```

#### FC_SimRedler.scl

```scl
FUNCTION "FC_SimRedler" : VOID
{ S7_Optimized_Access := 'TRUE' }

VAR_INPUT
    RedlerIdx : UINT;
    ...
END_VAR

BEGIN
    // ✅ Валідація індексу через константу
    IF RedlerIdx > "REDLERS_COUNT" THEN
        RETURN;  // індекс за межами
    END_IF;
    
    // Далі логіка симуляції...
END_FUNCTION
```

### 14.5 Генерація констант (Python)

**generate_plc_config.py:**

```python
def generate_db_const_counts(self) -> str:
    """Генерація DB_Const_Counts.scl з константами кількості"""
    
    max_redlers = max([r['TypedIdx'] for r in self.redlers], default=-1) + 1 if self.redlers else 0
    max_norias = max([n['TypedIdx'] for n in self.norias], default=-1) + 1 if self.norias else 0
    max_gates = max([g['TypedIdx'] for g in self.gates], default=-1) + 1 if self.gates else 0
    max_fans = max([f['TypedIdx'] for f in self.fans], default=-1) + 1 if self.fans else 0
    
    code = self._get_header("DB_Const_Counts - Константи кількості механізмів")
    code += '''
DATA_BLOCK "DB_Const_Counts"
{ S7_Optimized_Access := 'TRUE' }
VERSION : 1.0

VAR CONSTANT
    // ===================================================================
    // Загальна кількість слотів
    // ===================================================================
    MECHS_COUNT : UINT := 255;    // 0..255 (256 слотів)
    
    // ===================================================================
    // Кількість механізмів по типам
    // ===================================================================
'''
    
    if max_redlers > 0:
        code += f'    REDLERS_COUNT : UINT := {max_redlers - 1};  // 0..{max_redlers-1} ({max_redlers} редлерів)\n'
    else:
        code += '    REDLERS_COUNT : UINT := 0;   // немає редлерів\n'
    
    if max_norias > 0:
        code += f'    NORIAS_COUNT  : UINT := {max_norias - 1};   // 0..{max_norias-1} ({max_norias} норій)\n'
    else:
        code += '    NORIAS_COUNT  : UINT := 0;   // немає норій\n'
    
    if max_gates > 0:
        code += f'    GATES2P_COUNT : UINT := {max_gates - 1};   // 0..{max_gates-1} ({max_gates} засувок)\n'
    else:
        code += '    GATES2P_COUNT : UINT := 0;   // немає засувок\n'
    
    if max_fans > 0:
        code += f'    FANS_COUNT    : UINT := {max_fans - 1};    // 0..{max_fans-1} ({max_fans} вентиляторів)\n'
    else:
        code += '    FANS_COUNT    : UINT := 0;   // немає вентиляторів\n'
    
    code += '''
END_VAR

BEGIN
END_DATA_BLOCK
'''
    return code
```

### 14.6 Workflow зміни кількості механізмів

**Старий підхід (багато редагувань):**
```
1. Редагувати DB_Mechs.scl (розмір масиву Redler[])
2. Редагувати DB_SimRedlers.scl (розмір масиву State[])
3. Редагувати DB_SimRedlersConfig.scl (розмір масиву Config[])
4. Редагувати FC_InitMechs.scl (цикл FOR)
5. Редагувати FC_SimRedler.scl (валідація індексу)
6. Перекомпілювати всі DB та FC
7. Сподіватися, що нічого не забули ❌
```

**Новий підхід (одна зміна):**
```
1. Редагувати DB_Const_Counts:
   REDLERS_COUNT := 99  // було 49, стало 99
   
2. Перекомпілювати проект (TIA Portal автоматично оновить усі масиви)

3. Готово! ✅
```

### 14.7 Інваріанти констант

```
I1: MECHS_COUNT = 255 (фіксовано, slot addressing)

I2: REDLERS_COUNT  ≤ 49  (slot 0..49)
    NORIAS_COUNT   ≤ 49  (slot 50..99)
    GATES2P_COUNT  ≤ 49  (slot 100..149)
    FANS_COUNT     ≤ 49  (slot 150..199)

I3: Сума всіх механізмів ≤ 200 (резерв 200..255)

I4: TypedIndex < <TYPE>_COUNT для всіх механізмів

I5: Зміна <TYPE>_COUNT потребує:
    - Редагування DB_Const_Counts
    - Перекомпіляції проекту
    - Оновлення Excel конфігурації (для генератора)
```

### 14.8 Приклад конфігурації

**Малий елеватор (10 редлерів, 5 норій):**
```scl
CONST
    MECHS_COUNT     : UINT := 255;
    REDLERS_COUNT   : UINT := 9;     // 0..9 (10 редлерів)
    NORIAS_COUNT    : UINT := 4;     // 0..4 (5 норій)
    GATES2P_COUNT   : UINT := 4;     // 0..4 (5 засувок)
    FANS_COUNT      : UINT := 2;     // 0..2 (3 вентилятори)
END_CONST
```

**Великий елеватор (50 редлерів, 50 норій):**
```scl
CONST
    MECHS_COUNT     : UINT := 255;
    REDLERS_COUNT   : UINT := 49;    // 0..49 (50 редлерів)
    NORIAS_COUNT    : UINT := 49;    // 0..49 (50 норій)
    GATES2P_COUNT   : UINT := 49;    // 0..49 (50 засувок)
    FANS_COUNT      : UINT := 49;    // 0..49 (50 вентиляторів)
END_CONST
```

### 14.9 Переваги підходу

**Технічні:**
- ✅ Єдине джерело істини (Single Source of Truth)
- ✅ Автоматична узгодженість розмірів масивів
- ✅ Легке масштабування (від 10 до 50 механізмів)
- ✅ Захист від помилок (TIA Portal перевірить на етапі компіляції)
- ✅ Зрозуміло, які межі системи

**Процесні:**
- ✅ Менше часу на налаштування нового проекту
- ✅ Менше ризику людської помилки
- ✅ Простіша документація (константи самодокументуються)
- ✅ Легше тестувати різні конфігурації

**Підтримка:**
- ✅ Швидка адаптація під новий об'єкт
- ✅ Зрозуміло, що міняти при масштабуванні
- ✅ Зручно для code review (зміна в одному місці)

### 14.10 Обмеження

**Що НЕ можна:**
- ❌ Змінювати константи в runtime (це compile-time значення)
- ❌ Використовувати різні константи для різних CPU у проекті

**Що потрібно:**
- ✅ Перекомпіляція після зміни констант
- ✅ Оновлення Excel конфігурації для генератора
- ✅ Перевірка, що нові індекси не виходять за межі slot ranges

---

## ✅ Changelog v2.1.1

```
[ADDED]
+ Section 14: Константи кількості механізмів ⭐
  ├─ 14.1: Принцип динамічного розміру масивів
  ├─ 14.2: Набір констант (DB_Const_Counts)
  ├─ 14.3: Використання констант у DB (приклади)
  ├─ 14.4: Використання констант у FC (валідація)
  ├─ 14.5: Генерація констант (Python код)
  ├─ 14.6: Workflow зміни кількості механізмів
  ├─ 14.7: Інваріанти констант
  ├─ 14.8: Приклад конфігурації (малий vs великий елеватор)
  ├─ 14.9: Переваги підходу
  └─ 14.10: Обмеження

[CHANGED]
~ Section 2.3: Slot-based addressing (оновлено з посиланням на константи)
~ Додаток A: DB mapping (додано DB_Const_Counts)

[FIXED]
- Section 2.3: Приклад DB_Mechs використовує жорстко закодовані розміри
  → оновлено на використання констант
```

---

**Кінець контракту v2.1.1**

🎯 **Цей контракт є єдиним джерелом істини для архітектури системи.**

📌 **Нововведення v2.1.1:** Всі розміри масивів механізмів тепер визначаються через глобальні константи, що забезпечує узгодженість, масштабованість та зменшує ризик помилок при конфігурації.
