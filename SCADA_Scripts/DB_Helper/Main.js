// Main.js
// Основные обработчики кнопок для работы с маршрутами
// Импорт из GlobalDefinitions.js (DB_Helper)
//КНОПКА ВЫЗОВА СПИСКА МАРШРУТОВ
import { GetActiveRouteData, GetStepsByVariant, GetVariantFromBuffer, GetVariantList, RunQueryAndCache, SetRouteData, resetMechanism } from "DB_Helper";

export async function Btn_OpenList_OnTapped(item, x, y, modifiers, trigger) {
    let startId = Tags("StartPortId").Read();
    let endId   = Tags("EndPortId").Read();
    let midId   = Tags("MidPortId").Read();

    // Сброс интерфейса
    Tags("TableDataString").Write("");
    Tags("SelectedVariantId").Write(0);
    Tags("TestTag").Write(1);

    let items = Screen.Items;
    for (let i = 0; i < items.Count; i++) {
        let obj = items.Item(i);

        if (obj.Name && obj.Name.startsWith("L_")) {
            obj.LineColor = 0xFF000000;
            obj.LineWidth = 1;
        }

        if (obj.Name.startsWith("M_")) {
            try { obj.Properties.Contur      = 0xFF000000; } catch(e) {}
            try { obj.Properties.CenterContur = 0xFF000000; } catch(e) {}
            try { obj.Properties.LeftContur   = 0xFF000000; } catch(e) {}
            try { obj.Properties.RightContur  = 0xFF000000; } catch(e) {}
        }
    }

    let count = await RunQueryAndCache(startId, endId, midId);

    if (count > 0) {
        let variants = GetVariantList();

        let columns = [
            { "title": "Route", "field": "R", "width": 900 }
        ];
        Tags("ColumnStyle").Write(JSON.stringify(columns));

        let rows = variants.map((v) => ({
            "R": v.RoutePath
        }));

        let finalJson = JSON.stringify(rows);
        HMIRuntime.Trace("JSON Length: " + finalJson.length);

        Tags("TableDataString").Write(finalJson);
        Tags("Visibility_Trigger").Write(1);

        HMIRuntime.Trace("SQL Success: " + count + " variants loaded");
    }
}

export async function Btn_OpenList_OnUp(item, x, y, modifiers, trigger) {
    Tags("TestTag").Write(0);
    HMIRuntime.UI.SysFct.OpenScreenInPopup("tab", "Table", true, "", 0, 0, false, undefined);
}



