# Міграція симуляторів редлерів від FB до FC

## Зміни в архітектурі (v1.0 → v2.0)

### Було (v1.0 - FB):
```scl
// Потрібен окремий інстанс-DB для КОЖНОГО редлера
FB_SimRedler_inst0(RedlerIdx := 0, ...);
FB_SimRedler_inst1(RedlerIdx := 1, ...);
FB_SimRedler_inst2(RedlerIdx := 2, ...);
// ... і так для всіх N редлерів
```

**Проблеми:**
- Багато інстанс-DB (FB_SimRedler_inst0.DB, FB_SimRedler_inst1.DB, ...)
- Витрата пам'яті на CPU
- Незручно масово тестувати

### Стало (v2.0 - FC):
```scl
// ОДИН глобальний DB_SimRedlers для ВСІХ редлерів
FC_SimRedler(RedlerIdx := 0, ...);
FC_SimRedler(RedlerIdx := 1, ...);
FC_SimRedler(RedlerIdx := 2, ...);
// ... стан зберігається у DB_SimRedlers.State[0..31]
```

**Переваги:**
- Один глобальний DB замість багатьох
- Менше пам'яті
- Простіше масове тестування

---

## Порядок міграції

### 1. Імпорт нових файлів у TIA Portal

Імпортуйте у проект:
1. `UDT_SimRedlerState.scl` - тип даних стану симулятора
2. `DB_SimRedlers.scl` - глобальний DB (NON_RETAIN)
3. `FC_SimRedler.scl` - функція симулятора (v2.0)

### 2. Компіляція

Скомпілюйте у порядку:
1. UDT_SimRedlerState
2. DB_SimRedlers
3. FC_SimRedler

### 3. Заміна викликів у OB1 (або іншому циклічному OB)

**Старий код (видалити):**
```scl
// OB1
FB_SimRedler_inst0(
    RedlerIdx := 0,
    StartupTime_ms := 5000,
    StopTime_ms := 2000,
    SimFault_Breaker := FALSE
);

FB_SimRedler_inst1(
    RedlerIdx := 1,
    StartupTime_ms := 3000,
    StopTime_ms := 1500,
    SimFault_Overflow := TRUE,
    FaultTime_Overflow_ms := 20000
);
```

**Новий код (додати):**
```scl
// OB1
"FC_SimRedler"(
    RedlerIdx := 0,
    StartupTime_ms := 5000,
    StopTime_ms := 2000,
    SimFault_Breaker := FALSE
);

"FC_SimRedler"(
    RedlerIdx := 1,
    StartupTime_ms := 3000,
    StopTime_ms := 1500,
    SimFault_Overflow := TRUE,
    FaultTime_Overflow_ms := 20000
);
```

### 4. Видалення старих блоків

Після успішного тестування:
1. Видаліть всі інстанс-DB (FB_SimRedler_inst0.DB, FB_SimRedler_inst1.DB, ...)
2. Видаліть старий FB_SimRedler (v1.0)

---

## Нові можливості v2.0

### Ручний скид аварій

У версії 2.0 доданий вхід `ManualReset` для скидання латчованих аварій:

```scl
"FC_SimRedler"(
    RedlerIdx := 0,
    StartupTime_ms := 5000,
    StopTime_ms := 2000,
    SimFault_Breaker := TRUE,
    FaultTime_Breaker_ms := 10000,
    ManualReset := "HMI".SimRedler0_ResetFaults  // кнопка на HMI
);
```

**Що скидається:**
- `Breaker_Tripped` → FALSE
- `Overflow_Tripped` → FALSE

**Як це працює:**
1. Аварія спрацювала (Breaker_Tripped=TRUE)
2. DI_Breaker_OK=FALSE (FC_Redler бачить аварію)
3. Натискаєте кнопку скидання (ManualReset := TRUE)
4. Breaker_Tripped → FALSE, DI_Breaker_OK → TRUE
5. FC_Redler може перезапуститися після CMD_RESET

### Масове тестування

Легко симулювати багато редлерів у циклі:

```scl
// OB1 - симуляція 10 редлерів з однаковими параметрами
FOR i := 0 TO 9 DO
    "FC_SimRedler"(
        RedlerIdx := i,
        StartupTime_ms := 5000,
        StopTime_ms := 2000
    );
END_FOR;

// Або з різними параметрами через конфіг-таблицю (DB_SimConfig)
```

---

## Обмеження v2.0

