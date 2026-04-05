"""Fix the broken ai_endpoints.py line 127."""
path = "/root/.hermes/hermes-agent/gateway/ai_endpoints.py"
with open(path, "r") as f:
    content = f.read()

# Remove the broken presearch block and replace with working version
old = '''    # Pre-search catalog for relevant parts
    from gateway.context_loader import search_catalog_parts
    presearch = search_catalog_parts(req.equipo, req.sintoma)
    catalog_ctx = presearch + "

" + load_catalog_context(req.equipo + " " + req.sintoma, max_chars=400000)'''

new = '''    from gateway.context_loader import search_catalog_parts
    presearch = search_catalog_parts(req.equipo, req.sintoma)
    full_ctx = load_catalog_context(req.equipo + " " + req.sintoma, max_chars=400000)
    catalog_ctx = presearch + "\\n\\n" + full_ctx if presearch else full_ctx'''

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("Fixed ai_endpoints.py")
