"""Fix VPS ai_endpoints.py: Kimi→Flash, fix regex, add context loader."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "/root/.hermes/hermes-agent/gateway/ai_endpoints.py"

with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace KIMI_K2 calls with FLASH
code = code.replace("await _call(KIMI_K2,", "await _call(FLASH,")

# 2. Update comments
code = code.replace("# Kimi K2.5 (moonshotai/kimi-k2.5)", "# Gemini Flash Lite")
code = code.replace("Kimi K2.5", "Gemini Flash Lite")

# 3. Fix broken _parse_json regex (empty pattern)
code = code.replace(
    '    clean = re.sub(r"", "").strip()',
    '    clean = re.sub(r"`' + '``(?:json)?\\\\n?", "", raw).strip()\n'
    '    clean = re.sub(r"`' + '``\\\\s*$", "", clean).strip()'
)

# 4. Add context loader import
code = code.replace(
    "from typing import Optional, List",
    "from typing import Optional, List\n"
    "try:\n"
    "    from gateway.context_loader import load_catalog_context, load_workshop_context\n"
    "except ImportError:\n"
    "    def load_catalog_context(e, **kw): return ''\n"
    "    def load_workshop_context(e, t, **kw): return ''"
)

# 5. Inject catalog context into diagnose endpoint
# Find the diagnose SYS block and add catalog loading before it
old_diagnose = (
    '    SYS = (\n'
    '        "Eres el sistema experto de diagnóstico de flota de Hermes GTP. "\n'
    '        "Técnico maestro con 25 años en equipos pesados de minería y construcción. "\n'
    '        "Responde SOLO con un objeto JSON válido. Sin texto adicional. En español."\n'
    '    )'
)
new_diagnose = (
    '    catalog_ctx = load_catalog_context(req.equipo, max_chars=40000)\n'
    '    ctx_block = ""\n'
    '    if catalog_ctx:\n'
    '        ctx_block = "\\nCATALOGO DE PARTES REALES:\\n" + catalog_ctx\n'
    '    SYS = (\n'
    '        "Eres el sistema experto de diagnóstico de flota de Hermes GTP. "\n'
    '        "Técnico maestro con 25 años en equipos pesados de minería y construcción. "\n'
    '        "IMPORTANTE: Usa los números de parte REALES del catálogo. No inventes números XXX. "\n'
    '        "Responde SOLO con un objeto JSON válido. Sin texto adicional. En español."\n'
    '        + ctx_block\n'
    '    )'
)
code = code.replace(old_diagnose, new_diagnose)

# 6. Inject workshop+catalog context into manual_lookup
old_manual = (
    '    SYS = (\n'
    '        "Eres el especialista de manuales técnicos de Hermes GTP. "\n'
    '        "Tienes acceso a: CAT740B, Komatsu D155AX-6, D65PX-16, DL420, "\n'
    '        "Hyundai DX225LCA, DX340LCA, DX360LCA, Hino HM400-3, Mack GR84B/GR64BX. "\n'
    '        "Responde SOLO con JSON válido. Sin texto adicional. En español."\n'
    '    )'
)
new_manual = (
    '    workshop_ctx = load_workshop_context(req.equipo, req.tema, max_chars=30000)\n'
    '    catalog_ctx = load_catalog_context(req.equipo, max_chars=20000)\n'
    '    ctx_block = ""\n'
    '    if workshop_ctx:\n'
    '        ctx_block += "\\nMANUAL DE TALLER:\\n" + workshop_ctx\n'
    '    if catalog_ctx:\n'
    '        ctx_block += "\\nCATALOGO:\\n" + catalog_ctx\n'
    '    SYS = (\n'
    '        "Eres el especialista de manuales técnicos de Hermes GTP. "\n'
    '        "Usa los datos reales del manual y catálogo proporcionados. "\n'
    '        "Responde SOLO con JSON válido. Sin texto adicional. En español."\n'
    '        + ctx_block\n'
    '    )'
)
code = code.replace(old_manual, new_manual)

with open(path, "w", encoding="utf-8") as f:
    f.write(code)

print("All fixes applied successfully")
