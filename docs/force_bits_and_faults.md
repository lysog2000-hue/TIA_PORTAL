# Force_Code — таблиця бітів форсування та зафіксовані помилки

> `B.Force_Code : INT` — бітова маска форсування захистів механізму.
> Форсування дозволяє скинути аварію або ігнорувати захист у режимі налагодження.

---

## 1. Таблиця Force_Code бітів

| Біт | Маска | Змінна | FLT що форсує | Redler | Noria | Fan | Separator | Feeder | Gate2P | Valve3P |
|-----|-------|--------|---------------|:------:|:-----:|:---:|:---------:|:------:|:------:|:-------:|
| BIT0 | 1 | forceBreaker | FLT_BREAKER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BIT1 | 2 | forceOverflow | FLT_OVERFLOW | ✅ | ✅ | — | — | — | — | — |
| BIT2 | 4 | forceSpeed | FLT_NO_RUNFB | ✅ | ✅ | — | — | — | — | — |
| BIT3 | 8 | forceAlingment | FLT_ALINGMENT | — | ✅ | — | — | — | — | — |
| BIT4 | 16 | forceMoveTimeout | FLT_GATE_MOVE_TIMEOUT / FLT_VALVE_MOVE_TIMEOUT | — | — | — | — | — | ✅ | ✅ |
| BIT5 | 32 | forcePosUnknown | FLT_GATE_POS_UNKNOWN / FLT_VALVE_POS_UNKNOWN | — | — | — | — | — | ✅ | ✅ |
| BIT6 | 64 | forceStopTimeout | FLT_STOP_TIMEOUT | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| BIT8 | 256 | forceFeedback | FLT_NO_FEEDBACK | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |

---

## 2. Таблиця FLTCode (B.FLTCode : WORD — бітова маска)

| Біт | Маска | FLT константа | Redler | Noria | Fan | Separator | Feeder | Gate2P | Valve3P |
|-----|-------|---------------|:------:|:-----:|:---:|:---------:|:------:|:------:|:-------:|
| — | 0 | FLT_NONE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BIT0 | 1 | FLT_BREAKER | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BIT1 | 2 | FLT_OVERFLOW | ✅ | ✅ | — | — | — | — | — |
| BIT2 | 4 | FLT_NO_RUNFB | ✅ | ✅ | — | — | — | — | — |
| BIT3 | 8 | FLT_ALINGMENT | — | ✅ | — | — | — | — | — |
| BIT4 | 16 | FLT_NO_FEEDBACK | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| BIT5 | 32 | FLT_GATE_MOVE_TIMEOUT | — | — | — | — | — | ✅ | — |
| BIT6 | 64 | FLT_GATE_POS_UNKNOWN | — | — | — | — | — | ✅ | — |
| BIT7 | 128 | FLT_BOTH_SENSORS | — | — | — | — | — | ✅ | — |
| BIT8 | 256 | FLT_STOP_TIMEOUT | ✅ | ✅ | ✅ | ✅ | ✅ | — | — |
| BIT9 | 512 | FLT_VALVE_MOVE_TIMEOUT | — | — | — | — | — | — | ✅ |
| BIT10 | 1024 | FLT_VALVE_POS_UNKNOWN | — | — | — | — | — | — | ✅ |
| BIT11 | 2048 | FLT_VALVE_MULTIPLE_POS | — | — | — | — | — | — | ✅ |
| BIT12 | 4096 | FLT_INTERLOCK | резерв | резерв | резерв | резерв | резерв | резерв | резерв |

> `FLT_BOTH_SENSORS` та `FLT_VALVE_MULTIPLE_POS` — не форсуються, скидаються тільки CMD_RESET.

---

## 3. Позиційні константи Gate2P

| Константа | Значення | DI поле | DO поле |
|-----------|----------|---------|---------|
| CMD_GATE_POS0 | 6 | DI_Pos0_OK | DO_Pos0 |
| CMD_GATE_POS1 | 7 | DI_Pos1_OK | DO_Pos1 |
| GATE_AT_POS0 | 6 | Status_Param при Pos0 | — |
| GATE_AT_POS1 | 7 | Status_Param при Pos1 | — |

## 4. Позиційні константи Valve3P

| Константа | Значення | DI поле | DO поле |
|-----------|----------|---------|---------|
| CMD_VALVE_POS0 | 3 | DI_Pos0_OK | DO_Pos0 |
| CMD_VALVE_POS1 | 4 | DI_Pos1_OK | DO_Pos1 |
| CMD_VALVE_POS2 | 5 | DI_Pos2_OK | DO_Pos2 |
| VALVE_AT_POS0 | 3 | Status_Param при Pos0 | — |
| VALVE_AT_POS1 | 4 | Status_Param при Pos1 | — |
| VALVE_AT_POS2 | 5 | Status_Param при Pos2 | — |