1. **Максимум 32 редлери** (індекси 0..31)
   - Відповідає розміру DB_Mechs.Redler[]
   - Можна збільшити масив `DB_SimRedlers.State[0..N]` у майбутньому

2. **NON_RETAIN**
   - Стан симуляторів НЕ зберігається після перезавантаження CPU
   - Це навмисно - симулятор має почати з чистого стану
   - Латчовані аварії також скидаються при рестарті

3. **Один виклик на цикл**
   - Викликайте FC_SimRedler для кожного RedlerIdx тільки ОДИН РАЗ за цикл
   - Множинні виклики з однаковим RedlerIdx перезапишуть стан

---

## Тестування після міграції

### Перевірте базову логіку:

1. **Розгін/вибіг:**
   - DO_Run: 0→1 → DI_Speed_OK: FALSE (розгін) → TRUE (через StartupTime_ms)
   - DO_Run: 1→0 → DI_Speed_OK: TRUE (вибіг) → FALSE (через StopTime_ms)

2. **Аварія BREAKER:**
   - SimFault_Breaker=TRUE, запустіть редлер
   - Через FaultTime_Breaker_ms → DI_Breaker_OK=FALSE
   - FC_Redler переходить у FLT_BREAKER

3. **Аварія OVERFLOW:**
   - SimFault_Overflow=TRUE, запустіть редлер
   - Через FaultTime_Overflow_ms → DI_Overflow_OK=FALSE
   - FC_Redler переходить у FLT_OVERFLOW

4. **Скидання аварій:**
   - Після аварії встановіть ManualReset=TRUE
   - Перевірте DI_Breaker_OK та DI_Overflow_OK → TRUE

### Перевірте багато редлерів:

```scl
// OB1
FOR i := 0 TO 5 DO  // тестуємо 6 редлерів
    "FC_SimRedler"(
        RedlerIdx := i,
        StartupTime_ms := 5000
    );
END_FOR;
```

Запустіть всі через `DB_Mechs.Redler[i].CMD_ENABLE` та перевірте роботу.

---

## Зворотна сумісність

**Сигнали з FC_Redler:** повністю сумісні
- Читає: `DB_Mechs.Redler[idx].DO_Run`
- Пише: `DI_Speed_OK`, `DI_Breaker_OK`, `DI_Overflow_OK`

**Логіка роботи:** ідентична FB_SimRedler v1.0
- Фізика розгону/вибігу - однакова
- Таймери аварій - однакові
- Латчування аварій - однакове

**Відмінність:** тільки архітектура зберігання даних (інстанс-DB → глобальний DB)

---

## Troubleshooting

### Помилка: "Невідомий тип UDT_SimRedlerState"
**Рішення:** Імпортуйте та скомпілюйте UDT_SimRedlerState перед DB_SimRedlers

### Помилка: "DB_SimRedlers не існує"
**Рішення:** Імпортуйте та скомпілюйте DB_SimRedlers перед FC_SimRedler

### Редлер не симулюється
**Перевірте:**
1. RedlerIdx < 32 (індекс у межах масиву)
2. FC_SimRedler викликається ПЕРЕД FC_DeviceRunner у циклі
3. DB_Mechs.Redler[idx].DO_Run змінюється (перевірте у Watch)

### Аварії не скидаються
**Перевірте:**
1. ManualReset := TRUE подається на вхід FC_SimRedler
2. SimFault_Breaker/SimFault_Overflow = FALSE (інакше аварія знову спрацює)
3. Перевірте DB_SimRedlers.State[idx].Breaker_Tripped у Watch

---

## Подальший розвиток

Можливі покращення у майбутніх версіях:

1. **Збільшення масиву:**
   ```scl
   State : ARRAY[0..255] OF "UDT_SimRedlerState";  // до 256 редлерів
   ```

2. **Симуляція FB_SimNoria, FB_SimFan:**
   - За аналогією з FC_SimRedler
   - Окремі DB_SimNorias, DB_SimFans

3. **Конфігураційна таблиця:**
   ```scl
   DB_SimConfig.Redler[idx].StartupTime_ms := 5000;
   "FC_SimRedler"(RedlerIdx := idx, StartupTime_ms := DB_SimConfig.Redler[idx].StartupTime_ms);
   ```

4. **Динамічні аварії:**
   - Випадковий час спрацювання
   - Випадковий тип аварії
   - Для стрес-тестування

---

**Версія документа:** 2.0.0  
**Дата:** 2026-01-29
