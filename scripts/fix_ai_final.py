"""Final fix: AI does diagnosis only. Part numbers come from programmatic search.
The diagnose endpoint now:
1. Searches catalog for matching parts (code, not AI)
2. Sends those EXACT parts to the AI as facts
3. AI formats them but CANNOT change/add part numbers
"""
path = "/root/.hermes/hermes-agent/gateway/ai_endpoints.py"
with open(path, "r") as f:
    code = f.read()

# Find and replace the diagnose system prompt section
# The key change: tell AI that partes_probables MUST be exactly from the presearch
old_rule = (
    '"REGLAS ABSOLUTAS PARA PARTES: '
    '1) SOLO usa n\u00fameros de parte que aparecen TEXTUALMENTE en el CATALOGO proporcionado abajo. '
    '2) NUNCA inventes, generes, o estimes n\u00fameros de parte. Si no encuentras el n\u00famero exacto en el cat\u00e1logo, escribe CONSULTAR MANUAL OEM como n\u00famero. '
    '3) Lista TODOS los que encuentres relevantes. '
    '4) Formatos v\u00e1lidos de Komatsu: 600-XXX-XXXX, 20Y-XX-XXXXX. CAT: XXX-XXXX. Doosan: KXXXXXXX. Mack: 8 digitos. Si el n\u00famero no sigue estos formatos, NO lo incluyas. "'
)

new_rule = (
    '"REGLA CRITICA: En partes_probables, usa UNICAMENTE los numeros que aparecen en la seccion PARTES ENCONTRADAS EN CATALOGO arriba. '
    'Esos numeros fueron verificados por busqueda programatica del catalogo real. '
    'NO agregues, inventes, ni modifiques ningun numero de parte. '
    'Si la seccion PARTES ENCONTRADAS esta vacia, pon partes_probables como lista vacia []. '
    'Tu trabajo es SOLO el diagnostico (causas, checklist, prioridad). Los numeros de parte ya estan verificados. "'
)

if old_rule in code:
    code = code.replace(old_rule, new_rule)
    print("Replaced rule in system prompt")
else:
    print("WARNING: Could not find old rule to replace")
    # Try to find it with partial match
    import re
    pattern = r'"REGLAS ABSOLUTAS PARA PARTES:.*?"'
    match = re.search(pattern, code, re.DOTALL)
    if match:
        code = code[:match.start()] + new_rule + code[match.end():]
        print("Replaced using regex")
    else:
        print("FAILED to find rule")

with open(path, "w") as f:
    f.write(code)
print("Done")
