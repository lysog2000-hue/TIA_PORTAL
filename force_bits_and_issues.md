# Force_Code — таблиця бітів форсування та зафіксовані помилки

> Дата: 2026-02-26
> `B.Force_Code : INT` — бітова маска форсування захистів механізму.
> Форсування дозволяє скинути аварію або ігнорувати захист у режимі налагодження.

---

## 1. Єдина таблиця Force_Code бітів (всі механізми)

> Кожен біт має фіксоване значення незалежно від типу механізму.
> Механізм використовує лише ті біти, які відповідають його аваріям.

| Біт | Маска | Ім'я | FLT що скидає | Noria | Redler | Fan | Gate2P |
|-----|-------|------|---------------|-------|--------|-----|--------|
| BIT0 | `AND 1` | `forceBreaker` | `FLT_BREAKER` | ✅ | ✅ | ✅ | ✅ |
| BIT1 | `AND 2` | `forceOverflow` | `FLT_OVERFLOW` | ✅ | ✅ | — | — |
| BIT2 | `AND 4` | `forceSpeed` | `FLT_NO_RUNFB` | ✅ | ✅ | ✅ | — |
| BIT3 | `AND 8` | `forceAlingment` | `FLT_ALINGMENT` | ✅ | — | — | — |
| BIT4 | `AND 16` | `forceMoveTimeout` | `FLT_GATE_MOVE_TIMEOUT` | — | — | — | ✅ |
| BIT5 | `AND 32` | `forcePosUnknown` | `FLT_GATE_POS_UNKNOWN` | — | — | — | ✅ |
| BIT6–BIT15 | — | резерв | — | | | | |

> `FLT_BOTH_SENSORS` — не форсується (апаратна несправність, скидається CMD_RESET після усунення).

---

## 2. Єдина таблиця FLTCode (всі механізми)

> `B.FLTCode : UINT` — код активної аварії механізму.
> Кожен FLT відповідає рівно одному біту Force_Code (або не форсується).

| FLT константа | Значення | Force bit | Маска | Noria | Redler | Fan | Gate2P |
|---------------|----------|-----------|-------|-------|--------|-----|--------|
| `FLT_NONE` | 0 | — | — | ✅ | ✅ | ✅ | ✅ |
| `FLT_BREAKER` | 11 | BIT0 `forceBreaker` | `AND 1` | ✅ | ✅ | ✅ | ✅ |
| `FLT_NO_RUNFB` | 12 | BIT2 `forceSpeed` | `AND 4` | ✅ | ✅ | ✅ | — |
| `FLT_OVERFLOW` | 10 | BIT1 `forceOverflow` | `AND 2` | ✅ | ✅ | — | — |
| `FLT_ALINGMENT` | 15 | BIT3 `forceAlingment` | `AND 8` | ✅ | — | — | — |
| `FLT_GATE_MOVE_TIMEOUT` | 16 | BIT4 `forceMoveTimeout` | `AND 16` | — | — | — | ✅ |
| `FLT_GATE_POS_UNKNOWN` | 17 | BIT5 `forcePosUnknown` | `AND 32` | — | — | — | ✅ |
| `FLT_BOTH_SENSORS` | 18 | не форсується | — | — | — | — | ✅ |

> Видалено: `FLT_INTERLOCK` (13) — не використовувався в жодному механізмі.
> Видалено: `FLT_NO_FEEDBACK` (14) — об'єднано з `FLT_NO_RUNFB` (12); вентилятор тепер використовує `FLT_NO_RUNFB`.

---

### Позиційні константи Gate2P (v1.3)

| Константа | Значення | Поле DI | Поле DO |
|-----------|----------|---------|---------|
| `CMD_GATE_POS0` | 6 | `DI_Pos0_OK` | `DO_Pos0` |
| `CMD_GATE_POS1` | 7 | `DI_Pos1_OK` | `DO_Pos1` |

---
