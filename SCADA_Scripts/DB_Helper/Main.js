// Main.js
// Основные обработчики кнопок для работы с маршрутами
// Импорт из GlobalDefinitions.js (DB_Helper)
//КНОПКА ВЫЗОВА СПИСКА МАРШРУТОВ
import { GetActiveRouteData, GetStepsByVariant, GetVariantFromBuffer, GetVariantList, RunQueryAndCache, SetRouteData, resetMechanism } from "DB_Helper";

export async function Open_Route_OnTapped(item, x, y, modifiers, trigger) {
let startId = Tags("StartPortId").Read();
    let endId = Tags("EndPortId").Read();
let midId = Tags("MidPortId").Read();

    // Сброс интерфейса
    Tags("TableDataString").Write("");
    Tags("SelectedVariantId").Write(0);
    let count = await RunQueryAndCache(startId, endId, midId);
   
    if (count > 0) {
        let variants = GetVariantList();

        // Формируем минималистичную структуру (один столбец)
        let columns = [
            { "title": "Route", "field": "R", "width": 1200 }
        ];
        Tags("ColumnStyle").Write(JSON.stringify(columns));

        // Максимально короткие ключи в JSON (вместо "Route" пишем "R")
        let rows = variants.map((v) => ({
            "R": v.RoutePath
        }));

        let finalJson = JSON.stringify(rows);
        HMIRuntime.Trace("JSON Length: " + finalJson.length); 

        Tags("TableDataString").Write(finalJson);
        
        HMIRuntime.Trace("SQL Success: " + count + " variants loaded");

    }

}



//ФУНКЦИЯ ПОКРАСКИ МЕХАНИЗМОВ 
export function Circle_5_BackColor_OnPropertyChanged(item, value) {
    let previousColor = Tags("CurrentRouteColor").Read(); // Запоминаем предыдущий цвет

    const ROUTE_OK_RUNNING = 32768;
    const RS_State_OK =4;
    let routeIdx = 0;
    for (let r = 1; r <= 4; r++) {
        let rc = Tags(`ResultCode_Route${r}`).Read();
        let rs = Tags(`RS_State${r}`).Read()
        if (rc !== ROUTE_OK_RUNNING&& rs !==RS_State_OK) {
            routeIdx = r;
            break;
        }
    }
    if (routeIdx === 0) {
        HMIRuntime.Trace("Все 4 маршрути зайняті");
        return;
    }
    let routeColor = Tags("RouteColor" + routeIdx).Read();
    Tags("CurrentRouteColor").Write(routeColor); // Обновляем на новый цвет

    let vId = Tags("SelectedVariantId").Read();
    let activeColor = routeColor; // Используем новый цвет для покраски

    if (vId > 0) {
        let activeRouteData = GetActiveRouteData(vId); 
        let screenItems = Screen.Items;

        // Сброс линий предыдущего маршрута (окрашенных в previousColor)
        for (let i = 0; i < screenItems.Count; i++) {
            let obj = screenItems.Item(i);
            if (obj.Name && obj.Name.startsWith("L_")) {
                if (obj.LineColor === previousColor) {
                    obj.LineColor = 0xFF000000; // Черный
                    obj.LineWidth = 1;
                }
            }
        }

        // Сброс механизмов предыдущего маршрута
        for (let i = 0; i < screenItems.Count; i++) {
            let obj = screenItems.Item(i);
            if (obj.Name && obj.Name.startsWith("M_")) {
                let mechId = parseInt(obj.Name.replace("M_", ""));
                let found = activeRouteData.find(m => m.id === mechId);
                if (found) {
                    // Сброс только если окрашен в previousColor
                    try { if (obj.Properties.Contur === previousColor) obj.Properties.Contur = 0xFF000000; } catch (e) {}
                    try { if (obj.Properties.CenterContur === previousColor) obj.Properties.CenterContur = 0xFF000000; } catch (e) {}
                    try { if (obj.Properties.LeftContur === previousColor) obj.Properties.LeftContur = 0xFF000000; } catch (e) {}
                    try { if (obj.Properties.RightContur === previousColor) obj.Properties.RightContur = 0xFF000000; } catch (e) {}
                }
            }
        }

        // Теперь красим механизмы в новый цвет
        for (let i = 0; i < screenItems.Count; i++) {
            let obj = screenItems.Item(i);
            
            if (obj.Name && obj.Name.startsWith("M_")) {
                let mechId = parseInt(obj.Name.replace("M_", ""));
                let found = activeRouteData.find(m => m.id === mechId);

                if (found) {
                    // Сначала сбрасываем всё в "нейтральное" состояние перед применением логики
                    resetMechanism(obj);

                    let state = found.state;
                    
                    let errorColor = 0xFFFF0000;  // Красный для state 0

                    try {
                        if (state === 6) {
                            // Команда 0 -> Красим весь механизм в красный
                            obj.Properties.Contur = errorColor;
                        } 
                        else if (state === 3) {
                            // Команда 3 -> Только правая часть
                            obj.Properties.LeftContur = activeColor;
                        } 
                        else if (state === 4) {
                            // Команда 4 -> Только левая часть
                            obj.Properties.RightContur = activeColor;
                        } 
                        else if (state === 5) {
                            // Команда 5 -> Только центр
                            obj.Properties.CenterContur = activeColor;
                        } 
                        else {
                            // Любой другой state > 0 -> общий цвет (например, оранжевый или зеленый)
                            obj.Properties.Contur = activeColor;
                        }
                    } catch (e) {
                        // Если какого-то свойства нет в конкретном SVG, скрипт не упадет
                    }

                } else {
                    // Механизм не в маршруте — сброс в серый/прозрачный
                    resetMechanism(obj);
                }
            }
        }

        // Красим линии в новый цвет
        for (let i = 0; i < activeRouteData.length - 1; i++) {
            let from = activeRouteData[i+1].id;
            let to = activeRouteData[i].id;
            let lineName = `L_${from}_${to}`;

            for (let j = 0; j < screenItems.Count; j++) {
                let candidate = screenItems.Item(j);
                if (candidate.Name) {
                    let name = candidate.Name.trim();
                    let idx = name.indexOf(lineName);
                    if (idx !== -1) {
                        let afterIdx = idx + lineName.length;
                        let nextChar = name.charAt(afterIdx);
                        let isBoundary = (
                            afterIdx >= name.length ||
                            !/^\d/.test(nextChar) ||
                            name.substring(afterIdx).startsWith('L_')
                        );

                        if (isBoundary) {
                            try {
                                candidate.LineColor = activeColor;
                                candidate.LineWidth = 3;
                            } catch (e) {
                                // Игнорируем ошибки свойств
                            }
                        }
                    }
                }
            }
        }
    }
    return value;
}



