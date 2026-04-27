# Битовая маска аварий (FLTCode)

## Описание изменений

FLTCode изменен с одиночного значения на битовую маску (WORD, 16 бит). Теперь механизм может иметь несколько одновременных аварий.

## Битовая карта аварий

| Бит | Маска | Константа | Описание | Механизмы |
|-----|-------|-----------|----------|-----------|
| 0 | 1 | FLT_BREAKER | Авария автомата защиты | Все |
| 1 | 2 | FLT_OVERFLOW | Авария переполнения | Redler, Noria |
| 2 | 4 | FLT_NO_RUNFB | Нет обратной связи тахо | Redler, Noria |
| 3 | 8 | FLT_ALINGMENT | Авария выравнивания | Noria |
| 4 | 16 | FLT_NO_FEEDBACK | Нет обратной связи контактора | Redler, Noria, Fan, Separator, Feeder |
| 5 | 32 | FLT_GATE_MOVE_TIMEOUT | Таймаут перемещения засувки | Gate2P |
| 6 | 64 | FLT_GATE_POS_UNKNOWN | Неизвестная позиция засувки | Gate2P |
| 7 | 128 | FLT_BOTH_SENSORS | Оба датчика активны | Gate2P |
| 8 | 256 | FLT_STOP_TIMEOUT | Таймаут выбега | Redler, Noria, Fan, Separator, Feeder |
| 9 | 512 | FLT_VALVE_MOVE_TIMEOUT | Таймаут перемещения клапана | Valve3P |
| 10 | 1024 | FLT_VALVE_POS_UNKNOWN | Неизвестная позиция клапана | Valve3P |
| 11 | 2048 | FLT_VALVE_MULTIPLE_POS | Несколько датчиков позиции активны | Valve3P |
| 12 | 4096 | FLT_INTERLOCK | Блокировка | Все |
| 13-15 | - | Резерв | Для будущих аварий | - |

## Логика работы

### Установка аварии (OR)
```scl
#B.FLTCode := #B.FLTCode OR "FLT_BREAKER";
```
Устанавливает бит аварии, не затрагивая другие биты.

### Сброс аварии (AND NOT)
```scl
#B.FLTCode := #B.FLTCode AND NOT "FLT_BREAKER";
```
Сбрасывает бит аварии, не затрагивая другие биты.

### Проверка аварии (AND)
```scl
IF (#B.FLTCode AND "FLT_BREAKER") <> 0 THEN
    // Авария активна
END_IF;
```

### Проверка отсутствия аварий
```scl
IF #B.FLTCode = "FLT_NONE" THEN
    // Нет аварий
END_IF;
```

## Изменения в логике механизмов

### 1. Мониторинг аварий (Region 3)
**Было:**
```scl
IF #B.FLTCode = "FLT_NONE" AND NOT #isBlocked THEN
    IF NOT #N.DI_Breaker_OK THEN
        #B.FLTCode := "FLT_BREAKER";
    ELSIF NOT #N.DI_Overflow_OK THEN
        #B.FLTCode := "FLT_OVERFLOW";
    END_IF;
END_IF;
```

**Стало:**
```scl
IF NOT #isBlocked THEN
    IF NOT #N.DI_Breaker_OK THEN
        #B.FLTCode := #B.FLTCode OR "FLT_BREAKER";
    END_IF;
    IF NOT #N.DI_Overflow_OK THEN
        #B.FLTCode := #B.FLTCode OR "FLT_OVERFLOW";
    END_IF;
END_IF;
```

### 2. RESET (Region 1)
**Было:**
```scl
CASE #B.FLTCode OF
    "FLT_BREAKER":
        IF #N.DI_Breaker_OK OR #forceBreaker THEN
            #B.FLTCode := "FLT_NONE";
        END_IF;
END_CASE;
```

**Стало:**
```scl
IF (#B.FLTCode AND "FLT_BREAKER") <> 0 THEN
    IF #N.DI_Breaker_OK OR #forceBreaker THEN
        #B.FLTCode := #B.FLTCode AND NOT "FLT_BREAKER";
    END_IF;
END_IF;
```

### 3. Определение исполнительной аварии (Region 4)
**Было:**
```scl
CASE #B.FLTCode OF
    "FLT_BREAKER":
        #isFault := NOT #forceBreaker;
    "FLT_OVERFLOW":
        #isFault := NOT #forceOverflow;
END_CASE;
```

**Стало:**
```scl
IF (#B.FLTCode AND "FLT_BREAKER") <> 0 AND NOT #forceBreaker THEN
    #isFault := TRUE;
END_IF;
IF (#B.FLTCode AND "FLT_OVERFLOW") <> 0 AND NOT #forceOverflow THEN
    #isFault := TRUE;
END_IF;
```

## Преимущества

1. **Множественные аварии** — можно видеть все активные аварии одновременно
2. **Независимый сброс** — каждая авария сбрасывается отдельно при устранении причины
3. **Лучшая диагностика** — оператор видит полную картину состояния механизма
4. **Расширяемость** — легко добавить новые типы аварий (до 16 одновременно)

## Пример сценария

1. Механизм работает (STS_RUNNING)
2. Пропадает Breaker → FLTCode = 0x0001 (BIT0)
3. Пропадает Speed → FLTCode = 0x0005 (BIT0 + BIT2)
4. Механизм переходит в STS_FAULT
5. Оператор видит обе аварии
6. Восстанавливается Breaker → CMD_RESET → FLTCode = 0x0004 (только BIT2)
7. Механизм остается в STS_FAULT (есть активная авария Speed)
8. Восстанавливается Speed → CMD_RESET → FLTCode = 0x0000
9. Механизм переходит в STS_IDLE

## Модифицированные файлы

### Константы
- `Constant.csv` — все FLT_* константы изменены на степени двойки

### FC функции (только FC_Noria пока)
- `Mechs/FC_Noria.scl` (v0.4 → v0.5)

### Startup
- `Startup.scl` (v0.2 → v0.3) — добавлена инициализация LastStopMs

## TODO

Необходимо обновить остальные FC механизмов:
- FC_Redler.scl
- FC_Fan.scl
- FC_Separator.scl
- FC_Feeder.scl
- FC_Gate2P.scl
- FC_Valve3P.scl

## Совместимость с SCADA

SCADA должна быть обновлена для отображения битовой маски:
- Декодирование FLTCode на отдельные биты
- Отображение списка активных аварий
- Обновление HMI алармов