//ФУНКЦИЯ ПОКРАСКИ МЕХАНИЗМОВ 
export function Circle_5_BackColor_OnPropertyChanged(item, value) {
let vId = Tags("SelectedVariantId").Read();
let activeColor = 0xFFFFA500; // Оранжевый для команд 3, 4, 5
    if (vId > 0) {
        let activeRouteData = GetActiveRouteData(vId); 
        let screenItems = Screen.Items;
         // □□ НОВое: Сброс всех линий в серый перед началом
        for (let i = 0; i < screenItems.Count; i++) {
            let obj = screenItems.Item(i);
            if (obj.Name && obj.Name.startsWith("L_")) {
                obj.LineColor = 0xFF000000; // Черный
                obj.LineWidth = 1;
            }
        }
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
        // ========================================================================
        // □□ КОНЕЦ ТВОЕЙ ЛОГИКИ □□
        // ========================================================================

         // □□ 2. ОТЛАДКА: Выводим все линии на экране в лог
       
        for (let i = 0; i < screenItems.Count; i++) {
            let obj = screenItems.Item(i);
            if (obj.Name && obj.Name.startsWith("L_")) {
               
            }
        }
        // Проходим по маршруту парами: [0]->[1], [1]->[2] и т.д.
        for (let i = 0; i < activeRouteData.length - 1; i++) {
            let from = activeRouteData[i+1].id;
            let to = activeRouteData[i].id;
            // Формируем имя линии: L_<От>_<Куда>  
            let lineName = `L_${from}_${to}`;

           // □□ Ищем ТОЧНО ТАК ЖЕ, как в сбросе — перебором всех объектов
            let lineObj = null;
            for (let j = 0; j < screenItems.Count; j++) {
                let candidate = screenItems.Item(j);
                // Сравниваем имена ТОЧНО (учитываем пробелы!)
                if (candidate.Name){
                  let name = candidate.Name.trim();
                  let idx = name.indexOf(lineName);
                    if (idx!==-1) {

                          // □□ Проверка границы: после шаблона должна быть 
                        // либо КОНЕЦ строки, либо НЕ-цифра (буква/подчёркивание), либо новая "L_"
                        let afterIdx = idx + lineName.length;
                        let nextChar = name.charAt(afterIdx);
                        let isBoundary = (
                            afterIdx >= name.length ||           // Конец строки
                            !/^\d/.test(nextChar) ||             // Следующий символ не цифра
                            name.substring(afterIdx).startsWith('L_') // Начинается новый шаблон
                        );

                       if (isBoundary) {
                            try {
                                candidate.LineColor = activeColor;
                                candidate.LineWidth = 2;
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
export async function Apply_OnTapped(item, x, y, modifiers, trigger) {
let apply = Tags ("ApplyTag").Read();
if (apply === 1){apply=0;}else{apply=1};
let vId = Tags ("SelectedVariantId").Read();

Tags("ApplyTag").Write(apply);
    const MAX_ROUTE_STEPS = 64;
    let items = Screen.Items;
    const conturColor = 0xFF000000;
    for (let i = 0; i < items.Count; i++) {
        let obj = items.Item(i);
            if (obj.Name && obj.Name.startsWith("L_")) {
                if (obj.LineColor === 0xFFFFA500){
                    obj.LineColor = 0xFF00FF00; // зеленій
                     obj.LineWidth = 2;
                }else{
                obj.LineColor = 0xFF000000; // Черный
                obj.LineWidth = 1;}
            }
        // Проверяем префикс имени
        if (obj.Name && obj.Name.startsWith("M_")) {
            
            // 1. Пытаемся сбросить стандартный цвет изображения
            try {
                obj.Properties.Contur =conturColor;
            } catch (e) { /* Свойства нет — игнорируем */ }
 
            // 2. Пытаемся сбросить Центральный контур
            try {
                obj.Properties.CenterContur = conturColor; 
            } catch (e) { }
            try {
                obj.Properties.LeftContur = conturColor; 
            } catch (e) { }
 
            // 4. Пытаемся сбросить Правый контур
            try {
                obj.Properties.RightContur = conturColor;
            } catch (e) { }
        }
    }
 
    if (await Tags("Script_Lock").Read()===1){
        HMIRuntime.Trace("Script уже выполняется");
        return;
    }
 
    await Tags("Script_Lock").Write(1);
    HMIRuntime.Trace("--- Запись маршрута в CMD_Route ---");
 
    // □ ИСПРАВЛЕНИЕ: try/finally охватывает ВСЁ после Write(1),
    //   чтобы блокировка гарантированно снималась при любом выходе.
    let rawId = 0;
    try {
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
 
        let newCount = Math.min(MAX_ROUTE_STEPS, steps.length);
        HMIRuntime.Trace(`□□ Запись ${newCount} шагов. VariantId=${rawId}`);
 
        try {
            let commitPLC = await Tags("Ack_CommitApplied").Read();
            let commitScada = await Tags("HDR_Commit").Read();
            if (commitPLC === commitScada) {
                let newCommit = commitScada + 1;
 
                // 3. Запись заголовка
                await Tags("HDR_RouteId").Write(rawId);           // VariantId → HDR_RouteId         
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
                HMIRuntime.Trace(`   HDR_RouteId=${rawId}, HDR_Commit=${newCount}`);
 
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