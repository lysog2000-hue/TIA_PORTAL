// GlobalDefinitions.js{ 
// Глобальные переменные и вспомогательные функции для работы с маршрутами
// Используется в: Globaldefinition area WinCC Unified

let routeBuffer = [];
let variantList = []; // Здесь будем хранить {id, path}
let cachedRoute = [];
//}

export function Button_Base(slot) {
    if (slot >= 1 && slot <= 50) {
        return "Base_Redler";
    } else if (slot >= 51 && slot <= 99) {
        return "Base_Noria";
    } else if (slot >= 100 && slot <= 240) {
        return "Base";
    } else if (slot >= 300 && slot <= 304) {
        return "Base";
    } else if (slot >= 251 && slot <= 278) {
        return "Base_Silos";
    } else if (slot >= 311 && slot <= 313) {
        return "Base_Separator";
    } else if (slot >= 314 && slot <= 316) {
        return "Base_Feeder";
    } else if (slot >= 317 && slot <= 319) {
        return "Base_Fan";
    }
    return null;
}

export function Button_Control(slot) {
    if (slot >= 1 && slot <= 99) {
        return "Control";
    } else if (slot >= 100 && slot <= 199) {
        return "Control_Gate2p";
    } else if (slot >= 201 && slot <= 240) {
        if (slot === 219) {
            return "Control_Valve3P";
        }
        return "Control_Valve2P";
    } else if (slot >= 300 && slot <= 319) {
        return "Control";
    }
    return null;
}

export function Button_Force(slot) {
if (slot >= 1 && slot <= 50) {
        return "Force_Redler";
    } else if (slot >= 51 && slot <= 99) {
        return "Force_Noria";
    } else if (slot >= 100 && slot <= 250) {
        return "Force_Gate_Valve";
    } else if (slot >= 251 && slot <= 300) {
        return "Force_Silos";
    } else if (slot >= 311 && slot <= 313) {
        return "Force_Separator";
    } else if (slot >= 314 && slot <= 316) {
        return "Force_Feeder";
    } else if (slot >= 317 && slot <= 319) {
        return "Force_Fan";
    }
    return null;
}

export function GetActiveRouteData(vIdFromScreen) {
// Чистим входящий ID через стандартный Number
    let vId = Number(vIdFromScreen);
    
    if (routeBuffer.length === 0 || isNaN(vId)) return [];

    return routeBuffer
        .filter(item => item.VariantId === vId)
        .map(item => ({
            id: item.MechanismId,
            state: item.RequiredState
        }));
}


export function GetGateColor(Status, ownerId) {
    
    const colors = {
        lightGreen:  0xFF99CC00,   // Status=1: светло-зеленый
        lightBlue:   0xFF00FFFF,   // Status=3: светло-синий
        green:       0xFF00FF00,   // Status=2: зелёный (local/manual)
        red:         0xFFFF0000,   // Status=4: красный
        basic:       0xFF808080    // Серый по умолчанию
    };

    let newColor;
    switch(Number(Status)) {
        case 7:
            if (ownerId !== 0) {
                newColor = Tags(`RouteColor${ownerId}`).Read();
            } else {
                newColor = colors.green;  // Зелёный для Status=2 без маршрута
            }
            break;
        case 9:
            newColor = colors.red;
            break;
        default:
            newColor = colors.basic;
    }
    return newColor;
}

export function GetMechColor(Status, ownerId) {
    
    const colors = {
        lightGreen:  0xFF99CC00,   // Status=1: светло-зеленый
        lightBlue:   0xFF00FFFF,   // Status=3: светло-синий
        green:       0xFF00FF00,   // Status=2: зелёный (local/manual)
        red:         0xFFFF0000,   // Status=4: красный
        basic:       0xFF808080    // Серый по умолчанию
    };

    let newColor;
    switch(Number(Status)) {
        case 1:
            newColor = colors.lightGreen;
            break;
        case 2:
            if (ownerId !== 0) {
                newColor = Tags(`RouteColor${ownerId}`).Read();
            } else {
                newColor = colors.green;  // Зелёный для Status=2 без маршрута
            }
            break;
        case 3:
            newColor = colors.lightBlue;
            break;
        case 4:
            newColor = colors.red;
            break;
        case 10:
            newColor = colors.red;
            break;
        default:
            newColor = colors.basic;
    }
    return newColor;
}


