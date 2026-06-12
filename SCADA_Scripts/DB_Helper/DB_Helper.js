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


export function Id_Name(ID) {
    const deviceMap = {
        0: "",    1: "RD1",  2: "RD2", 3: "RD3",  4: "RD4",  5: "RD5",  6: "RD6",
        7: "RD7",  8: "RD8",  9: "RD9",  10: "RD10",  11: "RD11",  12: "RD12",
        13: "RD13",  14: "RD14",  15: "RD15", 16: "RD16",  17: "RD17",  18: "RD18",
        19: "RD19", 20: "RD20", 21: "RD21", 22: "RD22", 23: "RD23", 24: "RD24",
        25: "RD25", 26: "RD26",  27: "RD27",  28: "RD28",  29: "RD29",  30: "RD30",  31: "RD31",
        32: "RD32", 33: "RD33", 34: "RD34",  35: "RD35",  36: "RD36",  37: "RD37",
        38: "RD38", 39: "RD39",  51: "NR1",  52: "NR2",  53: "NR3",  54: "NR4", 55: "NR5",
        56: "NR6", 57: "NR7", 58: "NR8", 59: "NR9", 60: "NR10", 61: "NR11", 62: "NR12",
        116: "GT5.1", 117: "GT5.2", 118: "GT5.3", 119: "GT36.3", 125: "GT15.1",
        126: "GT15.2", 127: "GT6.1", 128: "GT6.2", 129: "GT6.3", 130: "GT36.2",
        131: "GT9.2", 132: "GT7.2", 133: "GT9.1", 134: "GT11.3", 135: "GT7.3",
        136: "GT11.1", 137: "GT7.1", 138: "GT11.2", 139: "GT21.1", 140: "GT36.1",
        141: "GT30.2", 142: "GT30.1", 143: "GT21.2", 144: "GT21.3", 145: "GT24.1",
        146: "GT21.4", 147: "GT24.2", 148: "GT18.1", 149: "GT18.2", 150: "GT19.1",
        151: "GT19.2", 152: "GT35.2", 153: "GT10.2", 154: "GT10.1", 155: "GT8.3",
        156: "GT8.2", 157: "GT12.1", 158: "GT8.1", 159: "GT12.2", 160: "GT35.1",
        161: "GT14.2", 162: "GT14.1", 163: "GT31.2", 164: "GT31.1",  165: "GT22.1",
        166: "GT22.2",167: "GT22.3",168: "GT22.4",  169: "GT25.1",  170: "GT25.2",  171: "GT32.2",
        172: "GT20.1", 173: "GT20.2", 174: "GT32.1", 175: "GT23.1",  176: "GT23.2",
        177: "GT23.3",  178: "GT23.4",  179: "GT26.1",  180: "GT26.2", 181: "GT38.1",
        182: "GT38.2", 201: "VL1",  202: "VL2",  203: "VL3", 204: "VL4",
        205: "VL5", 206: "VL6", 207: "VL7", 208: "VL8", 209: "VL9", 210: "VL10",
        211: "Vl11", 212: "VL12", 213: "VL13", 214: "VL14", 215: "VL15",
        216: "VL16", 217: "VL17", 218: "VL18", 219: "VL19", 220: "VL20",
        221: "VL21", 222: "VL22", 223: "VL23", 224: "VL24", 225: "VL25",
        226: "VL26", 227: "VL27", 228: "VL28", 229: "VL29", 230: "VL30",
        251: "Auto1", 252: "Auto1", 253: "Auto2", 254: "Auto2", 255: "SLA1",
        256: "SLA2",  257: "SPA1",  258: "SPA2",  259: "SPA3",  260: "SPA4",
        261: "SPA5", 262: "SLA4", 263: "SLA3", 264: "SPA6", 265: "SPA7",
        266: "SPA8", 267: "SPA9", 268: "SPA10", 269: "Auto3", 270: "Auto3",
        271: "SPA11", 272: "SPA12", 273: "SPA13", 274: "SPA14", 275: "SPA15",
        276: "ZHD", 277: "ARB1", 278: "ARB2",  301: "DR1", 302: "DR2",
        303: "DR3", 304: "DR4", 305: "RP1", 306: "RP2", 311: "KBS1",
        312: "KBS2", 313: "KBS3", 314: "FD1", 315: "FD2", 316: "FD3",
        317: "FN1", 318: "FN2", 319: "FN3",
    };
    return deviceMap[ID] ?? `Unknown (ID: ${ID})`;


}


export async function LogForceChange(slotId, forceCode) {
    let user = Tags("@UserName").Read();
    if (!user) user = "No User";

    const connectionString = "DSN=ForceLog;UID=HMI_User;PWD=12345;";
    let conn = null;

    try {
        // Создаем подключение
        conn = await HMIRuntime.Database.CreateConnection(connectionString);
        
        // Формируем вызов хранимой процедуры sp_LogForceChange
        // Процедура сама разберет, какие биты изменились, и сопоставит имена из MechDefinitions
        const sql = `EXEC [dbo].[sp_LogForceChange] @UserName='${user}', @SlotId=${slotId}, @NewForceCode=${forceCode}`;
        HMIRuntime.Trace(sql);
        await conn.Execute(sql);
        
        // HMIRuntime.Trace(`Force log updated for SlotId: ${slotId}`);
    } catch (err) {
        HMIRuntime.Trace("Force logging SQL error: " + err.message);
    } finally {
        conn = null;
    }
}

export async function LogOperator(SlotId, Message) {
// Корректный способ получения имени пользователя в WinCC Unified
    let user = Tags("@UserName").Read();
    if (!user) user = "No User";

    const connectionString = "DSN=OperatorLog;UID=HMI_User;PWD=12345;TrustServerCertificate=yes;";
    let conn = null;

    try {
        conn = await HMIRuntime.Database.CreateConnection(connectionString);
        // Вызываем хранимую процедуру sp_LogAction, созданную Python-скриптом
        const sql = `EXEC [dbo].[sp_LogAction] @UserName='${user}', @SlotId=${SlotId}, @ActionText='${Message}'`;
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
