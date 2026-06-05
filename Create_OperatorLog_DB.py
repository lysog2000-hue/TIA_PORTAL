import json
import pyodbc
import os

# --- Конфигурация ---
SQL_SERVER = r'DESKTOP-4462UFF\SQLEXPRESS'
DB_NAME = 'OperatorLog'
GRAPH_FILE = 'graph.json'

def run_initialization():
    print(f"--- Инициализация системы логирования действий оператора ({DB_NAME}) ---")

    # 1. Пересоздание базы данных
    master_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SQL_SERVER};DATABASE=master;Trusted_Connection=yes;TrustServerCertificate=yes;'
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
        
        # Проверка логина HMI_User
        cursor_master.execute("""
            IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'HMI_User')
            BEGIN
                CREATE LOGIN HMI_User WITH PASSWORD = '12345', CHECK_POLICY = OFF;
            END
        """)
        conn_master.close()
    except Exception as e:
        print(f"[ERROR] Ошибка на уровне Master: {e}")
        return

    # 2. Подключение к новой базе
    db_str = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={SQL_SERVER};DATABASE={DB_NAME};Trusted_Connection=yes;TrustServerCertificate=yes;'
    conn = pyodbc.connect(db_str)
    cursor = conn.cursor()

    # Настройка прав
    cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'HMI_User')
        BEGIN
            CREATE USER HMI_User FOR LOGIN HMI_User;
            EXEC sp_addrolemember 'db_owner', 'HMI_User';
        END
    """)

    # 3. Создание таблиц
    print("Создание таблиц...")
    # Справочник механизмов
    cursor.execute("""
        CREATE TABLE MechDefinitions (
            [SlotId] INT PRIMARY KEY,
            [Name] NVARCHAR(50)
        )
    """)

    # Основной лог действий
    cursor.execute("""
        CREATE TABLE OperatorActionLog (
            [Id] INT IDENTITY(1,1) PRIMARY KEY,
            [Timestamp] DATETIME DEFAULT GETDATE(),
            [UserName] NVARCHAR(100),
            [SlotId] INT,
            [MechName] NVARCHAR(50),
            [ActionText] NVARCHAR(MAX)
        )
    """)

    # 4. Создание хранимой процедуры для записи
    print("Создание процедуры sp_LogAction...")
    sp_sql = """
    CREATE PROCEDURE [dbo].[sp_LogAction]
        @UserName NVARCHAR(100),
        @SlotId INT,
        @ActionText NVARCHAR(MAX)
    AS
    BEGIN
        SET NOCOUNT ON;
        DECLARE @MechName NVARCHAR(50);

        -- Ищем имя механизма по ID
        SELECT @MechName = [Name] FROM MechDefinitions WHERE SlotId = @SlotId;
        IF @MechName IS NULL SET @MechName = 'System';

        INSERT INTO OperatorActionLog (UserName, SlotId, MechName, ActionText)
        VALUES (@UserName, @SlotId, @MechName, @ActionText);

        -- Ограничение: храним только последние 10 000 действий
        DELETE FROM OperatorActionLog 
        WHERE Id NOT IN (SELECT TOP 10000 Id FROM OperatorActionLog ORDER BY Timestamp DESC, Id DESC);
    END
    """
    cursor.execute(sp_sql)

    # 5. Синхронизация имен из graph.json
    if os.path.exists(GRAPH_FILE):
        print(f"Синхронизация имен из {GRAPH_FILE}...")
        with open(GRAPH_FILE, 'r', encoding='utf-8') as f:
            devices = json.load(f).get('devices', [])
            for dev in devices:
                cursor.execute("INSERT INTO MechDefinitions (SlotId, Name) VALUES (?, ?)", 
                               (int(dev['id']), dev['name']))
    
    conn.commit()
    conn.close()
    print(f"[DONE] База {DB_NAME} готова к работе.")

if __name__ == "__main__":
    run_initialization()