export function GetStepsByVariant(vId) {
return routeBuffer.filter(row => row.VariantId == vId);
}


export function GetValveCenterColor(Status, ownerId) {
    
    const colors = {
        lightGreen:  0xFF99CC00,   // Status=1: светло-зеленый
        lightBlue:   0xFF00FFFF,   // Status=3: светло-синий
        green:       0xFF00FF00,   // Status=2: зелёный (local/manual)
        red:         0xFFFF0000,   // Status=4: красный
        basic:       0xFF808080    // Серый по умолчанию
    };

    let newColor;
    switch(Number(Status)) {
        case 5:
            if (ownerId !== 0) {
                newColor = Tags(`RouteColor${ownerId}`).Read();
            } else {
                newColor = colors.green;  // Зелёный для Status=2 без маршрута
            }
            break;
        case 9:
            newColor = colors.red;
            break;
        default:
            newColor = colors.basic;
    }
    return newColor;
}

export function GetValveLeftColor(Status, ownerId) {
    
    const colors = {
        lightGreen:  0xFF99CC00,   // Status=1: светло-зеленый
        lightBlue:   0xFF00FFFF,   // Status=3: светло-синий
        green:       0xFF00FF00,   // Status=2: зелёный (local/manual)
        red:         0xFFFF0000,   // Status=4: красный
        basic:       0xFF808080    // Серый по умолчанию
    };

    let newColor;
    switch(Number(Status)) {
        case 3:
            if (ownerId !== 0) {
                newColor = Tags(`RouteColor${ownerId}`).Read();
            } else {
                newColor = colors.green;  // Зелёный для Status=2 без маршрута
            }
            break;
        case 9:
            newColor = colors.red;
            break;
        default:
            newColor = colors.basic;
    }
    return newColor;
}


export function GetValveRightColor(Status, ownerId) {
    
    const colors = {
        lightGreen:  0xFF99CC00,   // Status=1: светло-зеленый
        lightBlue:   0xFF00FFFF,   // Status=3: светло-синий
        green:       0xFF00FF00,   // Status=2: зелёный (local/manual)
        red:         0xFFFF0000,   // Status=4: красный
        basic:       0xFF808080    // Серый по умолчанию
    };

    let newColor;
    switch(Number(Status)) {
        case 4:
            if (ownerId !== 0) {
                newColor = Tags(`RouteColor${ownerId}`).Read();
            } else {
                newColor = colors.green;  // Зелёный для Status=2 без маршрута
            }
            break;
        case 9:
            newColor = colors.red;
            break;
        default:
            newColor = colors.basic;
    }
    return newColor;
}




export function GetVariantFromBuffer(variantId) {
    let target = parseInt((variantId + "").replace(/[^\d]/g, '')) || 0;
    return routeBuffer.filter(row => row.VariantId === target);
}

export function GetVariantList(parameter1, parameter2) {
return variantList;
}


export async function LogForceChange(slotId, forceCode) {
  // Используем созданный DSN и пользователя с правами db_owner
    const connectionString = "DSN=ForceLog;UID=HMI_User;PWD=12345;TrustServerCertificate=yes;";
    let conn = null;

    try {
        // Создаем подключение
        conn = await HMIRuntime.Database.CreateConnection(connectionString);
        
        // Формируем вызов хранимой процедуры sp_LogForceChange
        // Процедура сама разберет, какие биты изменились, и сопоставит имена из MechDefinitions
        const sql = `EXEC [dbo].[sp_LogForceChange] @SlotId=${slotId}, @NewForceCode=${forceCode}`;
        HMIRuntime.Trace(sql);
        await conn.Execute(sql);
        
        // HMIRuntime.Trace(`Force log updated for SlotId: ${slotId}`);
    } catch (err) {
        HMIRuntime.Trace("Force logging SQL error: " + err.message);
    } finally {
        conn = null;
    }
}

