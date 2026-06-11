import json
import pyodbc
import os

# --- Конфигурация ---
SQL_SERVER = r'DESKTOP-4462UFF\SQLEXPRESS'
DB_NAME = 'ForceLog'
GRAPH_FILE = 'graph.json'

def run_initialization():
    print(f"--- Инициализация системы логирования форсировок ({DB_NAME}) ---")

    # 1. Проверка/Создание базы данных (мастер-подключение)
    master_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SQL_SERVER};DATABASE=master;Trusted_Connection=yes;'
    try:
        conn_master = pyodbc.connect(master_str, autocommit=True)
        cursor_master = conn_master.cursor()
        
        print(f"Пересоздание базы данных '{DB_NAME}'...")
        cursor_master.execute(f"""
            IF DB_ID('{DB_NAME}') IS NOT NULL 
            BEGIN 
                ALTER DATABASE [{DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; 
                DROP DATABASE [{DB_NAME}]; 
            END""")
        cursor_master.execute(f"CREATE DATABASE [{DB_NAME}]")
        
        # Создание логина HMI_User, если его нет
        cursor_master.execute("""
            IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'HMI_User')
            BEGIN
                CREATE LOGIN HMI_User WITH PASSWORD = '12345', CHECK_POLICY = OFF;
            END
        """)
        
        conn_master.close()
        print(f"[OK] База данных '{DB_NAME}' пересоздана.")
    except Exception as e:
        print(f"[ERROR] Не удалось создать БД: {e}")
        return

    # 2. Подключение к целевой базе
    db_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SQL_SERVER};DATABASE={DB_NAME};Trusted_Connection=yes;'
    conn = pyodbc.connect(db_str)
    cursor = conn.cursor()

    # Настройка прав пользователя в новой БД
    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'HMI_User')
        BEGIN
            CREATE USER HMI_User FOR LOGIN HMI_User;
            EXEC sp_addrolemember 'db_owner', 'HMI_User';
        END
    """)

    # 3. Создание таблиц
    print("Создание таблиц...")
    # Справочник определений битов
    cursor.execute("""
        IF OBJECT_ID('ForceDefinitions', 'U') IS NULL
        CREATE TABLE ForceDefinitions (
            [Category] NVARCHAR(10), -- 'STD' или 'DRY'
            [Bit] INT,
            [Description] NVARCHAR(100),
            PRIMARY KEY ([Category], [Bit])
        )
    """)
    # Справочник имен механизмов
    cursor.execute("""
        IF OBJECT_ID('MechDefinitions', 'U') IS NULL
        CREATE TABLE MechDefinitions (
            [SlotId] INT PRIMARY KEY,
            [Name] NVARCHAR(50),
            [Type] NVARCHAR(20)
        )
    """)
    # Хранилище последнего состояния (для детекции изменений битов)
    cursor.execute("""
        IF OBJECT_ID('MechForceStatus', 'U') IS NULL
        CREATE TABLE MechForceStatus (
            [SlotId] INT PRIMARY KEY,
            [LastForceCode] BIGINT DEFAULT 0 -- BIGINT для поддержки DWORD (32 бита)
        )
    """)
    # Основной лог событий
    cursor.execute("""
        IF OBJECT_ID('ForceEventLog', 'U') IS NULL
        CREATE TABLE ForceEventLog (
            [Id] INT IDENTITY(1,1) PRIMARY KEY,
            [Timestamp] DATETIME DEFAULT GETDATE(),
            [UserName] NVARCHAR(100),
            [MechName] NVARCHAR(50),
            [ForceName] NVARCHAR(100),
            [State] BIT
        )
    """)

    # 4. Создание хранимой процедуры
    print("Создание процедуры sp_LogForceChange...")
    cursor.execute("IF OBJECT_ID('sp_LogForceChange', 'P') IS NOT NULL DROP PROCEDURE sp_LogForceChange")
    
    sp_sql = """
    CREATE PROCEDURE [dbo].[sp_LogForceChange]
        @UserName NVARCHAR(100),
        @SlotId INT,
        @NewForceCode BIGINT -- Используем BIGINT для DWORD
    AS
    BEGIN
        SET NOCOUNT ON;
        DECLARE @OldForceCode BIGINT = 0;
        DECLARE @MechName NVARCHAR(50);
        DECLARE @MechType NVARCHAR(20);
        DECLARE @Category NVARCHAR(10);
        DECLARE @ChangedBits BIGINT;

        SELECT @MechName = [Name], @MechType = [Type] FROM MechDefinitions WHERE SlotId = @SlotId;
        IF @MechName IS NULL SET @MechName = 'Unknown Slot ' + CAST(@SlotId AS NVARCHAR);
        
        -- Определяем категорию битов
        SET @Category = CASE WHEN @MechType = 'Sushka' THEN 'DRY' ELSE 'STD' END;

        IF EXISTS (SELECT 1 FROM MechForceStatus WHERE SlotId = @SlotId)
            SELECT @OldForceCode = LastForceCode FROM MechForceStatus WHERE SlotId = @SlotId;
        ELSE
            INSERT INTO MechForceStatus (SlotId, LastForceCode) VALUES (@SlotId, 0);

        -- Оптимизация: определяем только изменившиеся биты через XOR
        SET @ChangedBits = @OldForceCode ^ @NewForceCode;

        IF @ChangedBits <> 0
        BEGIN
            DECLARE @bit INT = 0;
            WHILE @bit <= 31
            BEGIN
                DECLARE @mask BIGINT = POWER(CAST(2 AS BIGINT), @bit);
                
                -- Проверяем, изменился ли конкретный бит
                IF (CAST(@ChangedBits AS BIGINT) & @mask) <> 0
                BEGIN
                    DECLARE @ForceDesc NVARCHAR(100);
                    SELECT @ForceDesc = Description FROM ForceDefinitions 
                    WHERE Bit = @bit AND Category = @Category;

                    IF @ForceDesc IS NOT NULL
                    BEGIN
                        INSERT INTO ForceEventLog (UserName, MechName, ForceName, [State])
                        -- Явно вычисляем состояние: если бит в новом коде есть -> 1, если нет -> 0
                        VALUES (@UserName, @MechName, @ForceDesc, CASE WHEN (@NewForceCode & @mask) = @mask THEN 1 ELSE 0 END);
                    END
                END
                SET @bit = @bit + 1;
            END

            -- Оптимизация: Кольцевой буфер. Оставляем только 8000 последних записей
            DELETE FROM ForceEventLog 
            WHERE Id NOT IN (
                SELECT TOP 8000 Id FROM ForceEventLog ORDER BY [Timestamp] DESC, Id DESC
            );

            UPDATE MechForceStatus SET LastForceCode = @NewForceCode WHERE SlotId = @SlotId;
        END
    END
    """
    cursor.execute(sp_sql)

    # 5. Заполнение словаря форсировок
    print("Заполнение справочников битов...")
    
    # Стандартные механизмы
    std_forces = [
        (0, 'Force_Breaker'), (1, 'Force_Overflow'), (2, 'Force_NoRunFB'), 
        (3, 'Force_Alignment'), (4, 'Force_MoveTimeout'), (5, 'Force_PosUnknown'), 
        (6, 'Force_StopTimeout'), (8, 'Force_NoFeedback'), (9, 'Force_HighLevel'), 
        (10, 'Force_IgnoreGrainType')
    ]
    
    # Сушилка (согласно структуре из 30 бит)
    dry_forces = []
    for i in range(1, 8):
        dry_forces.append((i-1, f'Force_Fan{i}_Breaker'))
        dry_forces.append((i+6, f'Force_Fan{i}_Feedback'))
    
    dry_forces += [
        (14, 'Force_Burner1_Breaker'), (15, 'Force_Burner2_Breaker'),
        (16, 'Force_Burner1_Feedback'), (17, 'Force_Burner2_Feedback'),
        (18, 'Force_Burner1_Temp'), (19, 'Force_Burner2_Temp'),
        (20, 'Force_Burner1_Alarm'), (21, 'Force_Burner2_Alarm'),
        (22, 'Force_Burner1_Auto'), (23, 'Force_Burner2_Auto'),
        (24, 'Force_Discharge_Feedback'), (25, 'Force_LevelHigh'), (26, 'Force_LevelLow'),
        (27, 'Force_Temp_Td'),
        (28, 'Force_Temp_Tp'),
        (29, 'Force_Temp_Tg'),
        (30, 'Force_Temp_PW')
    ]

    # Очистка и вставка (для обновления если скрипт запущен повторно)
    cursor.execute("TRUNCATE TABLE ForceDefinitions")
    for b, desc in std_forces:
        cursor.execute("INSERT INTO ForceDefinitions (Category, Bit, Description) VALUES ('STD', ?, ?)", b, desc)
    for b, desc in dry_forces:
        cursor.execute("INSERT INTO ForceDefinitions (Category, Bit, Description) VALUES ('DRY', ?, ?)", b, desc)

    # 6. Синхронизация имен из graph.json
    if os.path.exists(GRAPH_FILE):
        print(f"Синхронизация имен из {GRAPH_FILE}...")
        with open(GRAPH_FILE, 'r', encoding='utf-8') as f:
            devices = json.load(f).get('devices', [])
            for dev in devices:
                cursor.execute("""
                    IF EXISTS (SELECT 1 FROM MechDefinitions WHERE SlotId = ?) 
                        UPDATE MechDefinitions SET Name = ?, Type = ? WHERE SlotId = ? 
                    ELSE 
                        INSERT INTO MechDefinitions (SlotId, Name, Type) VALUES (?, ?, ?)
                """, (int(dev['id']), dev['name'], dev['type'], int(dev['id']), int(dev['id']), dev['name'], dev['type']))
    
    conn.commit()
    conn.close()
    print("[DONE] Инициализация завершена успешно.")

if __name__ == "__main__":
    run_initialization()
