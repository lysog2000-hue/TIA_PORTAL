
let connectionString = "DSN=RunTime;UID=HMI_User;PWD=12345;";

let mechanisms = [
    1,  2,  3,  4,  5,  6,  7,  8,  9,  10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    31, 32, 33, 34, 35, 36, 37, 38, 39,        // Redler
    51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, // Noria
    311, 312, 313,                               // Separator
    314, 315, 316,                               // Feeder
    317, 318, 319                                // Fan
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
    HMIRuntime.Trace("RunTime DEBUG connection OK");

    let result = await conn.Execute(sql);
    HMIRuntime.Trace("RunTime DEBUG execute OK, result: " + JSON.stringify(result));

    HMIRuntime.Trace("RunTime: updated " + mechanisms.length + " mechanisms");

} catch (err) {
    HMIRuntime.Trace("RunTime ERROR: " + err);
} finally {
    if (conn) { try { await conn.Close(); } catch(e) {} }
}
