"""
CreateRunTimeDB.py
==================
БЕЗ ТРИГГЕРА — вся логика в процедуре UpdateMechStatus.
SCADA вызывает EXEC UpdateMechStatus @id, @isRunning
Процедура сама:
  - проверяет изменилось ли состояние
  - открывает/закрывает EventHistory
  - обновляет RunTimeSummary
"""

import pyodbc
from pathlib import Path
import json

# =========================================
# НАСТРОЙКИ
# =========================================
JSON_FILE = Path(r"C:\Users\lysog\Desktop\REpository\tia_repo\graph.json")
SERVER    = r"DESKTOP-4462UFF\SQLEXPRESS"
DB_NAME   = "RunTime"

MASTER_CONN = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SERVER};DATABASE=master;Trusted_Connection=yes;"
DB_CONN     = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SERVER};DATABASE={DB_NAME};Trusted_Connection=yes;"

RUNTIME_TYPES = {"Redler", "Noria", "Fan", "Separator", "Feeder"}

# =========================================
# 1. ЗАГРУЗКА JSON
# =========================================
print("Loading JSON...")
with open(JSON_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

devices = [d for d in data["devices"] if d["type"] in RUNTIME_TYPES]
print(f"Found {len(devices)} devices with runtime tracking")

# =========================================
# 2. ПЕРЕСОЗДАНИЕ БАЗЫ
# =========================================
print(f"Recreating database '{DB_NAME}'...")
with pyodbc.connect(MASTER_CONN, autocommit=True) as conn:
    cur = conn.cursor()
    cur.execute(f"""
        IF DB_ID('{DB_NAME}') IS NOT NULL
        BEGIN
            ALTER DATABASE {DB_NAME} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            DROP DATABASE {DB_NAME};
        END
    """)
    cur.execute(f"CREATE DATABASE {DB_NAME}")
    cur.execute("""
        IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'HMI_User')
        BEGIN
            CREATE LOGIN HMI_User WITH PASSWORD = '12345', CHECK_POLICY = OFF;
        END
    """)
print("Database created.")

# =========================================
# 3. ТАБЛИЦЫ И ПРОЦЕДУРЫ
# =========================================
with pyodbc.connect(DB_CONN, autocommit=True) as conn:
    cur = conn.cursor()

    cur.execute("""
        IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'HMI_User')
        BEGIN
            CREATE USER HMI_User FOR LOGIN HMI_User;
            EXEC sp_addrolemember 'db_owner', 'HMI_User';
        END
    """)

    # --------------------------------------------------
    # Таблица 1: Справочник механизмов
    # --------------------------------------------------
    cur.execute("""
        CREATE TABLE Mechanisms (
            MechanismId  INT           PRIMARY KEY,
            Name         NVARCHAR(100) NOT NULL UNIQUE,
            Type         NVARCHAR(50)  NOT NULL,
            TagPrefix    NVARCHAR(100) NOT NULL
        );
    """)

    # --------------------------------------------------
    # Таблица 2: Текущее состояние — 60 строк, не растёт
    # --------------------------------------------------
    cur.execute("""
        CREATE TABLE StatusLog (
            MechanismId  INT      PRIMARY KEY REFERENCES Mechanisms(MechanismId),
            IsRunning    BIT      NOT NULL DEFAULT 0,
            LastChanged  DATETIME NOT NULL DEFAULT GETDATE()
        );
    """)

    # --------------------------------------------------
    # Таблица 3: Итоговая наработка
    # --------------------------------------------------
    cur.execute("""
        CREATE TABLE RunTimeSummary (
            MechanismId   INT      PRIMARY KEY REFERENCES Mechanisms(MechanismId),
            TotalSeconds  BIGINT   NOT NULL DEFAULT 0,
            LastUpdated   DATETIME NOT NULL DEFAULT GETDATE(),
            LastResetTime DATETIME NULL
        );
    """)

    # --------------------------------------------------
    # Таблица 4: История событий
    # --------------------------------------------------
    cur.execute("""
        CREATE TABLE EventHistory (
            EventId         BIGINT   IDENTITY(1,1) PRIMARY KEY,
            MechanismId     INT      NOT NULL REFERENCES Mechanisms(MechanismId),
            StartTime       DATETIME NOT NULL,
            StopTime        DATETIME NULL,
            DurationSeconds INT      NULL
        );
        CREATE INDEX IX_EventHistory ON EventHistory(MechanismId, StartTime);
    """)

    # --------------------------------------------------
    # Процедура UpdateMechStatus — вся логика здесь
    # SCADA вызывает: EXEC UpdateMechStatus @id, @isRunning
    # --------------------------------------------------
    cur.execute("""
        CREATE PROCEDURE UpdateMechStatus
            @MechanismId INT,
            @IsRunning   BIT
        AS
        BEGIN
            SET NOCOUNT ON;

            DECLARE @prevIsRunning BIT;
            DECLARE @now DATETIME = GETDATE();

            -- Читаем текущее состояние
            SELECT @prevIsRunning = IsRunning
            FROM StatusLog
            WHERE MechanismId = @MechanismId;

            -- Если состояние не изменилось — выходим
            IF @prevIsRunning = @IsRunning RETURN;

            -- Обновляем StatusLog
            UPDATE StatusLog
            SET IsRunning   = @IsRunning,
                LastChanged = @now
            WHERE MechanismId = @MechanismId;

            -- 0 -> 1: запустился — открываем запись в EventHistory
            IF @prevIsRunning = 0 AND @IsRunning = 1
            BEGIN
                INSERT INTO EventHistory (MechanismId, StartTime)
                VALUES (@MechanismId, @now);
            END

            -- 1 -> 0: остановился — закрываем запись, считаем секунды
            IF @prevIsRunning = 1 AND @IsRunning = 0
            BEGIN
                DECLARE @startTime DATETIME;
                DECLARE @duration INT;

                -- Берём время последнего запуска
                SELECT TOP 1 @startTime = StartTime
                FROM EventHistory
                WHERE MechanismId = @MechanismId
                  AND StopTime IS NULL
                ORDER BY StartTime DESC;

                SET @duration = DATEDIFF(SECOND, @startTime, @now);

                -- Закрываем запись в EventHistory
                UPDATE EventHistory
                SET StopTime        = @now,
                    DurationSeconds = @duration
                WHERE MechanismId = @MechanismId
                  AND StopTime IS NULL;

                -- Добавляем наработку в RunTimeSummary
                UPDATE RunTimeSummary
                SET TotalSeconds = TotalSeconds + @duration,
                    LastUpdated  = @now
                WHERE MechanismId = @MechanismId;
            END
        END
    """)

    # --------------------------------------------------
    # Процедура сброса наработки
    # --------------------------------------------------
    cur.execute("""
        CREATE PROCEDURE ResetRunTime
            @MechanismId INT
        AS
        BEGIN
            SET NOCOUNT ON;
            UPDATE RunTimeSummary
            SET TotalSeconds  = 0,
                LastResetTime = GETDATE(),
                LastUpdated   = GETDATE()
            WHERE MechanismId = @MechanismId;
        END
    """)

    # --------------------------------------------------
    # VIEW 1: итоговая наработка
    # --------------------------------------------------
    cur.execute("""
        CREATE VIEW vw_RunTimeHours AS
        SELECT
            m.MechanismId,
            m.Name,
            m.Type,
            m.TagPrefix,
            s.IsRunning,
            s.LastChanged,
            r.TotalSeconds,
            CAST(r.TotalSeconds / 3600.0 AS DECIMAL(10,2)) AS TotalHours,
            r.TotalSeconds / 86400                          AS Days,
            (r.TotalSeconds % 86400) / 3600                 AS Hours,
            (r.TotalSeconds % 3600)  / 60                   AS Minutes,
            r.TotalSeconds % 60                             AS Seconds,
            r.LastUpdated,
            r.LastResetTime
        FROM RunTimeSummary r
        JOIN Mechanisms m ON m.MechanismId = r.MechanismId
        JOIN StatusLog  s ON s.MechanismId = r.MechanismId;
    """)

    # --------------------------------------------------
    # VIEW 2: история событий
    # --------------------------------------------------
    cur.execute("""
        CREATE VIEW vw_EventHistory AS
        SELECT
            e.EventId,
            m.Name,
            m.Type,
            e.StartTime,
            e.StopTime,
            e.DurationSeconds,
            CAST(ISNULL(e.DurationSeconds, 0) / 3600.0 AS DECIMAL(10,2)) AS DurationHours,
            CASE WHEN e.StopTime IS NULL THEN 1 ELSE 0 END AS IsActive
        FROM EventHistory e
        JOIN Mechanisms m ON m.MechanismId = e.MechanismId;
    """)

    # --------------------------------------------------
    # Заполнение справочника
    # --------------------------------------------------
    print("Inserting mechanisms...")
    for dev in devices:
        mech_id = int(dev["id"])
        name    = dev["name"]
        mtype   = dev["type"]
        tag     = name.replace(".", "_")

        cur.execute(
            "INSERT INTO Mechanisms (MechanismId, Name, Type, TagPrefix) VALUES (?, ?, ?, ?)",
            mech_id, name, mtype, tag
        )
        cur.execute(
            "INSERT INTO StatusLog (MechanismId, IsRunning) VALUES (?, 0)",
            mech_id
        )
        cur.execute(
            "INSERT INTO RunTimeSummary (MechanismId, TotalSeconds) VALUES (?, 0)",
            mech_id
        )

print("\nBASE READY!")
print(f"   Mechanisms    : {len(devices)} rows (fixed)")
print(f"   StatusLog     : {len(devices)} rows (fixed, no growth)")
print(f"   RunTimeSummary: {len(devices)} rows (fixed)")
print(f"   EventHistory  : grows only on state change")
print(f"   NO TRIGGERS   : all logic in UpdateMechStatus procedure")
print(f"   Views         : vw_RunTimeHours, vw_EventHistory")
print(f"   Procedures    : UpdateMechStatus, ResetRunTime")

from collections import Counter
counts = Counter(d["type"] for d in devices)
print("\nBy type:")
for t, c in sorted(counts.items()):
    print(f"   {t:12} : {c}")
