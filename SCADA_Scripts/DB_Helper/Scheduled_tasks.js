// Заданние по заполнению SQL таблицы моточасов
export async function Task_RunTime_Update() {

let connectionString = "DSN=RunTime;UID=HMI_User;PWD=12345;";

let mechanisms = [
    1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36, 37, 38, 39,             // Redler
    51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, // Noria
    311, 312, 313,                                  // Separator
    314, 315, 316,                                  // Feeder
    317, 318, 319                                   // Fan
];

let conn = null;

try {
    // --- Читаем теги по одному ---
    let batch = [];

    for (let i = 0; i < mechanisms.length; i++) {
        let id     = mechanisms[i];
        let tag    = Tags("DB_Mechs_Mechs{" + id + "}_Status").Read();
        let isRunning = (tag === 2) ? 1 : 0;

        batch.push("EXEC UpdateMechStatus " + id + ", " + isRunning);
    }

    let sql = batch.join("; ");

    // --- Один коннект, один запрос ---
    conn = await HMIRuntime.Database.CreateConnection(connectionString);
    let result = await conn.Execute(sql);
} catch (err) {
    HMIRuntime.Trace("RunTime ERROR: " + err);
} finally {
    if (conn) { try { await conn.Close(); } catch(e) {} }
}
}




//Перерахунок температури Сушарка 1 
export function Task_Temp_DR1_Update() {
const low_sig = 0;
const high_sig = 27648;
const low_temp = -200;
const high_temp = 500;
let PW = Tags("DB_Mechs_Sushka{0}_Temps{15}").Read();
let val10 = Tags("DB_Mechs_Sushka{0}_Temps{10}").Read();
let val11 = Tags("DB_Mechs_Sushka{0}_Temps{11}").Read();
let Tp = Tags("DB_Mechs_Sushka{0}_Temps{14}").Read();
let val6 = Tags("DB_Mechs_Sushka{0}_Temps{6}").Read();
let val7 = Tags("DB_Mechs_Sushka{0}_Temps{7}").Read();
let Td= (val10 + val11)/2;
let Tg = (val6 + val7)/2;
let PW_Write = low_temp + ((PW-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tp_Write = low_temp + ((Tp-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Td_Write = low_temp + ((Td-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tg_Write = low_temp + ((Tg-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
Tags("DR1_PW").Write(PW_Write);
Tags("DR1_Tp").Write(Tp_Write);
Tags("DR1_Td").Write(Td_Write);
Tags("DR1_Tg").Write(Tg_Write);
}




//Перерахунок температури Сушарка 2
export function Task_Temp_DR2_Update() {
const low_sig = 0;
const high_sig = 27648;
const low_temp = -200;
const high_temp = 500;
let PW = Tags("DB_Mechs_Sushka{1}_Temps{15}").Read();
let val10 = Tags("DB_Mechs_Sushka{1}_Temps{10}").Read();
let val11 = Tags("DB_Mechs_Sushka{1}_Temps{11}").Read();
let Tp = Tags("DB_Mechs_Sushka{1}_Temps{14}").Read();
let val6 = Tags("DB_Mechs_Sushka{1}_Temps{6}").Read();
let val7 = Tags("DB_Mechs_Sushka{1}_Temps{7}").Read();
let Td= (val10 + val11)/2;
let Tg = (val6 + val7)/2;
let PW_Write = low_temp + ((PW-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tp_Write = low_temp + ((Tp-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Td_Write = low_temp + ((Td-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tg_Write = low_temp + ((Tg-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
Tags("DR2_PW").Write(PW_Write);
Tags("DR2_Tp").Write(Tp_Write);
Tags("DR2_Td").Write(Td_Write);
Tags("DR2_Tg").Write(Tg_Write);
}





//Перерахунок температури Сушарка 3
export function Task_Temp_DR3_Update() {
const low_sig = 0;
const high_sig = 27648;
const low_temp = -200;
const high_temp = 500;
let PW = Tags("DB_Mechs_Sushka{2}_Temps{15}").Read();
let val10 = Tags("DB_Mechs_Sushka{2}_Temps{10}").Read();
let val11 = Tags("DB_Mechs_Sushka{2}_Temps{11}").Read();
let Tp = Tags("DB_Mechs_Sushka{2}_Temps{14}").Read();
let val6 = Tags("DB_Mechs_Sushka{2}_Temps{6}").Read();
let val7 = Tags("DB_Mechs_Sushka{2}_Temps{7}").Read();
let Td= (val10 + val11)/2;
let Tg = (val6 + val7)/2;
let PW_Write = low_temp + ((PW-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tp_Write = low_temp + ((Tp-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Td_Write = low_temp + ((Td-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tg_Write = low_temp + ((Tg-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
Tags("DR3_PW").Write(PW_Write);
Tags("DR3_Tp").Write(Tp_Write);
Tags("DR3_Td").Write(Td_Write);
Tags("DR3_Tg").Write(Tg_Write);
}




//Перерахунок температури Сушарка 4
export function Task_Temp_DR4_Update() {
const low_sig = 0;
const high_sig = 27648;
const low_temp = -200;
const high_temp = 500;
let PW = Tags("DB_Mechs_Sushka{3}_Temps{15}").Read();
let val10 = Tags("DB_Mechs_Sushka{3}_Temps{10}").Read();
let val11 = Tags("DB_Mechs_Sushka{3}_Temps{11}").Read();
let Tp = Tags("DB_Mechs_Sushka{3}_Temps{14}").Read();
let val6 = Tags("DB_Mechs_Sushka{3}_Temps{6}").Read();
let val7 = Tags("DB_Mechs_Sushka{3}_Temps{7}").Read();
let Td= (val10 + val11)/2;
let Tg = (val6 + val7)/2;
let PW_Write = low_temp + ((PW-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tp_Write = low_temp + ((Tp-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Td_Write = low_temp + ((Td-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
let Tg_Write = low_temp + ((Tg-low_sig)*(high_temp-low_temp))/(high_sig-low_sig);
Tags("DR4_PW").Write(PW_Write);
Tags("DR4_Tp").Write(Tp_Write);
Tags("DR4_Td").Write(Td_Write);
Tags("DR4_Tg").Write(Tg_Write);
}
