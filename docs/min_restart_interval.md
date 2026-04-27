# Минимальный интервал перезапуска механизмов

## Описание

Добавлена защита от частых перезапусков механизмов. Каждый тип механизма имеет индивидуальный минимальный интервал, который должен пройти после остановки перед следующим запуском.

## Изменения в UDT

Добавлено поле `LastStopMs : DINT` в следующие типы:
- `UDT_Noria`
- `UDT_Redler`
- `UDT_Fan`
- `UDT_Separator`
- `UDT_Feeder`

Поле хранит метку времени последней остановки механизма (TIME_TCK).

## Константы минимального интервала

Добавлены в `Constant.csv`:

| Константа | Значение (мс) | Механизм |
|-----------|---------------|----------|
| TimeoutMs_Noria_MinRestart | 3000 | Норія |
| TimeoutMs_Redler_MinRestart | 3000 | Редлер |
| TimeoutMs_Fan_MinRestart | 5000 | Вентилятор |
| TimeoutMs_Separator_MinRestart | 3000 | Сепаратор |
| TimeoutMs_Feeder_MinRestart | 3000 | Фідер |

## Логика работы

### При остановке (STS_STOPPING → STS_IDLE)
Когда механизм переходит в состояние IDLE, сохраняется метка времени:
```scl
#N.LastStopMs := TIME_TCK();
```

### При запуске (CMD_START в STS_IDLE)
Перед запуском проверяется минимальный интервал:
```scl
IF #N.LastStopMs = 0 OR "FC_TimeElapsedMs"(StartTck := #N.LastStopMs, 
                                            TimeoutMs := "TimeoutMs_Noria_MinRestart",
                                            ElapsedMs => #elapsedMs, 
                                            NowTck => #nowTck) THEN
    #B.Status := "STS_STARTING";
    #N.StartMs := TIME_TCK();
END_IF;
```

### Условия запуска
Механизм запустится только если:
- `LastStopMs = 0` (первый запуск после инициализации)
- ИЛИ прошло время >= минимального интервала

### Поведение при блокировке
Если команда START поступает раньше минимального интервала:
- Команда игнорируется
- Механизм остается в состоянии IDLE
- Команда не сохраняется в LastCmd
- Повторная команда START будет обработана после истечения интервала

## Модифицированные файлы

### UDT структуры
- `Mechs/Udts/UDT_Noria.scl` (v0.3 → v0.4)
- `Mechs/Udts/UDT_Redler.scl` (v0.3 → v0.4)
- `Mechs/Udts/UDT_Fan.scl` (v1.0 → v1.1)
- `Mechs/Udts/UDT_Separator.scl` (v0.2 → v0.3)
- `Mechs/Udts/UDT_Feeder.scl` (v0.1 → v0.2)

### FC функции
- `Mechs/FC_Noria.scl` (v0.4 → v0.5)
- `Mechs/FC_Redler.scl` (v0.5 → v0.6)
- `Mechs/FC_Fan.scl` (v1.3 → v1.4)
- `Mechs/FC_Separator.scl` (v0.2 → v0.3)
- `Mechs/FC_Feeder.scl` (v0.2 → v0.3)

### Константы
- `Constant.csv` — добавлено 5 констант

## Примечания

- Интервалы можно настраивать индивидуально для каждого типа механизма
- Вентилятор имеет больший интервал (5 сек) из-за инерции
- Логика не влияет на аварийные остановки и RESET
- При сбросе PLC поле `LastStopMs` обнуляется (первый запуск разрешен сразу)
