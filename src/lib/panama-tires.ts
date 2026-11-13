export function tireHistory(rows: string[][], serial: string) {
  const key = serial.trim().toUpperCase();
  if (!key) return [];
  const dateKey = (value: string) => {
    const [day, month, year] = value.split('/');
    return year && month && day ? year + month.padStart(2, '0') + day.padStart(2, '0') : value;
  };
  return rows
    .filter(row => row[1]?.trim() && row[3]?.trim() && row[7]?.trim().toUpperCase() === key)
    .map(row => ({
      unit: row[1], position: row[3], depth: row[13] ?? '', pressure: row[16] ?? '',
      date: row[17] ?? '', status: row[18] ?? '', meter: row[10] ?? '', note: row[25] ?? '',
    }))
    .sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));
}
