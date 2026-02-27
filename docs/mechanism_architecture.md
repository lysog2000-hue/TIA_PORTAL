# Архітектура системи механізмів

**Версія:** 1.1
**Дата:** 2026-02-27

---

## 📋 Зміст

1. [Огляд](#1-огляд)
2. [ООП підхід в SCL](#2-ооп-підхід-в-scl)
3. [Базова структура механізму](#3-базова-структура-механізму)
4. [Типи механізмів](#4-типи-механізмів)
5. [Арбітраж керування](#5-арбітраж-керування)
6. [Стани механізму](#6-стани-механізму)
7. [Команди механізму](#7-команди-механізму)
8. [Аварії та захисти](#8-аварії-та-захисти)
9. [Форсування захистів](#9-форсування-захистів)

---

## 1. Огляд

Система механізмів — це базовий шар автоматизації елеватора, реалізований з використанням **ООП-підходу** в SCL.

**Ключові принципи:**
- **Інтерфейс через базовий клас** — `UDT_BaseMechanism` як спільний інтерфейс
- **Наслідування** — кожен тип механізму розширює базову структуру


---

## 2. ООП підхід в SCL

### 2.1 Ієрархія типів

```
                    ┌─────────────────────┐
                    │  UDT_BaseMechanism  │  ← Базовий клас (інтерфейс)
                    │  - спільні поля     │
                    │  - Status, Cmd,     │
                    │    Owner, FLTCode   │
                    └──────────┬──────────┘
                               │
         ┌─────────────┬───────┼───────┬─────────────┐
         ▼             ▼       ▼       ▼             ▼
┌─────────────┐ ┌───────────┐ ┌─────────┐ ┌─────────────────┐
│ UDT_Redler  │ │UDT_Noria  │ │UDT_Fan  │ │  UDT_Gate2P     │
│ (розширення)│ │(розширення)│ │(розшир.)│ │  (розширення)   │
└─────────────┘ └───────────┘ └─────────┘ └─────────────────┘
```

### 2.2 Мапінг "батько → нащадок"

Кожен механізм має **подвійне представлення** — аналог поліморфізму:

```scl
// Базовий тип (доступ до спільних полів)
"DB_Mechs".Mechs[slot] : UDT_BaseMechanism

// Типизований тип (доступ до специфічних полів)
"DB_Mechs".Redler[idx] : UDT_Redler
```

**Зв'язок через поля:**
```scl
"DB_Mechs".Mechs[slot].DeviceType := TYPE_REDLER;
"DB_Mechs".Mechs[slot].TypedIndex := 0;  // Індекс у Redler[0]
```

### 2.3 Віртуальні методи (FC)

Кожний тип механізму має свою функцію-метод:

| Тип | Метод (FC) | Підпис |
|-----|------------|--------|
| `UDT_Redler` | `FC_Redler` | `(R: UDT_Redler, B: UDT_BaseMechanism)` |
| `UDT_Noria` | `FC_Noria` | `(N: UDT_Noria, B: UDT_BaseMechanism)` |
| `UDT_Fan` | `FC_Fan` | `(F: UDT_Fan, B: UDT_BaseMechanism)` |
| `UDT_Gate2P` | `FC_Gate2P` | `(G: UDT_Gate2P, B: UDT_BaseMechanism)` |

**Поліморфний виклик у `FC_DeviceRunner`:**
```scl
FOR slot := 0 TO 255 DO
    CASE Mechs[slot].DeviceType OF
        TYPE_REDLER:
            idx := Mechs[slot].TypedIndex;
            "FC_Redler"(R := Redler[idx], B := Mechs[slot]);
        TYPE_NORIA:
            idx := Mechs[slot].TypedIndex;
            "FC_Noria"(N := Noria[idx], B := Mechs[slot]);
        // ... інші типи
    END_CASE;
END_FOR;
```

### 2.4 Інкапсуляція стану

Вся інформація про механізм інкапсульована в структурі:

```scl
UDT_Redler
├── // Спадковані поля (від BaseMechanism)
├── Status          : USINT     // Стан (IDL/RUNNING/FAULT...)
├── Cmd             : USINT     // Поточна команда
├── FLTCode         : UINT      // Код аварії
├── OwnerCur        : USINT     // Власник
│
└── // Власні поля (специфічні для редлера)
    └── ... (специфічні дані)
```

---

## 3. Базова структура механізму

`UDT_BaseMechanism` — спільний інтерфейс (базовий клас) для всіх типів механізмів:

```scl
UDT_BaseMechanism
├── SlotId          : INT       // Фізичний слот (0..255)
├── DeviceType      : USINT     // TYPE_REDLER / TYPE_NORIA / TYPE_FAN / TYPE_GATE2P
├── TypedIndex      : UINT      // Індекс у масиві типу (0..N-1)
├── Status          : USINT     // STS_IDLE / STARTING / RUNNING / STOPPING / FAULT
├── FLTCode         : UINT      // Код аварії (0 = немає аварії)
├── OwnerCur        : USINT     // Поточний власник (OWNER_NONE / OWNER_SCADA / OWNER_ROUTE / OWNER_LOCAL)
├── OwnerCurId      : UINT      // ID власника (напр., RouteId)
├── Cmd             : USINT     // Поточна команда (CMD_NONE / CMD_START / CMD_STOP / ...)
├── CmdParam1       : INT       // Параметр команди
├── LocalManual     : BOOL      // Локальний ручний режим
├── Disabled        : BOOL      // Механізм вимкнений
├── Enable_OK       : BOOL      // Дозвіл на роботу (інверсія Disabled)
├── RunTime_sec     : UDINT     // Час напрацювання
├── StartCount      : UDINT     // Кількість запусків
└── LastCmd         : USINT     // Остання виконана команда
```

### 3.1 Мапінг механізмів

Кожен фізичний механізм має **подвійне представлення**:

1. **У загальному масиві** `DB_Mechs.Mechs[0..255]` — для швидкого доступу по слоту
2. **У типовому масиві** `DB_Mechs.Redler[]`, `Noria[]`, etc. — для виклику функцій

```scl
// Приклад мапінгу для редлера slot 5:
"DB_Mechs".Mechs[5].DeviceType := TYPE_REDLER;
"DB_Mechs".Mechs[5].TypedIndex := 0;  // Індекс у масиві Redler[0]
"DB_Mechs".Redler[0]                 // Фактична структура редлера
```

---

## 4. Типи механізмів

### 4.1 Redler (конвеєрний редлер)

**Файли:**
- `Mechs/Udts/UDT_Redler.scl`
- `Mechs/FC_Redler.scl`

**Входи (DI):**
- `DI_Speed_OK` — тахо-датчик (оберти)
- `DI_Breaker_OK` — автомат захисту
- `DI_Overflow_OK` — датчик переповнення

**Виходи (DO):**
- `DO_Run` — контактор пуску

**Аварії:**
| FLTCode | Константа | Опис | Force bit |
|---------|-----------|------|-----------|
| 10 | `FLT_OVERFLOW` | Переповнення жолоба | BIT1 `forceOverflow` |
| 11 | `FLT_BREAKER` | Спрацював автомат | BIT0 `forceBreaker` |
| 12 | `FLT_NO_RUNFB` | Немає зворотного зв'язку (обертів) | BIT2 `forceSpeed` |

---

### 4.2 Noria (ковшевий елеватор)

**Файли:**
- `Mechs/Udts/UDT_Noria.scl`
- `Mechs/FC_Noria.scl`

**Входи (DI):**
- `DI_Speed_OK` — тахо-датчик
- `DI_Breaker_OK` — автомат захисту
- `DI_UpperLevel_OK` — датчик верхнього рівня (бункер)
- `DI_LowerLevel_OK` — датчик нижнього рівня (підбій)

**Виходи (DO):**
- `DO_Run` — контактор пуску

**Аварії:**
| FLTCode | Константа | Опис | Force bit |
|---------|-----------|------|-----------|
| 10 | `FLT_OVERFLOW` | Переповнення (верхній рівень) | BIT1 `forceOverflow` |
| 11 | `FLT_BREAKER` | Спрацював автомат | BIT0 `forceBreaker` |
| 12 | `FLT_NO_RUNFB` | Немає обертів | BIT2 `forceSpeed` |
| 15 | `FLT_ALIGNMENT` | Зміщення стрічки | BIT3 `forceAlignment` |

---

### 4.3 Fan (вентилятор)

**Файли:**
- `Mechs/Udts/UDT_Fan.scl`
- `Mechs/FC_Fan.scl`

**Входи (DI):**
- `DI_Breaker_OK` — автомат захисту

**Виходи (DO):**
- `DO_Run` — контактор пуску

**Аварії:**
| FLTCode | Константа | Опис | Force bit |
|---------|-----------|------|-----------|
| 11 | `FLT_BREAKER` | Спрацював автомат | BIT0 `forceBreaker` |
| 12 | `FLT_NO_RUNFB` | Немає зворотного зв'язку | BIT2 `forceSpeed` |

---

### 4.4 Gate2P (двопозиційна засувка)

**Файли:**
- `Mechs/Udts/UDT_Gate2P.scl`
- `Mechs/FC_Gate2P.scl`

**Входи (DI):**
- `DI_Opened_OK` — позиція ВІДКРИТО
- `DI_Closed_OK` — позиція ЗАКРИТО

**Виходи (DO):**
- `DO_Open` — рух у відкриття
- `DO_Close` — рух у закриття

**Команди:**
| Параметр | Значення | Дія |
|----------|----------|-----|
| `CmdParam1 = 0` | `CMD_GATE_POS0` | Закрити (позиція 0) |
| `CmdParam1 = 1` | `CMD_GATE_POS1` | Відкрити (позиція 1) |

**Аварії:**
| FLTCode | Константа | Опис | Force bit |
|---------|-----------|------|-----------|
| 11 | `FLT_BREAKER` | Спрацював автомат | BIT0 `forceBreaker` |
| 16 | `FLT_GATE_MOVE_TIMEOUT` | Таймаут руху | BIT4 `forceMoveTimeout` |
| 17 | `FLT_GATE_POS_UNKNOWN` | Невідома позиція (обидва датчики) | BIT5 `forcePosUnknown` |
| 18 | `FLT_BOTH_SENSORS` | Обидва датчики активні (апаратна помилка) | **не форсується** |

---

## 5. Арбітраж керування

`FC_ArbiterMech` — функція арбітражу доступу до механізму.

### 5.1 Власники (Owner)

| Owner | Код | Опис |
|-------|-----|------|
| `OWNER_NONE` | 0 | Вільний |
| `OWNER_LOCAL` | 1 | Локальний режим (кнопки на шафі) |
| `OWNER_SCADA` | 2 | SCADA (ручне керування) |
| `OWNER_ROUTE` | 3 | Система маршрутів (автоматика) |

### 5.2 Пріоритети власників

1. **LocalManual** — найвищий пріоритет (блокує всі інші)
2. **OWNER_LOCAL** — локальне керування
3. **OWNER_SCADA / OWNER_ROUTE** — рівноправні, хто перший захопив

### 5.3 Алгоритм арбітражу

```scl
// Запит на керування
OwnerReq   := OWNER_SCADA;
OwnerReqId := 0;
ReqCmd     := CMD_START;

// Виклик арбітра
rejectCode := "FC_ArbiterMech"(
    OwnerReq   := OwnerReq,
    OwnerReqId := OwnerReqId,
    ReqCmd     := ReqCmd,
    ReqParam1  := 0,
    M          := "DB_Mechs".Mechs[slot]
);

// Коди відмови:
// ARB_OK (0)              — успішно
// ARB_LOCAL_MANUAL (1)    — активний локальний режим
// ARB_OWNER_BUSY (2)      — зайнято іншим власником
// ARB_WRONG_STATUS (3)    — невірний статус для операції
// ARB_SLOT_INVALID (4)    — невалідний слот
// ARB_CMD_BLOCKED (5)     — команда заблокована
// ARB_CMD_INVALID (6)     — невалідна команда
```

### 5.4 Meta-команди

Ці команди обробляються арбітром окремо:

| Команда | Опис |
|---------|------|
| `CMD_RELEASE_OWNER` | Звільнити власника (тільки якщо STS_IDLE або STS_FAULT) |
| `CMD_SET_OWNER_SCADA` | Тільки захопити власника (без виконання команди) |

---

## 6. Стани механізму

| Стан | Код | Опис |
|------|-----|------|
| `STS_NONE` | 0 | Невідомо / ініціалізація |
| `STS_IDLE` | 1 | Зупинено, готовий |
| `STS_STARTING` | 2 | Запуск (розгін) |
| `STS_RUNNING` | 3 | Робота |
| `STS_STOPPING` | 4 | Зупинка (гальмування) |
| `STS_FAULT` | 5 | Аварія |

### 6.1 Діаграма переходів станів

```
                    CMD_START
    ┌─────────────────────────────────┐
    │                                 ▼
    │    ┌─────────┐    таймаут    ┌──────────┐
    └────│ STS_IDLE │──────────────►│STARTING  │
         └─────────┘               └──────────┘
                                      │
                      DI_Speed_OK=1   │
                                      ▼
                                 ┌──────────┐
                                 │ RUNNING  │◄──────┐
                                 └──────────┘       │
                                      │             │ CMD_START
                                      │ CMD_STOP    │ (повторна)
                                      ▼             │
                                 ┌──────────┐       │
                                 │ STOPPING │───────┘
                                 └──────────┘
                                      │
                      allStopped=1    │
                                      ▼
                                 ┌──────────┐
                                 │ STS_IDLE │
                                 └──────────┘

    Будь-яка аварія (FLTCode ≠ 0) → STS_FAULT
    CMD_RESET + аварія усунута → STS_IDLE
```

---

## 7. Команди механізму

### 7.1 Базові команди

| Команда | Код | Опис | Параметр |
|---------|-----|------|----------|
| `CMD_NONE` | 0 | Немає команди | — |
| `CMD_START` | 1 | Пуск | `CmdParam1` — опціонально |
| `CMD_STOP` | 2 | Зупинка | — |
| `CMD_RESET` | 3 | Скидання аварії | — |

### 7.2 Спеціальні команди Gate2P

| Команда | Код | Опис |
|---------|-----|------|
| `CMD_GATE_POS0` | 6 | Рух у позицію 0 (закрито) |
| `CMD_GATE_POS1` | 7 | Рух у позицію 1 (відкрито) |

### 7.3 Параметр CmdParam1

Для засувки `CmdParam1` визначає цільову позицію:

```scl
// Приклад для Gate2P:
"DB_Mechs".Mechs[slot].Cmd := CMD_START;
"DB_Mechs".Mechs[slot].CmdParam1 := 1;  // CMD_GATE_POS1 = відкрити
```

---

## 8. Аварії та захисти

### 8.1 Єдина таблиця FLTCode

Див. [`docs/force_bits_and_faults.md`](force_bits_and_faults.md#2-єдина-таблиця-fltcode)

### 8.2 Скидання аварій

```scl
// 1. Усунути фізичну причину аварії
// 2. Видати команду скидання:
"DB_Mechs".Mechs[slot].Cmd := CMD_RESET;

// 3. Якщо FLTCode = 0 → механізм повертається у STS_IDLE
// 4. Якщо FLTCode ≠ 0 → аварія залишається (перевірити причину)
```

### 8.3 Неможливість скидання

Аварія **не скидається**, якщо:

- Фізична причина не усунута (датчик досі активний)
- `LocalManual = TRUE` (локальний режим)
- `Disabled = TRUE` (механізм вимкнений)
- `GlobalSafetyStop = TRUE` (глобальна аварійна зупинка)

---

## 9. Форсування захистів

Форсування — це тимчасове ігнорування захисту для налагодження.

### 9.1 Force_Code — бітова маска

```scl
UDT_BaseMechanism
├── Force_Code : INT  // Бітова маска форсування
```

| Біт | Маска | Ім'я | FLT що скидає |
|-----|-------|------|---------------|
| BIT0 | `AND 1` | `forceBreaker` | `FLT_BREAKER` |
| BIT1 | `AND 2` | `forceOverflow` | `FLT_OVERFLOW` |
| BIT2 | `AND 4` | `forceSpeed` | `FLT_NO_RUNFB` |
| BIT3 | `AND 8` | `forceAlignment` | `FLT_ALIGNMENT` |
| BIT4 | `AND 16` | `forceMoveTimeout` | `FLT_GATE_MOVE_TIMEOUT` |
| BIT5 | `AND 32` | `forcePosUnknown` | `FLT_GATE_POS_UNKNOWN` |

### 9.2 Приклад використання

```scl
// Форсувати датчик обертів (BIT2) для редлера:
"DB_Mechs".Redler[0].Force_Code := 4;  // AND 4 = BIT2

// Тепер FLT_NO_RUNFB буде проігноровано
// Механізм зможе запуститися без DI_Speed_OK

// Скинути форсування:
"DB_Mechs".Redler[0].Force_Code := 0;
```

### 9.3 Застереження

⚠️ **Форсування небезпечно!** Використовувати тільки:

- Для налагодження
- Для тимчасового виключення несправного датчика
- Тільки на короткий час

⚠️ **Заборонено форсувати:**

- `FLT_BOTH_SENSORS` (апаратна помилка)
- Аварії, що можуть призвести до пошкодження обладнання

---

## 10. Файли компонентів

### 10.1 Структури даних (Udts)

| Файл | Опис |
|------|------|
| `Mechs/Udts/UDT_BaseMechanism.scl` | Базова структура |
| `Mechs/Udts/UDT_Redler.scl` | Структура редлера |
| `Mechs/Udts/UDT_Noria.scl` | Структура норії |
| `Mechs/Udts/UDT_Fan.scl` | Структура вентилятора |
| `Mechs/Udts/UDT_Gate2P.scl` | Структура засувки |

### 10.2 Функції (FC)

| Файл | Опис |
|------|------|
| `Mechs/FC_Redler.scl` | Керування редлером |
| `Mechs/FC_Noria.scl` | Керування норією |
| `Mechs/FC_Fan.scl` | Керування вентилятором |
| `Mechs/FC_Gate2P.scl` | Керування засувкою |

### 10.3 Арбітраж

| Файл | Опис |
|------|------|
| `Core/FC_ArbiterMech.scl` | Арбітраж власників |
| `Core/FC_DeviceRunner.scl` | Диспетчер механізмів |

---

**Кінець документа**