// МОТОЧАСИ — завантаження з SQL в таблицю

export async function Btn_OpenMotoHours_OnTapped(item, x, y, modifiers, trigger) {
    let connectionString = "DSN=RunTime;UID=HMI_User;PWD=12345;";
    let conn = null;

    try {
        conn = await HMIRuntime.Database.CreateConnection(connectionString);

        let queryResult = await conn.Execute("SELECT Name, Type, TotalHours FROM vw_RunTimeHours ORDER BY Type, Name");

        let firstResultSet = null;
        for (let key in queryResult.Results) {
            if (queryResult.Results[key] && queryResult.Results[key].Rows) {
                firstResultSet = queryResult.Results[key];
                break;
            }
        }

        if (!firstResultSet) {
            HMIRuntime.Trace("MotoHours: no result set");
            return;
        }

        let d = new Date();
        let now = String(d.getDate()).padStart(2,"0") + "."
                + String(d.getMonth()+1).padStart(2,"0") + "."
                + d.getFullYear() + " "
                + String(d.getHours()).padStart(2,"0") + ":"
                + String(d.getMinutes()).padStart(2,"0") + ":"
                + String(d.getSeconds()).padStart(2,"0");

        let rows = firstResultSet.Rows;
        let tableRows = [];

        for (let key in rows) {
            let row = rows[key];
            tableRows.push({
                "name":    String(row["Name"]       || ""),
                "type":    String(row["Type"]       || ""),
                "hours":   String(row["TotalHours"] || "0"),
                "updated": now
            });
        }

        let columns = [
            { "title": "Назва",    "field": "name",    "sorter": "alphanum", "width": 200 },
            { "title": "Тип",      "field": "type",    "sorter": "alphanum", "width": 200 },
            { "title": "Годин",    "field": "hours",   "sorter": "number",   "width": 200 },
            { "title": "Вигрузка",  "field": "updated", "sorter": "string",   "width": 200 }
        ];

        Tags("Moto_ColumnStyle").Write(JSON.stringify(columns));
        Tags("Moto_TableDataString").Write(JSON.stringify(tableRows));

        HMIRuntime.Trace("MotoHours: OK, rows=" + tableRows.length + ", time=" + now);

        HMIRuntime.UI.SysFct.OpenScreenInPopup("tab", "Screen_1", true, "", 0, 0, false, undefined);

    } catch (err) {
        HMIRuntime.Trace("MotoHours ERROR: " + err);
    } finally {
        conn = null;
    }
}


