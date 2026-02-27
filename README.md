# Elevator Automation System — TIA Portal v19

**Платформа:** Siemens TIA Portal v19  
**Мова:** SCL (Structured Control Language)

---

## 📖 Опис

Система автоматизації елеватора на базі Siemens PLC. Включає бібліотеку механізмів (редлери, норії, засувки, вентилятори), систему маршрутів з FSM, генератор коду з конфігурації та симуляцію для тестування.

---

## 📁 Документація

### Основна
- **[docs/README.md](docs/README.md)** — навігатор по всій документації
- **[docs/design_rules_scada_plc_route_canon.md](docs/design_rules_scada_plc_route_canon.md)** — правила проєктування SCADA ↔ PLC
- **[docs/force_bits_and_faults.md](docs/force_bits_and_faults.md)** — форсування захистів, FLTCode таблиці
- **[docs/mechanism_architecture.md](docs/mechanism_architecture.md)** — система керування механізмами
- **[docs/route_system_architecture.md](docs/route_system_architecture.md)** — система маршрутів (простою мовою)
- **[docs/manual_control.md](docs/manual_control.md)** — ручний режим керування
- **[docs/code_generator.md](docs/code_generator.md)** — генерація коду з Excel

### Розділи проекту
- **[Routes/ROUTE_SYSTEM.md](Routes/ROUTE_SYSTEM.md)** — система маршрутів (FSM, протоколи, стани)
- **[Mechs/](Mechs/)** — бібліотека механізмів
- **[db_gen/](db_gen/)** — генератор коду
- **[Mech_Simulate/](Mech_Simulate/)** — симулятори для тестування
- **[Core/](Core/)** — базові функції (арбітраж, таймери)



*Документація в розробці*
