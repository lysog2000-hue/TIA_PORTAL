import pyodbc
import json
import sys
from pathlib import Path

# =========================================
# НАСТРОЙКИ
# =========================================
JSON_FILE = Path(r"C:\Users\lysog\Desktop\PythonProject\graph.json")
SERVER = r"DESKTOP-4462UFF\SQLEXPRESS"
DB_NAME = "ElevatorRouting"

MASTER_CONN = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SERVER};DATABASE=master;Trusted_Connection=yes;"
DB_CONN = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SERVER};DATABASE={DB_NAME};Trusted_Connection=yes;"

# =========================================
# 1. ЗАГРУЗКА И ВАЛИДАЦИЯ JSON
# =========================================

def validate_json(data: dict) -> None:
    """Проверка структуры JSON."""
    if not isinstance(data, dict):
        raise ValueError("Root must be object")
    
    devices = data.get("devices")
    if not isinstance(devices, list):
        raise ValueError("'devices' must be list")
    
    for idx, dev in enumerate(devices, 1):
        if not isinstance(dev, dict):
            raise ValueError(f"device #{idx} must be object")
        for key in ("name", "id", "type"):
            if key not in dev:
                raise ValueError(f"device #{idx} missing '{key}'")
        if not isinstance(dev["name"], str) or not dev["name"]:
            raise ValueError(f"device #{idx} invalid name")
        try:
            int(dev["id"])
        except:
            raise ValueError(f"device #{idx} id not integer: {dev['id']}")
        
        ports = dev.get("ports", [])
        if not isinstance(ports, list):
            raise ValueError(f"device '{dev['name']}' ports must be list")
        for pidx, p in enumerate(ports, 1):
            if not isinstance(p, dict):
                raise ValueError(f"port #{pidx} of '{dev['name']}' not object")
            if "name" not in p or "direction" not in p:
                raise ValueError(f"port #{pidx} of '{dev['name']}' missing name/direction")
    
    conns = data.get("connections")
    if conns is not None:
        if not isinstance(conns, list):
            raise ValueError("'connections' must be list")
        for cidx, c in enumerate(conns, 1):
            if not isinstance(c, dict):
                raise ValueError(f"connection #{cidx} not object")
            for key in ("source_device", "source_port", "target_device", "target_port"):
                if key not in c:
                    raise ValueError(f"connection #{cidx} missing '{key}'")

print("Loading JSON...")
try:
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    sys.exit(f"Ошибка чтения файла: {e}")

print("Validating JSON structure...")
try:
    validate_json(data)
except ValueError as ve:
    sys.exit(f"JSON validation failed: {ve}")

print("JSON validation passed!")

# =========================================
# 2. ПЕРЕСОЗДАНИЕ БАЗЫ И НАСТРОЙКА ДОСТУПА
# =========================================
print("Recreating database and configuring HMI_User...")
try:
    with pyodbc.connect(MASTER_CONN, autocommit=True) as conn:
        cursor = conn.cursor()
        
        cursor.execute(f"""
            IF DB_ID('{DB_NAME}') IS NOT NULL 
            BEGIN 
                ALTER DATABASE {DB_NAME} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; 
                DROP DATABASE {DB_NAME}; 
            END""")
        cursor.execute(f"CREATE DATABASE {DB_NAME}")
        
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'HMI_User')
            BEGIN
                CREATE LOGIN HMI_User WITH PASSWORD = '12345', CHECK_POLICY = OFF;
            END
        """)

    with pyodbc.connect(DB_CONN, autocommit=True) as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'HMI_User')
            BEGIN
                CREATE USER HMI_User FOR LOGIN HMI_User;
                EXEC sp_addrolemember 'db_owner', 'HMI_User';
            END
        """)
    print("Database recreated. Login 'HMI_User' is ready.")

except Exception as e:
    sys.exit(f"Database configuration error: {e}")