//ЗАПИСЬ ВЫБРАННОГО МАРШРУТА ИЗ ТАБЛИЦЫ
export async function Run_Route_OnTapped(item, x, y, modifiers, trigger) {

// Находим свободный слот маршрута (ResultCode слота не равен 32768 = ROUTE_OK_RUNNING)
        const ROUTE_OK_RUNNING = 32768;
        let routeIdx = 0;
        for (let r = 1; r <= 4; r++) {
            let rc = await Tags(`ResultCode_Route${r}`).Read();
            if (rc !== ROUTE_OK_RUNNING) {
                routeIdx = r;
                break;
            }
        }
        if (routeIdx === 0) {
            HMIRuntime.Trace("Все 4 маршрути зайняті");
            return;
        }

// Записываем цвет текущего маршрута в глобальную переменную
let routeColor = Tags("RouteColor" + routeIdx).Read();
Tags("CurrentRouteColor").Write(routeColor);
HMIRuntime.Trace("Цвет маршрута " + routeIdx + " записан: " + routeColor);

        HMIRuntime.Trace(`Вибрано слот маршруту: ${routeIdx}`);
    const MAX_ROUTE_STEPS = 64;
    let items = Screen.Items;
    const conturColor = 0xFF000000;
    for (let i = 0; i < items.Count; i++) {
        let obj = items.Item(i);
        if (obj.Name && obj.Name.startsWith("M_")) {
            try { obj.Properties.Contur = conturColor; } catch (e) {}
            try { obj.Properties.CenterContur = conturColor; } catch (e) {}
            try { obj.Properties.LeftContur = conturColor; } catch (e) {}
            try { obj.Properties.RightContur = conturColor; } catch (e) {}
        }
    }
 
    if (await Tags("Script_Lock").Read()===1){
        HMIRuntime.Trace("Script уже выполняется");
        return;
    }
      let rawId = 0;
      // 1. Чтение ID варианта
        rawId = await Tags("SelectedVariantId").Read();
        if (!rawId || rawId === 0) {
            HMIRuntime.Trace("□ Ошибка: Вариант не выбран (ID=0)");
            return;
        }
 
        // 2. Получение шагов из буфера
        let steps = GetVariantFromBuffer(rawId);
        if (!steps || steps.length === 0) {
            HMIRuntime.Trace("□ Ошибка: Шаги для варианта " + rawId + " не найдены");
            return;
        }
 
 
    await Tags("Script_Lock").Write(1);
    HMIRuntime.Trace("--- Запись маршрута в CMD_Route ---");
 

    try {
      
        let newCount = Math.min(MAX_ROUTE_STEPS, steps.length);
        HMIRuntime.Trace(`□□ Запись ${newCount} шагов. VariantId=${rawId}`);
 
        try {
            let commitPLC = await Tags("Ack_CommitApplied").Read();
            let commitScada = await Tags("HDR_Commit").Read();
            if (commitPLC === commitScada) {
                let newCommit = commitScada + 1;
 
                // 3. Запись заголовка
                await Tags("HDR_RouteId").Write(routeIdx);                
                await Tags("CMD_Route.RC_StepCount").Write(newCount); // Количество → RC_StepCount
                
                // 4. Запись массива шагов
                for (let i = 0; i < MAX_ROUTE_STEPS; i++) {
                    let prefix =`CMD_Route.RC_Steps[${i}].`;
                    
                    if (i < newCount) {
                        let s = steps[i];
                        let actionValue =(Number(s.RequiredState)!==0)?1:0;  
                        let param = 0;  
                        let startParam = 0; // Значение по умолчанию
                        switch (Number(s.RequiredState)) {
                            case 3: startParam = 3; param = 6; break; //лево
                            case 4: startParam = 4; param = 6; break; //право
                            case 5: startParam = 5; param = 6; break; //центр
                            case 6: startParam = 6; param = 6; break; //закрыть
                            case 7: startParam = 7; param = 6; break; //открыть
 
                            case 8:
                            case 9:
                                startParam = 0;
                                param = 6;
                                break;
 
                            default:
                                startParam = 0;
                                param = 0;
                                break;
                        }
                        let wait;
                        if (param === 6) {
                            wait = 2;
                        } else {
                            wait = 1;
                        }       
                        let stopParam;
                        switch (startParam) {
                            case 7: stopParam = 6; break;
                            case 3: stopParam = 3; break;
                            case 4: stopParam = 4; break;
                            case 5: stopParam = 5; break;
                            default: stopParam = 0; break;
                        }
                        // Мэппинг полей:
                        // MechanismId → RS_Slot
                        // RequiredState → RS_Action
                        // StepNum → индекс массива (уже используется в цикле)
                        await Promise.all([
                            Tags(prefix + "RS_Slot").Write(s.MechanismId),     // MechanismId → RS_Slot
                            Tags(prefix + "RS_Action").Write(actionValue), 
                            Tags(prefix + "RS_StartParam").Write(startParam),
                            Tags(prefix + "RS_Wait").Write(wait),
                            Tags(prefix + "RS_StopParam").Write(stopParam)
                        ]);
                    } else {
                        // Очистка неиспользуемых ячеек массива
                        await Promise.all([
                            Tags(prefix + "RS_Slot").Write(0),
                            Tags(prefix + "RS_Action").Write(0),
                            Tags(prefix + "RS_StartParam").Write(0),
                            Tags(prefix + "RS_Wait").Write(0),
                            Tags(prefix + "RS_StopParam").Write(0)
                        ]);
                    }
                    
                    // Лог прогресса
                    if (i % 16 === 0 && i > 0) {
                        HMIRuntime.Trace(`□ Записано шагов: ${i}/${MAX_ROUTE_STEPS}`);
                    }
                }
 
                // 5. Финализация
                await Tags("CMD_Route.RC_Cmd").Write(1); // Команда "готово" (если нужно)
                await Tags("HDR_Commit").Write(newCommit);   
                HMIRuntime.Trace("□ Запись завершена успешно!");
                HMIRuntime.Trace(`   HDR_RouteId=${routeIdx}, HDR_Commit=${newCommit}`);
 
            } else {
                HMIRuntime.Trace(` PLC не подтвердил предыдущую команду (PLC=${commitPLC}, SCADA=${commitScada})`);
            }
        } catch (err) {
            HMIRuntime.Trace(`□ Критическая ошибка записи: ${err.message}`);
            HMIRuntime.Trace(`   Stack: ${err.stack}`);
        }
 
    } finally {
        // □ ГАРАНТИРОВАННЫЙ сброс блокировки — выполнится ВСЕГДА:
        //   при нормальном завершении, при return (rawId=0, steps пустые),
        //   и при любом необработанном исключении.
        await Tags("Script_Lock").Write(0);
        HMIRuntime.Trace("□□ Блокировка скрипта снята");
    }


}




