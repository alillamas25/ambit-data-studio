function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer el archivo seleccionado."));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

export function workbookToMatrix(workbook, xlsx) {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo de Excel no contiene hojas disponibles.");
  const matrix = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  if (!matrix.length) throw new Error("El archivo de Excel no contiene encabezados.");
  return { headers: matrix[0], rows: matrix.slice(1), sheetName };
}

export async function readCleaningFile(file) {
  const extension = file?.name.split(".").pop()?.toLowerCase();
  if (!file || !["xlsx", "xls"].includes(extension)) throw new Error("Selecciona un archivo con extensión .xlsx o .xls.");
  if (!window.XLSX) throw new Error("El lector local de Excel no está disponible.");
  try {
    const workbook = window.XLSX.read(await readAsArrayBuffer(file), { type: "array", cellDates: true });
    return { ...workbookToMatrix(workbook, window.XLSX), fileName: file.name };
  } catch (error) {
    if (error.message.startsWith("El archivo de Excel")) throw error;
    throw new Error("No se pudo interpretar el archivo Excel.", { cause: error });
  }
}
