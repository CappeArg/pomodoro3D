// ==========================================
// SCRIPT DE INTEGRACIÓN: FOCUS3D POMODORO
// ==========================================
// IMPORTANTE: Al hacer un cambio aquí, debes ir a "Implementar" > "Gestionar implementaciones",
// editar la actual y seleccionar una NUEVA VERSIÓN para que los cambios surtan efecto.
//
// Instrucciones de instalación:
// 1. Crea una nueva Hoja de Cálculo en Google Drive.
// 2. Ve a "Extensiones" > "Apps Script".
// 3. Borra el código que haya y pega todo este archivo.
// 4. Haz clic en "Implementar" > "Nueva implementación".
// 5. En "Seleccionar tipo", elige "Aplicación web".
// 6. En "Ejecutar como", selecciona "Yo".
// 7. En "Quién tiene acceso", selecciona "Cualquier persona".
// 8. Haz clic en "Implementar", autoriza los permisos y copia la URL.
// 9. Pega la URL en la configuración de Focus3D (Ajustes > Integración).

function doGet(e) {
  try {
    var callback = e.parameter.callback;
    var encodedData = e.parameter.data;

    // Si no hay datos, es solo un test de conexión
    if (!encodedData) {
      var testResponse = callback
        ? callback + '(' + JSON.stringify({ status: 'success', message: 'Conectado' }) + ')'
        : '¡El Script de Focus3D está funcionando correctamente!';
      return ContentService.createTextOutput(testResponse)
        .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.TEXT);
    }

    // Decodificar los datos base64
    var jsonStr = Utilities.newBlob(Utilities.base64Decode(encodedData)).getDataAsString();
    var data = JSON.parse(jsonStr);

    if (data.action === 'sync') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // ==========================================
      // 1. GUARDAR TAREAS
      // ==========================================
      var tasksSheet = ss.getSheetByName("Tareas");
      if (!tasksSheet) {
        tasksSheet = ss.insertSheet("Tareas");
        tasksSheet.appendRow(["ID Tarea", "Título", "Estado", "Pomodoros Completados", "Objetivo Pomodoros"]);
        tasksSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f3f3f3");
      }

      var lastRow = tasksSheet.getLastRow();
      if (lastRow > 1) {
        tasksSheet.getRange(2, 1, lastRow - 1, 5).clearContent();
      }

      if (data.tasks && data.tasks.length > 0) {
        var rows = [];
        for (var i = 0; i < data.tasks.length; i++) {
          var t = data.tasks[i];
          rows.push([
            t.id,
            t.title,
            t.completed ? "✅ Completada" : "⏳ Pendiente",
            t.completedPomodoros,
            t.targetPomodoros
          ]);
        }
        tasksSheet.getRange(2, 1, rows.length, 5).setValues(rows);
      }

      // ==========================================
      // 2. GUARDAR ESTADÍSTICAS GLOBALES
      // ==========================================
      if (data.stats) {
        var statsSheet = ss.getSheetByName("Estadísticas Totales");
        if (!statsSheet) {
          statsSheet = ss.insertSheet("Estadísticas Totales");
          statsSheet.appendRow(["Última Actualización", "Pomodoros Completados", "Minutos Totales de Focus"]);
          statsSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#e0f7fa");
        }

        var now = new Date();
        statsSheet.getRange("A2:C2").setValues([[now, data.stats.completedPomodoros, data.stats.totalFocusMinutes]]);
      }

      // Responder con JSONP
      var successResponse = callback
        ? callback + '(' + JSON.stringify({ status: 'success' }) + ')'
        : JSON.stringify({ status: 'success' });
      return ContentService.createTextOutput(successResponse)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

  } catch (error) {
    var errorResponse = (e.parameter.callback || 'callback') +
      '(' + JSON.stringify({ status: 'error', message: error.toString() }) + ')';
    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}