//Кнопка остановка маршрута 
export async function Stop_Route_OnTapped(item, x, y, modifiers, trigger) {
 let commitPLC = Tags("Ack_CommitApplied").Read();
    let commitScada = Tags("HDR_Commit").Read();

    // 1. Чтение ID варианта
    let rawId = Tags("RouteID").Read();
    
    // Проверка на null и валидность ID
    if (commitPLC == null || commitScada == null || rawId == null) {
        return;
    }

    // КРИТИЧНАЯ ПРОВЕРКА: Mailbox должен быть свободен для надежности
    if (commitPLC === commitScada && rawId > 0 && rawId <= 12) {  
        let newCommit = commitScada + 1;
        
        try {
            await Promise.all([
                Tags("HDR_RouteId").Write(rawId),
                Tags("CMD_Route.RC_Cmd").Write(2),           // RT_CMD_STOP_OP
                Tags("CMD_Route.RC_StepCount").Write(0),     // □□ НЕ передавать шаги при STOP!
                Tags("HDR_Commit").Write(newCommit)          // Отправить команду
            ]);
            HMIRuntime.Trace(`□ STOP отправлена для маршрута ${rawId}`);
        } catch (err) {
            HMIRuntime.Trace(`□ Ошибка STOP: ${err.message}`);
        }
    } else if (commitPLC !== commitScada) {
        HMIRuntime.Trace(`□ Mailbox занят: PLC=${commitPLC}, SCADA=${commitScada} (retry)`);
    } else {
        HMIRuntime.Trace(`□ Невалидный RouteID: ${rawId}`);
    }
    
    // □□ Сброс визуальных элементов (механизмы и линии маршрута)
    let items = Screen.Items;
    let conturColor = 0xFF000000;  // Черный цвет
    let routeColor = Tags("RouteColor" + rawId).Read(); 
    
    for (let i = 0; i < items.Count; i++) {
        let obj = items.Item(i);
        
        // Сброс линий маршрута
        if (obj.Name && obj.Name.startsWith("L_")) {
            if (obj.LineColor === routeColor) {
                try {
                    obj.LineColor = 0xFF000000; // Черный
                    obj.LineWidth = 1;
                } catch (e) { }
            }
        }
        
        // Сброс механизмов только для текущего цветового маршрута
        if (obj.Name && obj.Name.startsWith("M_")) {
            try { if (obj.Properties.Contur === routeColor) obj.Properties.Contur = conturColor; } catch (e) { }
            try { if (obj.Properties.MainContur === routeColor) obj.Properties.MainContur = conturColor; } catch (e) { }
            try { if (obj.Properties.CenterContur === routeColor) obj.Properties.CenterContur = conturColor; } catch (e) { }
            try { if (obj.Properties.LeftContur === routeColor) obj.Properties.LeftContur = conturColor; } catch (e) { }
            try { if (obj.Properties.RightContur === routeColor) obj.Properties.RightContur = conturColor; } catch (e) { }
        }
    }

Tags("CurrentRouteColor").Write(0);
}


