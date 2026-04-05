"""Sync horometro readings from 04B to 02 Prog. Mantenimiento.
Fills: LECTURA ACTUAL, FECHA LECTURA
"""
import gspread
from google.oauth2.service_account import Credentials

CREDS_PATH = "/root/.hermes/google-credentials.json"
SHEET_ID = "14rWfjrJbXTZG_Mth1Gzk3RzVYd5mohbJR3BsXEItFgU"


def main():
    scopes = [
        "https://spreadsheets.google.com/feeds",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(CREDS_PATH, scopes=scopes)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(SHEET_ID)

    # 1. Read latest horometro per unit from 04B
    try:
        ws_horo = sh.worksheet("04B Registro Horómetros")
        horo_rows = ws_horo.get_all_values()
    except Exception as e:
        print(f"Error reading 04B: {e}")
        return

    latest = {}
    for row in horo_rows[1:]:
        if len(row) < 7:
            continue
        fecha = row[0].strip()
        unidad = row[2].strip()
        horo = row[6].strip()
        if not unidad or not horo:
            continue
        try:
            horo_val = float(horo.replace(",", ""))
        except ValueError:
            continue
        existing = latest.get(unidad)
        if not existing or horo_val > existing["horo_val"]:
            latest[unidad] = {
                "horo_val": horo_val,
                "horo_str": horo,
                "fecha": fecha,
            }

    if not latest:
        print("No horometro readings found in 04B")
        return

    print(f"Found readings for {len(latest)} units: {list(latest.keys())}")

    # 2. Read 02 Prog. Mantenimiento
    try:
        ws_pm = sh.worksheet("02 Prog. Mantenimiento")
        pm_rows = ws_pm.get_all_values()
    except Exception as e:
        print(f"Error reading 02 Prog: {e}")
        return

    # Find header row
    header_idx = None
    for i, row in enumerate(pm_rows):
        if any("LECTURA ACTUAL" in str(c).upper() for c in row):
            header_idx = i
            break

    if header_idx is None:
        print("Could not find header row")
        return

    header = pm_rows[header_idx]
    cod1_col = None
    lectura_col = None
    fecha_col = None

    for j, h in enumerate(header):
        h_upper = str(h).upper().strip()
        if h_upper == "COD 1":
            cod1_col = j
        elif "LECTURA ACTUAL" in h_upper:
            lectura_col = j
        elif "FECHA LECTURA" in h_upper:
            fecha_col = j

    print(f"Columns: COD1={cod1_col}, LECTURA={lectura_col}, FECHA={fecha_col}")

    if cod1_col is None or lectura_col is None:
        print("Missing required columns")
        return

    # 3. Update cells
    updates = []
    for i in range(header_idx + 1, len(pm_rows)):
        row = pm_rows[i]
        if len(row) <= cod1_col:
            continue
        unit_id = str(row[cod1_col]).strip()
        if unit_id in latest:
            reading = latest[unit_id]
            r = i + 1  # gspread 1-indexed

            if lectura_col is not None:
                updates.append(gspread.Cell(r, lectura_col + 1, str(reading["horo_str"])))

            if fecha_col is not None:
                updates.append(gspread.Cell(r, fecha_col + 1, reading["fecha"]))

    if updates:
        ws_pm.update_cells(updates, value_input_option="USER_ENTERED")
        print(f"Updated {len(updates)} cells in 02 Prog. Mantenimiento")
    else:
        print("No updates needed")


if __name__ == "__main__":
    main()