# =========================================
# 3. СОЗДАНИЕ СТРУКТУРЫ И ВСТАВКА
# =========================================
with pyodbc.connect(DB_CONN, autocommit=True) as conn:
    cursor = conn.cursor()

    print("Creating tables...")
    cursor.execute("""
        CREATE TABLE Mechanisms (
            MechanismId INT PRIMARY KEY,
            Name NVARCHAR(100) NOT NULL UNIQUE,
            Type NVARCHAR(50) NOT NULL,
            Description NVARCHAR(255)
        );
        CREATE TABLE Ports (
            PortId INT IDENTITY(1,1) PRIMARY KEY,
            MechanismName NVARCHAR(100) NOT NULL,
            PortName NVARCHAR(100) NOT NULL,
            Direction NVARCHAR(10) NOT NULL,
            CanStart BIT NOT NULL,
            CanEnd BIT NOT NULL,
            ValvePosition INT NULL,
            Comment NVARCHAR(255)
        );
        CREATE TABLE Connections (
            FromMechanism NVARCHAR(100) NOT NULL,
            FromPort NVARCHAR(100) NOT NULL,
            ToMechanism NVARCHAR(100) NOT NULL,
            ToPort NVARCHAR(100) NOT NULL,
            Bidirectional NVARCHAR(5) DEFAULT 'FALSE',
            Comment NVARCHAR(255)
        );
       CREATE TABLE RouteCache (
    StartMechId INT NOT NULL, 
    EndMechId INT NOT NULL, 
    MidMechId INT NOT NULL DEFAULT 0, -- Новая колонка: 0 если путь прямой
    VariantId INT NOT NULL, 
    StepNum INT NOT NULL, 
    MechanismId INT NOT NULL, 
    RequiredState INT NOT NULL, 
    RoutePath NVARCHAR(MAX) NOT NULL, 
    CreatedAt DATETIME DEFAULT GETDATE(),
    
    -- Обновленный первичный ключ: теперь он уникален для каждой комбинации маршрута
    CONSTRAINT PK_RouteCache PRIMARY KEY (StartMechId, EndMechId, MidMechId, VariantId, StepNum)
);
    """)

    print("Processing devices...")
    for dev in data["devices"]:
        if not dev.get("name") or dev.get("id") is None:
            continue
            
        m_id = int(dev["id"])
        m_name = dev["name"]
        m_type = dev["type"]
        m_desc = dev.get("description", "")

        cursor.execute("INSERT INTO Mechanisms (MechanismId, Name, Type, Description) VALUES (?, ?, ?, ?)", 
                       m_id, m_name, m_type, m_desc)

        for p in dev.get("ports", []):
            can_start = 1 if (m_type == "Silos" and p["direction"].upper() == "OUT") else 0
            can_end = 1 if (m_type == "Silos" and p["direction"].upper() == "IN") else 0
            
            valve_pos = None
            if m_type == "Valve3P":
                port_name_upper = p["name"].upper()
                if "OUT1" in port_name_upper:
                    valve_pos = 3
                elif "OUT2" in port_name_upper:
                    valve_pos = 4
                elif "OUT3" in port_name_upper:
                    valve_pos = 5

            cursor.execute("""INSERT INTO Ports (MechanismName, PortName, Direction, CanStart, CanEnd, ValvePosition) 
                              VALUES (?, ?, ?, ?, ?, ?)""",
                           m_name, p["name"], p["direction"].upper(), can_start, can_end, valve_pos)

        for ic in dev.get("internal_connections", []):
            cursor.execute("""INSERT INTO Connections (FromMechanism, FromPort, ToMechanism, ToPort, Comment) 
                              VALUES (?, ?, ?, ?, ?)""",
                           m_name, ic["in_port"], m_name, ic["out_port"], "Internal")

    print("Inserting external connections...")
    for c in data["connections"]:
        cursor.execute("""INSERT INTO Connections (FromMechanism, FromPort, ToMechanism, ToPort, Comment) 
                          VALUES (?, ?, ?, ?, ?)""",
                       c["source_device"], c["source_port"], c["target_device"], c["target_port"], "External")

    cursor.execute("CREATE INDEX IX_Ports_Lookup ON Ports(MechanismName, PortName);")
    cursor.execute("CREATE INDEX IX_Conn_Lookup ON Connections(FromMechanism, FromPort);")

    print("Creating FindRoute procedure...")
    cursor.execute("""
    CREATE PROCEDURE FindRoute
           @StartMechId INT,
    @EndMechId INT,
    @MidMechId   INT = NULL, 
    @MaxDepth    INT = 45
AS
BEGIN
       SET NOCOUNT ON;
    
    DECLARE @ActualMidId INT = ISNULL(@MidMechId, 0);

    BEGIN TRY
        -- 1. ПРОВЕРКА КЭША (без ORDER BY внутри EXISTS)
        IF EXISTS (
            SELECT 1 FROM dbo.RouteCache 
            WHERE StartMechId = @StartMechId 
              AND EndMechId = @EndMechId 
              AND MidMechId = @ActualMidId
        )
        BEGIN
            SELECT VariantId, StepNum, MechanismId, RequiredState, RoutePath 
            FROM dbo.RouteCache 
            WHERE StartMechId = @StartMechId 
              AND EndMechId = @EndMechId
              AND MidMechId = @ActualMidId
            ORDER BY VariantId, StepNum;
            RETURN;
        END

        -- 2. ПОДГОТОВКА ИМЕН
        DECLARE @StartName NVARCHAR(255), @EndName NVARCHAR(255), @MidName NVARCHAR(255);
        SELECT @StartName = Name FROM Mechanisms WHERE MechanismId = @StartMechId;
        SELECT @EndName = Name FROM Mechanisms WHERE MechanismId = @EndMechId;
        
        IF @ActualMidId <> 0
            SELECT @MidName = Name FROM Mechanisms WHERE MechanismId = @ActualMidId;

        IF OBJECT_ID('tempdb..#StartPorts') IS NOT NULL DROP TABLE #StartPorts;
        SELECT PortId INTO #StartPorts FROM Ports 
        WHERE MechanismName = @StartName AND (CanStart = 1 OR Direction = 'OUT');

        DECLARE @EndPortId INT;
        SELECT TOP 1 @EndPortId = PortId FROM Ports WHERE MechanismName = @EndName AND CanEnd = 1;

        IF NOT EXISTS (SELECT 1 FROM #StartPorts) OR (@EndPortId IS NULL AND @EndMechId <> 0)
        BEGIN
            SELECT 0 AS VariantId, 0 AS StepNum, 0 AS MechanismId, 0 AS RequiredState, 
                   N'⚠️ ОШИБКА: Неверная конфигурация портов' AS RoutePath;
            RETURN;
        END

        -- 3. ПОИСК МАРШРУТА (CTE)
        IF OBJECT_ID('tempdb..#Routes') IS NOT NULL DROP TABLE #Routes;
        ;WITH RouteCTE AS (
            SELECT 
                c.ToMechanism, c.ToPort, CAST(sp.PortId AS NVARCHAR(4000)) AS PortIdPath, 1 AS Depth,
                CAST(',' + CAST(sp.PortId AS NVARCHAR(20)) + ',' AS NVARCHAR(4000)) AS VisitedPorts,
                CASE WHEN @MidName IS NOT NULL AND (c.ToMechanism = @MidName OR @StartName = @MidName) THEN 1 ELSE 0 END AS HasPassedMid
            FROM Connections c
            JOIN Ports pFrom ON pFrom.MechanismName = c.FromMechanism AND pFrom.PortName = c.FromPort
            JOIN #StartPorts sp ON pFrom.PortId = sp.PortId
            UNION ALL
            SELECT 
                c.ToMechanism, c.ToPort, r.PortIdPath + '>' + CAST(pTo.PortId AS NVARCHAR(20)), r.Depth + 1,
                r.VisitedPorts + CAST(pTo.PortId AS NVARCHAR(20)) + ',',
                CASE WHEN r.HasPassedMid = 1 OR c.ToMechanism = @MidName THEN 1 ELSE 0 END
            FROM Connections c
            JOIN RouteCTE r ON c.FromMechanism = r.ToMechanism AND c.FromPort = r.ToPort
            JOIN Ports pTo ON pTo.MechanismName = c.ToMechanism AND pTo.PortName = c.ToPort
            WHERE r.Depth < @MaxDepth AND r.VisitedPorts NOT LIKE '%,' + CAST(pTo.PortId AS NVARCHAR(20)) + ',%'
        )
        SELECT TOP 4 ROW_NUMBER() OVER (ORDER BY Depth, PortIdPath) AS VariantId, PortIdPath
        INTO #Routes FROM RouteCTE 
        WHERE ToMechanism = @EndName AND ToPort = (SELECT PortName FROM Ports WHERE PortId = @EndPortId)
          AND (@ActualMidId = 0 OR HasPassedMid = 1);

        -- 4. ПРОВЕРКА РЕЗУЛЬТАТА
        IF NOT EXISTS (SELECT 1 FROM #Routes)
        BEGIN
            SELECT 0 AS VariantId, 0 AS StepNum, 0 AS MechanismId, 0 AS RequiredState, 
                   N'❌ Путь не найден' AS RoutePath;
            RETURN;
        END

        -- 5. РАЗБОР МЕХАНИЗМОВ
        IF OBJECT_ID('tempdb..#UsedMechanisms') IS NOT NULL DROP TABLE #UsedMechanisms;
        ;WITH SplitPorts AS (
            SELECT r.VariantId, CAST(s.value AS INT) AS PortId, 
                   ROW_NUMBER() OVER (PARTITION BY r.VariantId ORDER BY (SELECT NULL)) AS PortOrder
            FROM #Routes r CROSS APPLY STRING_SPLIT(r.PortIdPath,'>') s
        ),
        MechsAll AS (
            SELECT sp.VariantId, m.MechanismId, m.Name AS MechanismName, m.Type, p.PortName AS UsedPort, sp.PortOrder
            FROM SplitPorts sp JOIN Ports p ON p.PortId = sp.PortId JOIN Mechanisms m ON m.Name = p.MechanismName
        ),
        -- Убираем только подряд идущие повторы (LAG)
        MechsDedup AS (
            SELECT VariantId, MechanismId, MechanismName, Type, UsedPort, PortOrder,
                   LAG(MechanismId) OVER (PARTITION BY VariantId ORDER BY PortOrder) AS PrevMechId
            FROM MechsAll
        )
        SELECT VariantId, MechanismId, MechanismName, Type, UsedPort, PortOrder
        INTO #UsedMechanisms FROM MechsDedup 
        WHERE PrevMechId IS NULL OR MechanismId <> PrevMechId;

        -- 6. КЛАПАНЫ И ПУТЬ СТРОКОЙ
        IF OBJECT_ID('tempdb..#ValvePorts') IS NOT NULL DROP TABLE #ValvePorts;
        SELECT DISTINCT r.VariantId, m.MechanismId, p.ValvePosition INTO #ValvePorts FROM #Routes r
        CROSS APPLY STRING_SPLIT(r.PortIdPath,'>') s
        JOIN Ports p ON p.PortId = TRY_CAST(s.value AS INT)
        JOIN Mechanisms m ON m.Name = p.MechanismName WHERE p.PortName LIKE '%OUT%';

        IF OBJECT_ID('tempdb..#PathStrings') IS NOT NULL DROP TABLE #PathStrings;
        SELECT VariantId, STRING_AGG(MechanismName, ' > ') WITHIN GROUP (ORDER BY PortOrder) AS RoutePath
        INTO #PathStrings FROM #UsedMechanisms GROUP BY VariantId;

        -- 7. ГЕНЕРАЦИЯ КОМАНД (ВЕРНУЛ ВСЕ ТИПЫ)
        IF OBJECT_ID('tempdb..#UnifiedOutput') IS NOT NULL DROP TABLE #UnifiedOutput;
        CREATE TABLE #UnifiedOutput (VariantId INT, StepOrder INT, MechanismId INT, RequiredState INT, IsStep BIT);

        INSERT INTO #UnifiedOutput (VariantId, StepOrder, MechanismId, RequiredState, IsStep)
        SELECT um.VariantId, um.PortOrder, um.MechanismId,
            CASE 
                WHEN um.Type = 'Valve3P' THEN ISNULL(vp.ValvePosition,3)
                WHEN um.Type IN ('Fan','Redler','Noria','Separator') THEN 1
                WHEN um.Type = 'Gate2P' THEN 7
                WHEN um.Type = 'Silos' THEN 8
                WHEN um.Type = 'Sushka' THEN 9
                WHEN um.Type='ReceivingPit' THEN 8
                ELSE 1 
            END, 1
        FROM #UsedMechanisms um
        LEFT JOIN #ValvePorts vp ON vp.VariantId = um.VariantId AND vp.MechanismId = um.MechanismId;

        -- ВЕРНУЛ ЗАКРЫТИЕ СМЕЖНЫХ ЗАДВИЖЕК
        INSERT INTO #UnifiedOutput (VariantId, StepOrder, MechanismId, RequiredState, IsStep)
        SELECT DISTINCT r.VariantId, 0, g.MechanismId, 6, 0
        FROM #Routes r
        JOIN #UsedMechanisms ur ON ur.VariantId = r.VariantId AND ur.Type IN ('Redler','Noria')
        JOIN Connections c ON c.FromMechanism = ur.MechanismName OR c.ToMechanism = ur.MechanismName
        JOIN Mechanisms g ON g.Type = 'Gate2P' AND (g.Name = c.FromMechanism OR g.Name = c.ToMechanism)
        WHERE NOT EXISTS (SELECT 1 FROM #UsedMechanisms u WHERE u.VariantId = r.VariantId AND u.MechanismId = g.MechanismId);

        -- 8. СОХРАНЕНИЕ В КЭШ
        DELETE FROM dbo.RouteCache WHERE StartMechId = @StartMechId AND EndMechId = @EndMechId AND MidMechId = @ActualMidId;

        INSERT INTO dbo.RouteCache (StartMechId, EndMechId, MidMechId, VariantId, StepNum, MechanismId, RequiredState, RoutePath)
        SELECT @StartMechId, @EndMechId, @ActualMidId, uo.VariantId, 
               ROW_NUMBER() OVER (PARTITION BY uo.VariantId ORDER BY uo.IsStep ASC, uo.StepOrder DESC), 
               uo.MechanismId, uo.RequiredState, ps.RoutePath 
        FROM #UnifiedOutput uo
        JOIN #PathStrings ps ON ps.VariantId = uo.VariantId;

        SELECT VariantId, StepNum, MechanismId, RequiredState, RoutePath 
        FROM dbo.RouteCache WHERE StartMechId = @StartMechId AND EndMechId = @EndMechId AND MidMechId = @ActualMidId
        ORDER BY VariantId, StepNum;

    END TRY
    BEGIN CATCH
        SELECT 0 AS VariantId, 0 AS StepNum, 0 AS MechanismId, 0 AS RequiredState, ERROR_MESSAGE() AS RoutePath;
    END CATCH
END
    """)

print("\n✅ БАЗА ДАННЫХ ГОТОВА!")
print(f"Импортировано устройств: {len(data['devices'])}")
