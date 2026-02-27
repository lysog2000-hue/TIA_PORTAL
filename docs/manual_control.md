# Ручний режим керування механізмами

**Версія:** 1.0  
**Дата:** 2026-02-27

---

## 📋 Зміст

1. [Огляд](#1-огляд)
2. [Власники (Owner)](#2-власники-owner)
3. [Як взяти механізм під керування](#3-як-взяти-механізм-під-керування)
4. [Команди ручного керування](#4-команди-ручного-керування)
5. [Приклади](#5-приклади)
6. [Конфліктні ситуації](#6-конфліктні-ситуації)
7. [LocalManual — локальний режим](#7-localmanual-локальний-режим)

---

## 1. Огляд

Ручний режим дозволяє оператору керувати механізмами **повз маршрути** — напряму з SCADA.

### 1.1 Коли використовується

| Ситуація | Опис |
|----------|------|
| **Налагодження** | Перевірка окремого механізму після монтажу |
| **Обслуговування** | Тест після ремонту |
| **Аварійна ситуація** | Коли автоматика не працює |
| **Ручне керування** | Оператор на шафі (LocalManual) |

### 1.2 Принципи

- **Ownership** — хто захопив, той і керує
- **Пріоритети** — LocalManual блокує все
- **Безпека** — не можна змінити власника під час руху

---

## 2. Власники (Owner)

Хто має право керувати механізмом.

### 2.1 Таблиця власників

| Власник | Код | Пріоритет | Опис |
|---------|-----|-----------|------|
| `OWNER_NONE` | 0 | — | Вільний (ніхто не керує) |
| `OWNER_LOCAL` | 1 | Найвищий | Кнопки на шафі (LocalManual) |
| `OWNER_SCADA` | 2 | Середній | SCADA (ручне керування) |
| `OWNER_ROUTE` | 3 | Середній | Система маршрутів (автоматика) |

### 2.2 Правила

1. **LocalManual блокує все** — якщо механізм у локальному режимі, ніхто інший не може керувати
2. **Хто перший зайняв** — SCADA або Route мають рівні права
3. **Звільнити може тільки власник** — якщо Route зайняв, то SCADA не може забрати
4. **Зміна власника** — тільки коли механізм у `IDLE` або `FAULT`

### 2.3 Як перевірити хто керує

```scl
// Читати з структури механізму
OwnerCur := "DB_Mechs".Mechs[slot].OwnerCur;

// Результат:
// 0 = OWNER_NONE   → вільний, можна захопити
// 1 = OWNER_LOCAL  → заблоковано (шафа)
// 2 = OWNER_SCADA  → зайнято SCADA
// 3 = OWNER_ROUTE  → зайнято маршрутом
```

---

## 3. Як взяти механізм під керування

### 3.1 Алгоритм захоплення

```
Крок 1: Перевірити LocalManual = FALSE
        → Якщо TRUE: не можна (блокує шафа)

Крок 2: Перевірити OwnerCur = OWNER_NONE
        → Якщо OWNER_ROUTE: зупинити маршрут
        → Якщо OWNER_LOCAL: не можна (шафа)

Крок 3: Видати CMD_SET_OWNER_SCADA
        → Перевірити rejectCode = ARB_OK

Крок 4: Тепер можна: CMD_START, CMD_STOP, CMD_RESET

Крок 5: Після завершення: CMD_RELEASE_OWNER
        → OwnerCur = OWNER_NONE
```

### 3.2 Команда захоплення

```scl
// Запит на захоплення
OwnerReq   := OWNER_SCADA;
OwnerReqId := 0;           // ID оператора (резерв)
ReqCmd     := CMD_SET_OWNER_SCADA;

// Виклик арбітра
rejectCode := "FC_ArbiterMech"(
    OwnerReq   := OwnerReq,
    OwnerReqId := OwnerReqId,
    ReqCmd     := ReqCmd,
    M          := "DB_Mechs".Mechs[slot]
);
```

### 3.3 Коди результату

| Код | Константа | Значення |
|-----|-----------|----------|
| 0 | `ARB_OK` | Успішно, OwnerCur = OWNER_SCADA |
| 1 | `ARB_LOCAL_MANUAL` | Заблоковано (LocalManual = TRUE) |
| 2 | `ARB_OWNER_BUSY` | Зайнято іншим власником |
| 3 | `ARB_WRONG_STATUS` | Механізм не у IDLE/FAULT |
| 4 | `ARB_SLOT_INVALID` | Невалідний слот |

---

## 4. Команди ручного керування

### 4.1 Базові команди

| Команда | Код | Параметр | Опис |
|---------|-----|----------|------|
| `CMD_START` | 1 | `CmdParam1` | Пуск (для засувки — позиція) |
| `CMD_STOP` | 2 | — | Зупинка |
| `CMD_RESET` | 3 | — | Скидання аварії |
| `CMD_RELEASE_OWNER` | 4 | — | Звільнити ownership |

### 4.2 CMD_START для різних механізмів

| Механізм | CmdParam1 | Дія |
|----------|-----------|-----|
| **Redler** | 0 | Пуск редлера |
| **Noria** | 0 | Пуск норії |
| **Fan** | 0 | Пуск вентилятора |
| **Gate2P** | 0 | Рух у позицію 0 (закрито) |
| **Gate2P** | 1 | Рух у позицію 1 (відкрито) |

### 4.3 Приклад: видати команду

```scl
// Запуск редлера
"DB_Mechs".Mechs[slot].Cmd := CMD_START;
"DB_Mechs".Mechs[slot].CmdParam1 := 0;

// Зупинка
"DB_Mechs".Mechs[slot].Cmd := CMD_STOP;

// Скидання аварії
"DB_Mechs".Mechs[slot].Cmd := CMD_RESET;
```

---

## 5. Приклади

### 5.1 Запуск редлера з SCADA

```
SCADA → PLC:
  OwnerReq = OWNER_SCADA
  Cmd = CMD_SET_OWNER_SCADA

PLC → SCADA:
  rejectCode = ARB_OK  → успішно
  OwnerCur = OWNER_SCADA

SCADA → PLC:
  Cmd = CMD_START
  CmdParam1 = 0

Механізм запускається:
  Status = IDLE → STARTING → RUNNING

SCADA → PLC:
  Cmd = CMD_STOP  → зупинка

SCADA → PLC:
  Cmd = CMD_RELEASE_OWNER  → звільнити
  OwnerCur = OWNER_NONE
```

### 5.2 Скидання аварії

```
Стан механізму:
  Status = FAULT
  FLTCode = 11  // FLT_BREAKER

Оператор усунув причину (автомат увімкнено)

SCADA → PLC:
  OwnerReq = OWNER_SCADA
  Cmd = CMD_SET_OWNER_SCADA

PLC → SCADA:
  rejectCode = ARB_OK  → успішно

SCADA → PLC:
  Cmd = CMD_RESET

Механізм:
  FLTCode = 0
  Status = IDLE  → готовий до роботи
```

### 5.3 Керування засувкою (2 позиції)

```
// Закрити засувку (позиція 0)
OwnerReq = OWNER_SCADA
Cmd = CMD_SET_OWNER_SCADA
→ ARB_OK

Cmd = CMD_START
CmdParam1 = 0  // CMD_GATE_POS0
→ засувка рухається у позицію 0
→ DI_Pos0_OK = TRUE → STOP

// Відкрити засувку (позиція 1)
Cmd = CMD_START
CmdParam1 = 1  // CMD_GATE_POS1
→ засувка рухається у позицію 1
→ DI_Pos1_OK = TRUE → STOP

// Звільнити
Cmd = CMD_RELEASE_OWNER
```

---

## 6. Конфліктні ситуації

### 6.1 Механізм зайнятий маршрутом

**Ситуація:**
- Маршрут 1 виконується → `OwnerCur = OWNER_ROUTE`
- SCADA намагається взяти керування

**Результат:**
```
rejectCode = ARB_OWNER_BUSY  → зайнято іншим
```

**Що робити:**
1. Зупинити маршрут 1 (`RT_CMD_STOP_OP`)
2. Дочекатися `State = ABORTED`
3. Перевірити `OwnerCur = OWNER_NONE`
4. Тоді брати під керування

### 6.2 Два оператори хочуть один механізм

**Ситуація:**
- Оператор A захопив механізм (`OwnerCur = OWNER_SCADA`)
- Оператор B намагається захопити

**Результат:**
```
rejectCode = ARB_OWNER_BUSY  → зайнято
```

**Рішення:**
- Тільки оператор A може керувати або звільнити
- Оператор B має чекати

### 6.3 LocalManual увімкнули під час керування

**Ситуація:**
- SCADA керує механізмом (`OwnerCur = OWNER_SCADA`)
- Хтось увімкнув LocalManual на шафі

**Результат:**
```
LocalManual = TRUE
→ OwnerCur = OWNER_LOCAL  (автоматично)
→ Усі команди з SCADA блокуються
```

**Що робити:**
1. Вимкнути LocalManual на шафі
2. Перевірити `OwnerCur = OWNER_NONE`
3. Захопити знову (`CMD_SET_OWNER_SCADA`)

---

## 7. LocalManual — локальний режим

### 7.1 Що таке LocalManual

**LocalManual** — це перемикач на шафі керування, який передає керування оператору на місці.

```scl
LocalManual = TRUE  // Перемикач на шафі увімкнено
```

### 7.2 Наслідки

| Параметр | Значення |
|----------|----------|
| `OwnerCur` | `OWNER_LOCAL` |
| Команди з PLC/SCADA | **Блокуються** |
| Хто керує | **Тільки з шафи** |

### 7.3 Як впливає на маршрути

**Якщо LocalManual увімкнули під час виконання маршруту:**

```
Route State = RUNNING
→ anyLocal = TRUE
→ перехід у STOPPING (код 403)
→ звільнення ownership
→ Route State = ABORTED
```

**Якщо LocalManual увімкнули під час VALIDATING:**

```
Route State = VALIDATING
→ механізм не готовий
→ перехід у REJECTED (код 303)
```

### 7.4 Як перевірити LocalManual

```scl
// Читати з структури механізму
localManual := "DB_Mechs".Mechs[slot].LocalManual;

// Результат:
// TRUE  = локальний режим активний (шафа керує)
// FALSE = дистанційне керування (PLC/SCADA)
```

### 7.5 Таблиця: хто може керувати

| Стан механізму | LocalManual | OwnerCur | Хто керує |
|----------------|-------------|----------|-----------|
| IDLE | FALSE | OWNER_NONE | Можна захопити |
| IDLE | FALSE | OWNER_SCADA | SCADA |
| IDLE | FALSE | OWNER_ROUTE | Маршрут |
| IDLE | TRUE | OWNER_LOCAL | Шафа (PLC заблоковано) |
| RUNNING | FALSE | OWNER_ROUTE | Маршрут |
| RUNNING | FALSE | OWNER_SCADA | SCADA |
| FAULT | FALSE | OWNER_NONE | Можна захопити + CMD_RESET |
| FAULT | TRUE | OWNER_LOCAL | Шафа (PLC заблоковано) |

---

## 8. Пов'язана документація

| Документ | Опис |
|----------|------|
| [`route_system_architecture.md`](route_system_architecture.md) | Система маршрутів — як працює автоматика |
| [`mechanism_architecture.md`](mechanism_architecture.md) | Система керування механізмами |
| [`force_bits_and_faults.md`](force_bits_and_faults.md) | Аварії та форсування захистів |

---

**Кінець документа**
