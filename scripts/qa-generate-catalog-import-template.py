#!/usr/bin/env python3
"""
Genera plantilla de importación de catálogo propio (parafarmacia FICTICIA) para QA en staging.
Salida: docs/qa/PLANTILLA_IMPORT_CATALOGO_PARAFARMACIA_QA.xlsx (+ .csv)
Primera hoja = datos (la app lee solo la primera hoja). Segunda hoja = instrucciones.
Sin datos reales. EAN con prefijo 29 (uso interno).
"""
import csv, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

HEADERS = ["Producto", "EAN", "SKU", "PVP", "Stock", "Stock mínimo", "Categoría", "Marca", "Descripción larga"]

def ean13(b12: str) -> str:
    s = sum(int(c) * (1 if i % 2 == 0 else 3) for i, c in enumerate(b12))
    return b12 + str((10 - s % 10) % 10)

rows = []
# 20 altas nuevas (SKU PI-IMP-xxx)
new_items = [
    ("Jabón de glicerina pastilla 100 g (QA)", "Higiene corporal", "QA Labs", 1.9, 50, 10),
    ("Esponja de baño suave (QA)", "Higiene corporal", "QA Labs", 2.2, 40, 8),
    ("Acondicionador cabello seco 250 ml (QA)", "Cuidado capilar", "QA Labs", 5.9, 25, 6),
    ("Mascarilla facial arcilla 75 ml (QA)", "Cuidado facial", "Dermo Test", 8.4, 18, 4),
    ("Contorno labial reparador (QA)", "Cuidado facial", "Dermo Test", 4.75, 30, 6),
    ("Crema pies muy secos 100 ml (QA)", "Cuidado corporal", "QA Labs", 6.3, 22, 5),
    ("Aftersun calmante 200 ml (QA)", "Fotoprotección", "Solaria Test", 9.8, 15, 4),
    ("Protector solar corporal SPF30 200 ml (QA)", "Fotoprotección", "Solaria Test", 12.9, 20, 5),
    ("Colutorio sin alcohol 500 ml (QA)", "Higiene bucal", "Sonrisa QA", 4.2, 35, 8),
    ("Seda dental menta (QA)", "Higiene bucal", "Sonrisa QA", 1.7, 60, 12),
    ("Tiritas resistentes al agua 20 uds (QA)", "Primeros auxilios", "CuraFácil Test", 3.1, 45, 10),
    ("Venda elástica 5 m (QA)", "Primeros auxilios", "CuraFácil Test", 2.9, 28, 6),
    ("Esparadrapo hipoalergénico (QA)", "Primeros auxilios", "CuraFácil Test", 1.95, 33, 8),
    ("Compresa frío/calor reutilizable (QA)", "Material sanitario", "CuraFácil Test", 5.5, 12, 3),
    ("Pulsioxímetro de dedo (QA)", "Material sanitario", "CuraFácil Test", 24.9, 6, 2),
    ("Toallitas desmaquillantes 25 uds (QA)", "Cuidado facial", "Dermo Test", 3.6, 48, 10),
    ("Gominolas multivitamínicas (QA)", "Complementos", "Vita Test", 8.95, 21, 5),
    ("Infusión relajante 20 sobres (QA)", "Nutrición", "Vita Test", 3.4, 37, 8),
    ("Biberón anticólico 250 ml (QA)", "Bebé", "BabyCare Test", 7.2, 14, 4),
    ("Chupete silicona 0-6 m (QA)", "Bebé", "BabyCare Test", 4.1, 26, 6),
]
for i, (name, cat, brand, price, stock, mn) in enumerate(new_items, start=1):
    sku = f"PI-IMP-{i:03d}"
    ean = ean13("29" + str(2000000000 + i * 11).zfill(10))
    rows.append([name, ean, sku, price, stock, mn, cat, brand, "Producto ficticio de QA. Sin validez comercial."])

# 4 actualizaciones de productos ya sembrados (match por SKU PI-QA-xxx -> action 'update')
upd = [
    ("PI-QA-001", "Gel de ducha hidratante 500 ml (QA)", 5.25, 60, 10, "Higiene corporal", "QA Labs"),
    ("PI-QA-020", "Crema pañal 100 ml (QA)", 5.4, 18, 4, "Bebé", "BabyCare Test"),   # agotado -> disponible
    ("PI-QA-013", "Gel hidroalcohólico 250 ml (QA)", 2.7, 0, 25, "Higiene", "QA Labs"),  # disponible -> agotado
    ("PI-QA-004", "Protector solar facial SPF50 50 ml (QA)", 19.9, 24, 6, "Fotoprotección", "Solaria Test"),
]
for sku, name, price, stock, mn, cat, brand in upd:
    rows.append([name, "", sku, price, stock, mn, cat, brand, "Fila de ACTUALIZACIÓN (match por SKU)."])

# 3 filas con incidencias esperadas (probar validación del preview)
rows.append(["", "", "PI-ERR-001", 3.5, 5, 1, "Higiene", "QA Labs", "ERROR esperado: nombre vacío."])
rows.append(["Producto precio negativo (QA)", "", "PI-ERR-002", -4.0, 5, 1, "Higiene", "QA Labs", "ERROR esperado: precio negativo."])
rows.append(["Producto stock decimal (QA)", "", "PI-ERR-003", 2.0, "abc", 1, "Higiene", "QA Labs", "AVISO/ERROR esperado: stock no numérico."])

out = os.path.join(os.path.dirname(__file__), "..", "docs", "qa")
os.makedirs(out, exist_ok=True)

wb = Workbook()
ws = wb.active
ws.title = "Catalogo"
ws.append(HEADERS)
for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="0F766E")
for r in rows:
    ws.append(r)
for col, w in zip("ABCDEFGHI", (46, 16, 14, 9, 8, 13, 20, 16, 46)):
    ws.column_dimensions[col].width = w

info = wb.create_sheet("Instrucciones")
for line in [
    ["PLANTILLA QA — FICTICIA — SIN VALIDEZ COMERCIAL"],
    ["Destino: Farmacia Piloto Integral (staging) · catálogo propio (catalog_mode = own)."],
    ["Solo staging dazfdcjscnpfvhcyjddt. NO importar en producción."],
    [""],
    ["Filas 2-21: 20 altas nuevas (SKU PI-IMP-001..020) → acción esperada: crear."],
    ["Filas 22-25: 4 actualizaciones por SKU (PI-QA-001/020/013/004) → acción esperada: actualizar."],
    ["Filas 26-28: incidencias esperadas (nombre vacío, precio negativo, stock no numérico) → error/aviso en preview."],
    ["La app solo lee la primera hoja ('Catalogo'). Esta hoja es informativa."],
    ["Rol necesario: catalog.manage (propietario/administrador). Farmacéutico/staff solo stock."],
]:
    info.append(line)
info.column_dimensions["A"].width = 110

wb.save(os.path.join(out, "PLANTILLA_IMPORT_CATALOGO_PARAFARMACIA_QA.xlsx"))
with open(os.path.join(out, "PLANTILLA_IMPORT_CATALOGO_PARAFARMACIA_QA.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(HEADERS)
    w.writerows(rows)
print("OK", len(rows), "filas")