/**
 * Логирование действий оператора в БД OperatorLog
 * @param {Number} slotId - ID механизма
 * @param {String} actionText - Описание действия
 */
export async function LogOperatorAction(slotId, actionText) {
    // Корректный способ получения имени пользователя в WinCC Unified
    let user = HMIRuntime.Resources.UserName;
    if (!user) user = "No User";

    const connectionString = "DSN=OperatorLog;UID=HMI_User;PWD=12345;TrustServerCertificate=yes;";
    let conn = null;

    try {
        conn = await HMIRuntime.Database.CreateConnection(connectionString);
        // Вызываем хранимую процедуру sp_LogAction, созданную Python-скриптом
        const sql = `EXEC [dbo].[sp_LogAction] @UserName='${user}', @SlotId=${slotId}, @ActionText='${actionText}'`;
        await conn.Execute(sql);
    } catch (err) {
        HMIRuntime.Trace("Operator logging SQL error: " + err.message);
    } finally {
        conn = null;
    }
}




export function OnMechTapped(item) {
let mode = Tags("SelectModeActive").Read();
    if (mode === 0) return;
    
    Tags("SelectModeActive").Write(0);
    
    let slotId = parseInt(item.Name.replace(/[^0-9]/g, ""), 10);
    if (isNaN(slotId)) return;
    
    switch (mode) {
        case 1: Tags("StartPortId").Write(slotId); break;
        case 2: Tags("EndPortId").Write(slotId);  break;
        case 3: Tags("MidPortId").Write(slotId);   break;
    }
}


export function resetMechanism(obj) {
    try { if (obj.Properties.Contur === 0xFFF00000){return;} } catch(e) {}
    try { obj.Properties.Contur = 0xFF000000; } catch(e) {}
    try { obj.Properties.MainContur = 0xFF000000; } catch(e) {}
    try { obj.Properties.LeftContur = 0xFF000000; } catch(e) {}
    try { obj.Properties.RightContur = 0xFF000000; } catch(e) {}
}

export async function RunQueryAndCache(startId, endId, midId) {
let connectionString = "DSN=ElevatorRouting;UID=HMI_User;PWD=12345;TrustServerCertificate=yes;";
// Используем Number() напрямую, чтобы гарантировать числа на входе в SQL

    let sqlQuery = "EXEC dbo.FindRoute " + Number(startId) + ", " + Number(endId)+", " + Number(midId);
    let conn = null;

    try {
        conn = await HMIRuntime.Database.CreateConnection(connectionString);
        let queryResult = await conn.Execute(sqlQuery);
        
        let firstResultSet = null;
        for (let key in queryResult.Results) {
            if (queryResult.Results[key] && queryResult.Results[key].Rows) {
                firstResultSet = queryResult.Results[key];
                break;
            }
        }

        if (!firstResultSet) return 0;

        routeBuffer = [];
        variantList = []; 
        let processedVariants = new Set(); 
        
        let rows = firstResultSet.Rows;

        for (let key in rows) {
            let row = rows[key];

            // Используем стандартный Number()
            let vId = Number(row["VariantId"]);
            let rPath = String(row["RoutePath"] || ""); 

            if (!processedVariants.has(vId)) {
                variantList.push({
                    VariantId: vId,
                    RoutePath: rPath
                });
                processedVariants.add(vId);
            }

            routeBuffer.push({
                VariantId:     vId,
                StepNum:       Number(row["StepNum"]),
                MechanismId:   Number(row["MechanismId"]),
                RequiredState: Number(row["RequiredState"])
            });
        }

        HMIRuntime.Trace("SQL: Найдено вариантов: " + variantList.length);
        return variantList.length;

    } catch (err) {
        HMIRuntime.Trace("SQL ERROR: " + err);
        return -1;
    } finally {
        if (conn) { try { await conn.Close(); } catch(e) {} }
    }
}

export function SetRouteData(data) {
routeBuffer = data;
}