//покраска линий 
export function L_5_116_LineColor_Trigger(item) {
    let value;
    let status1 = Tags("DB_Mechs_Mechs{5}_Status").Read();
    let status2 = Tags("DB_Mechs_Mechs{116}_Status_Param").Read();

    HMIRuntime.Trace("Status Redler: " + status1 + ", Status Gate: " + status2);

    if (status1 === 2 && status2 === 7) {
        HMIRuntime.Trace("Result: Color Green");
        value = 0xFF00FF00;  // Зеленый
    } else {
        HMIRuntime.Trace("Result: Color White");
        value = 0xFFFFFFFF;  // Белый
    }

    HMIRuntime.Trace("Final Color: " + value);
    
    // Присваиваем цвет напрямую объекту линии
    item.LineColor = value;
}


//Скидання кольору 
export function Reset_Color_OnTapped(item, x, y, modifiers, trigger) {
    Tags("SelectedVariantId").Write(0);
    let routeId = Tags("RouteID").Read();
    let routeColor = 0;
    if (routeId > 0 && routeId <= 4) {
        routeColor = Tags("RouteColor" + routeId).Read();
    }
    if (!routeColor) {
        routeColor = Tags("CurrentRouteColor").Read();
    }
    let items = Screen.Items;
    let conturColor = 0xFF000000;
    HMIRuntime.Trace(`Reset_Color: RouteID=${routeId}, color=${routeColor}`);
    for (let i = 0; i < items.Count; i++) {
        let obj = items.Item(i);
        if (obj.Name && obj.Name.startsWith("L_")) {
            if (obj.LineColor === routeColor) {
                obj.LineColor = 0xFF000000;
                obj.LineWidth = 1;
            }
        }
        if (obj.Name && obj.Name.startsWith("M_")) {
            try {
                if (obj.Properties.Contur === routeColor) obj.Properties.Contur = conturColor;
            } catch (e) {}
            try {
                if (obj.Properties.CenterContur === routeColor) obj.Properties.CenterContur = conturColor;
            } catch (e) {}
            try {
                if (obj.Properties.LeftContur === routeColor) obj.Properties.LeftContur = conturColor;
            } catch (e) {}
            try {
                if (obj.Properties.RightContur === routeColor) obj.Properties.RightContur = conturColor;
            } catch (e) {}
        }
    }
    Tags("CurrentRouteColor").Write(0);
}