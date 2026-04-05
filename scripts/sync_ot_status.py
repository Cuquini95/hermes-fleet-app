"""Sync OT_STATUS_LOG changes to ORDENES_TRABAJO ESTADO column.
Reads all status log entries, finds the latest status per OT,
and updates the ORDENES_TRABAJO sheet.
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

    # 1. Read OT_STATUS_LOG
    try:
        ws_log = sh.worksheet("OT_STATUS_LOG")
        log_rows = ws_log.get_all_values()
    except Exception as e:
        print(f"Error reading OT_STATUS_LOG: {e}")
        return

    # Build latest values per OT per field
    # Format: {ot_id: {field: value}}
    latest = {}
    for row in log_rows[1:]:
        if len(row) < 5:
            continue
        timestamp = row[0].strip()
        ot_id = row[1].strip()
        field = row[2].strip()
        new_value = row[4].strip()

        if not ot_id or not field:
            continue

        if ot_id not in latest:
            latest[ot_id] = {}
        # Later entries override earlier ones (log is append-only)
        latest[ot_id][field] = new_value

    if not latest:
        print("No status log entries found")
        return

    print(f"Found updates for {len(latest)} OTs")

    # 2. Read ORDENES_TRABAJO
    try:
        ws_ot = sh.worksheet("ORDENES_TRABAJO")
        ot_rows = ws_ot.get_all_values()
    except Exception as e:
        print(f"Error reading ORDENES_TRABAJO: {e}")
        return

    # Find OT_ID column (should be col B / index 1)
    # and ESTADO column (should be col J / index 9)
    # and MECANICO column (col I / index 8)
    # and PRIORIDAD column (col H / index 7)
    header_idx = None
    for i, row in enumerate(ot_rows):
        if any("OT_ID" in str(c).upper() for c in row):
            header_idx = i
            break

    if header_idx is None:
        print("Could not find header row in ORDENES_TRABAJO")
        return

    header = ot_rows[header_idx]
    col_map = {}
    for j, h in enumerate(header):
        h_upper = str(h).upper().strip()
        if "OT_ID" in h_upper:
            col_map["ot_id"] = j
        elif h_upper == "ESTADO":
            col_map["estado"] = j
        elif "ASIGNAD" in h_upper:
            col_map["mecanico_asignado"] = j
        elif "PRIORIDAD" in h_upper:
            col_map["prioridad"] = j
        elif "OBSERVACIONES" in h_upper:
            col_map["observaciones"] = j

    print(f"Column map: {col_map}")

    ot_id_col = col_map.get("ot_id")
    if ot_id_col is None:
        print("OT_ID column not found")
        return

    # 3. Update cells
    updates = []
    for i in range(header_idx + 1, len(ot_rows)):
        row = ot_rows[i]
        if len(row) <= ot_id_col:
            continue
        ot_id = str(row[ot_id_col]).strip()
        if ot_id not in latest:
            continue

        changes = latest[ot_id]
        r = i + 1  # gspread 1-indexed

        for field, value in changes.items():
            col_idx = col_map.get(field)
            if col_idx is not None:
                current = str(row[col_idx]).strip() if len(row) > col_idx else ""
                if current != value:
                    updates.append(gspread.Cell(r, col_idx + 1, value))
                    print(f"  {ot_id}: {field} '{current}' -> '{value}'")

    if updates:
        ws_ot.update_cells(updates, value_input_option="USER_ENTERED")
        print(f"Updated {len(updates)} cells in ORDENES_TRABAJO")
    else:
        print("All ORDENES_TRABAJO already in sync")


if __name__ == "__main__":
    main()
