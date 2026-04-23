// GlobalDefinitions.js{ 
// Глобальные переменные и вспомогательные функции для работы с маршрутами
// Используется в: Globaldefinition area WinCC Unified

let routeBuffer = [];
let variantList = []; // Здесь будем хранить {id, path}
let cachedRoute = [];
//}

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

export function GetStepsByVariant(vId) {
    return routeBuffer.filter(row => row.VariantId == vId);
}

export function GetVariantFromBuffer(variantId) {
    let target = parseInt((variantId + "").replace(/[^\d]/g, '')) || 0;
    return routeBuffer.filter(row => row.VariantId === target);
}

export function GetVariantList(parameter1, parameter2) {
    return variantList;
}

export function resetMechanism(obj) {
    try { obj.Properties.Contur = 0xFF000000; } catch(e) {}
    try { obj.Properties.MainContur = 0xFF000000; } catch(e) {}
    try { obj.Properties.LeftContur = 0xFF000000; } catch(e) {}
    try { obj.Properties.RightContur = 0xFF000000; } catch(e) {}
}

export async function RunQueryAndCache(startId, endId, midId) {
    let connectionString = "DSN=ElevatorRouting;UID=HMI_User;PWD=12345;";

    let sqlQuery = "EXEC dbo.FindRoute " + Number(startId) + ", " + Number(endId) + ", " + Number(midId);
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
