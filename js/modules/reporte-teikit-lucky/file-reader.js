function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].map((value) => [value, firstLine.split(value).length - 1]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index], next = text[index + 1];
    if (character === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field); if (row.some((cell) => cell !== "")) rows.push(row); row = []; field = "";
    } else field += character;
  }
  row.push(field); if (row.some((cell) => cell !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((header, index) => String(header || `Columna ${index + 1}`).replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function readFile(file, mode) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo seleccionado."));
    reader.onload = () => resolve(reader.result);
    if (mode === "arrayBuffer") reader.readAsArrayBuffer(file);
    else reader.readAsText(file, "utf-8");
  });
}

export async function readReportFile(file) {
  const extension = file?.name.split(".").pop()?.toLowerCase();
  if (!file || !["csv", "xlsx", "xls"].includes(extension)) throw new Error("Selecciona un archivo con extensión .csv, .xlsx o .xls.");
  if (extension === "csv") return { rows: parseCsv(await readFile(file, "text")), format: "CSV", sheetName: null };
  if (!window.XLSX) throw new Error("El lector local de Excel no está disponible.");
  try {
    const workbook = window.XLSX.read(await readFile(file, "arrayBuffer"), { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error("El archivo de Excel no contiene hojas disponibles.");
    return { rows: window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true }), format: extension.toUpperCase(), sheetName };
  } catch (error) {
    if (error.message === "El archivo de Excel no contiene hojas disponibles.") throw error;
    throw new Error("No se pudo interpretar el archivo Excel.", { cause: error });
  }
}
