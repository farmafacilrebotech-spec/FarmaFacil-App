#!/usr/bin/env python3
"""Generate MATRIZ_PRUEBAS.csv + .xlsx from canonical case list. Docs-only helper."""
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "MATRIZ_PRUEBAS.csv"
XLSX_PATH = ROOT / "MATRIZ_PRUEBAS.xlsx"

COLS = [
    "ID",
    "Modulo",
    "Rol",
    "Pantalla_ID",
    "Ruta",
    "Requisitos",
    "Datos_prueba",
    "Pasos",
    "Resultado_esperado",
    "Resultado_obtenido",
    "Estado",
    "Prioridad",
    "Evidencia",
    "Incidencia",
    "Fecha",
    "Responsable",
    "Tipo",
    "Escritura",
    "Manual_ref",
]

AUTH = "Requiere autorización y entorno/datos de prueba"
PEND = "Captura pendiente"
NE = "No ejecutada"

rows: list[dict[str, str]] = []


def add(**kw: str) -> None:
    r = {c: "" for c in COLS}
    r.update(kw)
    r["Resultado_obtenido"] = kw.get("Resultado_obtenido", "")
    r["Estado"] = kw.get("Estado", NE)
    r["Evidencia"] = kw.get("Evidencia", PEND)
    r["Incidencia"] = kw.get("Incidencia", "")
    r["Fecha"] = kw.get("Fecha", "")
    r["Responsable"] = kw.get("Responsable", "")
    rows.append(r)


def build() -> None:
    add(
        ID="TC-FAR-001",
        Modulo="Auth farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-AUTH-001",
        Ruta="/login",
        Requisitos="Usuario farmacia activo",
        Datos_prueba="email+password prueba",
        Pasos="1 Abrir /login 2 Credenciales 3 Enviar",
        Resultado_esperado="Llega a dashboard o selector farmacia",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §1.1",
    )
    add(
        ID="TC-FAR-002",
        Modulo="Auth farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-AUTH-004",
        Ruta="/first-access",
        Requisitos="Invitación válida",
        Datos_prueba="enlace invitación",
        Pasos="1 Abrir enlace 2 Definir password si aplica 3 Aceptar",
        Resultado_esperado="Membresía activa y acceso panel",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §1.2",
    )
    add(
        ID="TC-FAR-003",
        Modulo="Auth farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-AUTH-002",
        Ruta="/forgot-password",
        Requisitos="Email registrado",
        Datos_prueba="email prueba",
        Pasos="1 Solicitar reset 2 Abrir correo 3 Nueva password",
        Resultado_esperado="Puede iniciar sesión con nueva password",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §1.3",
    )
    add(
        ID="TC-FAR-004",
        Modulo="Auth farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-AUTH-001",
        Ruta="/login",
        Requisitos="N/A",
        Datos_prueba="password incorrecta",
        Pasos="1 Login con password mala",
        Resultado_esperado="Error visible sin acceso",
        Prioridad="P0",
        Tipo="Negativa",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §1.1",
    )
    add(
        ID="TC-FAR-010",
        Modulo="Dashboard",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-001",
        Ruta="/f/[pharmacyId]/dashboard",
        Requisitos="Sesión farmacia",
        Datos_prueba="farmacia operable",
        Pasos="1 Abrir dashboard",
        Resultado_esperado="Resumen coherente y navegación",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §2",
    )
    add(
        ID="TC-FAR-011",
        Modulo="Estadísticas",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-001",
        Ruta="/f/[pharmacyId]/dashboard",
        Requisitos="Sesión farmacia",
        Datos_prueba="farmacia con pedidos",
        Pasos="1 Revisar métricas resumen",
        Resultado_esperado="Cifras alineadas con pedidos conocidos",
        Prioridad="P2",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §8",
    )
    add(
        ID="TC-FAR-020",
        Modulo="Pedidos",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-002",
        Ruta="/f/[pharmacyId]/pedidos",
        Requisitos="canManage según rol",
        Datos_prueba="pedido de prueba",
        Pasos="1 Listar 2 Filtrar 3 Abrir 4 Cambiar estado",
        Resultado_esperado="Estado actualizado",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §3",
    )
    add(
        ID="TC-FAR-021",
        Modulo="Pedidos permisos",
        Rol="STAFF",
        Pantalla_ID="SCR-FAR-002",
        Ruta="/f/[pharmacyId]/pedidos",
        Requisitos="Usuario STAFF",
        Datos_prueba="pedido existente",
        Pasos="1 Abrir pedidos 2 Intentar acciones de gestión",
        Resultado_esperado="Solo lectura o acciones limitadas según UI",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §3",
    )
    add(
        ID="TC-FAR-030",
        Modulo="Catálogo",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-003",
        Ruta="/f/[pharmacyId]/catalogo",
        Requisitos="Sesión farmacia",
        Datos_prueba="producto prueba",
        Pasos="1 Buscar 2 Editar visibilidad/stock 3 Guardar",
        Resultado_esperado="Cambio reflejado en QR/kiosko",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §4",
    )
    add(
        ID="TC-FAR-031",
        Modulo="Import Excel",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-003",
        Ruta="/f/[pharmacyId]/catalogo",
        Requisitos="Modo catálogo own",
        Datos_prueba="archivo Excel válido",
        Pasos="1 Abrir import 2 Subir 3 Confirmar",
        Resultado_esperado="Filas importadas o errores listados",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §5",
    )
    add(
        ID="TC-FAR-032",
        Modulo="Import Excel negativa",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-003",
        Ruta="/f/[pharmacyId]/catalogo",
        Requisitos="Modo own",
        Datos_prueba="archivo columnas inválidas",
        Pasos="1 Importar archivo malo",
        Resultado_esperado="Rechazo o errores por fila sin corrupción masiva",
        Prioridad="P1",
        Tipo="Negativa",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §5",
    )
    add(
        ID="TC-FAR-040",
        Modulo="Clientes farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-004",
        Ruta="/f/[pharmacyId]/clientes",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="1 Abrir clientes",
        Resultado_esperado="ModulePlaceholder sin gestión real",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA pendiente",
    )
    add(
        ID="TC-FAR-041",
        Modulo="Promociones farmacia",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-005",
        Ruta="/f/[pharmacyId]/promociones",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="1 Abrir promociones",
        Resultado_esperado="ModulePlaceholder",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA pendiente",
    )
    add(
        ID="TC-FAR-050",
        Modulo="Pairing kiosko",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-009",
        Ruta="/f/[pharmacyId]/dispositivos",
        Requisitos="Entitlement kiosko activo",
        Datos_prueba="código one-time",
        Pasos="1 Generar código 2 Introducir en /k/pair",
        Resultado_esperado="Dispositivo listado y /k operativo",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §9",
    )
    add(
        ID="TC-FAR-051",
        Modulo="Pairing caducado",
        Rol="FARMACIA",
        Pantalla_ID="SCR-KSK-001",
        Ruta="/k/pair",
        Requisitos="Código expirado",
        Datos_prueba="código viejo",
        Pasos="1 Introducir código caducado",
        Resultado_esperado="Error sin emparejar",
        Prioridad="P1",
        Tipo="Negativa",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §9",
    )
    add(
        ID="TC-FAR-060",
        Modulo="Configuración",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-010",
        Ruta="/f/[pharmacyId]/configuracion",
        Requisitos="Sesión farmacia",
        Datos_prueba="farmacia prueba",
        Pasos="1 Abrir configuración 2 Revisar/guardar si aplica",
        Resultado_esperado="Datos persistidos según permisos",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §10",
    )
    add(
        ID="TC-FAR-070",
        Modulo="Usuarios farmacia",
        Rol="OWNER",
        Pantalla_ID="SCR-FAR-008",
        Ruta="/f/[pharmacyId]/usuarios",
        Requisitos="OWNER o ADMIN",
        Datos_prueba="email nuevo",
        Pasos="1 Invitar rol permitido 2 Aceptar invitación",
        Resultado_esperado="Usuario activo con rol",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §11",
    )
    add(
        ID="TC-FAR-071",
        Modulo="Usuarios jerarquía",
        Rol="ADMIN",
        Pantalla_ID="SCR-FAR-008",
        Ruta="/f/[pharmacyId]/usuarios",
        Requisitos="ADMIN",
        Datos_prueba="intento invitar OWNER",
        Pasos="1 Intentar crear OWNER",
        Resultado_esperado="No permitido",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §11",
    )
    add(
        ID="TC-FAR-072",
        Modulo="No auto-suspensión",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-008",
        Ruta="/f/[pharmacyId]/usuarios",
        Requisitos="Usuario activo",
        Datos_prueba="self",
        Pasos="1 Intentar suspenderse",
        Resultado_esperado="Bloqueado",
        Prioridad="P1",
        Tipo="Negativa",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §11",
    )
    add(
        ID="TC-FAR-080",
        Modulo="Asistente IA",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-006",
        Ruta="/f/[pharmacyId]/asistente",
        Requisitos="Entitlement asistente",
        Datos_prueba="config prueba",
        Pasos="1 Configurar 2 Guardar 3 Ver consultas",
        Resultado_esperado="Config aplicada y consultas visibles",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §12",
    )
    add(
        ID="TC-FAR-081",
        Modulo="Asistente off",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-006",
        Ruta="/f/[pharmacyId]/asistente",
        Requisitos="Entitlement off",
        Datos_prueba="farmacia sin módulo",
        Pasos="1 Abrir asistente",
        Resultado_esperado="Indica no disponible",
        Prioridad="P1",
        Tipo="Negativa",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §12",
    )
    add(
        ID="TC-FAR-090",
        Modulo="Responsive panel",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-002",
        Ruta="/f/[pharmacyId]/pedidos",
        Requisitos="Móvil 390px",
        Datos_prueba="sesión farmacia",
        Pasos="1 Abrir pedidos en viewport móvil",
        Resultado_esperado="UI usable sin solapes críticos",
        Prioridad="P2",
        Tipo="Responsive",
        Escritura="No",
        Manual_ref="MANUAL_FARMACIA §3",
    )

    add(
        ID="TC-CLI-001",
        Modulo="Registro cliente",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-007",
        Ruta="/e/[publicId]/cuenta/registro",
        Requisitos="Farmacia operable",
        Datos_prueba="email nuevo",
        Pasos="1 Completar formulario 2 Enviar",
        Resultado_esperado="Cuenta creada o pending confirm",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §1",
    )
    add(
        ID="TC-CLI-002",
        Modulo="Confirm email",
        Rol="CLIENTE",
        Pantalla_ID="SCR-AUTH-005",
        Ruta="/auth/callback",
        Requisitos="Email de confirmación",
        Datos_prueba="enlace válido",
        Pasos="1 Abrir enlace",
        Resultado_esperado="Email confirmado",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §2",
    )
    add(
        ID="TC-CLI-003",
        Modulo="Login cliente",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-006",
        Ruta="/e/[publicId]/cuenta/entrar",
        Requisitos="Cuenta confirmada",
        Datos_prueba="email+password",
        Pasos="1 Login",
        Resultado_esperado="Acceso a cuenta farmacia",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §3",
    )
    add(
        ID="TC-CLI-004",
        Modulo="Reset cliente",
        Rol="CLIENTE",
        Pantalla_ID="SCR-AUTH-002",
        Ruta="/forgot-password",
        Requisitos="Cuenta cliente",
        Datos_prueba="email",
        Pasos="1 Reset flow",
        Resultado_esperado="Nueva password funciona",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §4",
    )
    add(
        ID="TC-CLI-010",
        Modulo="Hub cuenta",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-001",
        Ruta="/cuenta",
        Requisitos="Sesión cliente",
        Datos_prueba="cuenta prueba",
        Pasos="1 Abrir /cuenta",
        Resultado_esperado="Hub accesible (PWA)",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §5.1",
    )
    add(
        ID="TC-CLI-011",
        Modulo="Perfil",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-008",
        Ruta="/e/[publicId]/cuenta/perfil",
        Requisitos="Sesión cliente",
        Datos_prueba="datos editables",
        Pasos="1 Editar 2 Guardar",
        Resultado_esperado="Persistencia tras reload",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §5.2",
    )
    add(
        ID="TC-CLI-012",
        Modulo="Cuenta contextual",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-005",
        Ruta="/e/[publicId]/cuenta",
        Requisitos="Sesión cliente",
        Datos_prueba="publicId válido",
        Pasos="1 Abrir cuenta farmacia",
        Resultado_esperado="Enlaces a pedidos perfil direcciones",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §5.3",
    )
    add(
        ID="TC-CLI-013",
        Modulo="Direcciones",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-009",
        Ruta="/e/[publicId]/cuenta/direcciones",
        Requisitos="Sesión cliente",
        Datos_prueba="dirección prueba",
        Pasos="1 Alta 2 Edición 3 Baja",
        Resultado_esperado="CRUD según UI",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §6",
    )
    add(
        ID="TC-CLI-014",
        Modulo="Mis farmacias",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-004",
        Ruta="/cuenta/mis-farmacias",
        Requisitos="Sesión cliente",
        Datos_prueba="farmacia guardable",
        Pasos="1 Guardar 2 Listar 3 Quitar",
        Resultado_esperado="Listado actualizado",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §7",
    )
    add(
        ID="TC-CLI-020",
        Modulo="Acceso QR",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-001",
        Ruta="/e/[publicId]",
        Requisitos="publicId válido",
        Datos_prueba="N/A",
        Pasos="1 Abrir landing QR",
        Resultado_esperado="Catálogo o landing de esa farmacia",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §8",
    )
    add(
        ID="TC-CLI-021",
        Modulo="Catálogo búsqueda",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-002",
        Ruta="/e/[publicId]/catalogo",
        Requisitos="Catálogo con productos",
        Datos_prueba="término búsqueda",
        Pasos="1 Buscar 2 Filtrar",
        Resultado_esperado="Resultados coherentes",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §9",
    )
    add(
        ID="TC-CLI-022",
        Modulo="Catálogo responsive",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-002",
        Ruta="/e/[publicId]/catalogo",
        Requisitos="Viewport 375-430",
        Datos_prueba="N/A",
        Pasos="1 Revisar chips/grid móvil",
        Resultado_esperado="Legible y usable (baseline 00e8de4)",
        Prioridad="P2",
        Tipo="Responsive",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §9",
    )
    add(
        ID="TC-CLI-030",
        Modulo="Pedido autenticado",
        Rol="CLIENTE",
        Pantalla_ID="SCR-PUB-002",
        Ruta="/e/[publicId]/catalogo",
        Requisitos="Sesión cliente",
        Datos_prueba="productos",
        Pasos="1 Add 2 Confirmar",
        Resultado_esperado="Pedido en Mis pedidos",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §10",
    )
    add(
        ID="TC-CLI-031",
        Modulo="Pedido invitado",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-002",
        Ruta="/e/[publicId]/catalogo",
        Requisitos="Sin sesión",
        Datos_prueba="productos",
        Pasos="1 Pedir sin login",
        Resultado_esperado="Pedido creado con seguimiento token o WhatsApp",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_CLIENTE §11",
    )
    add(
        ID="TC-CLI-032",
        Modulo="Mis pedidos",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-010",
        Ruta="/e/[publicId]/cuenta/pedidos",
        Requisitos="Pedido vinculado",
        Datos_prueba="cuenta",
        Pasos="1 Abrir Mis pedidos",
        Resultado_esperado="Solo pedidos propios",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §12",
    )
    add(
        ID="TC-CLI-033",
        Modulo="Presupuesto token",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-003",
        Ruta="/q/[token]",
        Requisitos="Token válido",
        Datos_prueba="token pedido",
        Pasos="1 Abrir enlace",
        Resultado_esperado="Detalle presupuesto/seguimiento",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §13",
    )
    add(
        ID="TC-CLI-034",
        Modulo="Token inválido",
        Rol="PUBLIC",
        Pantalla_ID="SCR-PUB-003",
        Ruta="/q/token-invalido",
        Requisitos="N/A",
        Datos_prueba="token falso",
        Pasos="1 Abrir",
        Resultado_esperado="Error o no encontrado sin fuga datos",
        Prioridad="P1",
        Tipo="Negativa",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §13",
    )
    add(
        ID="TC-CLI-040",
        Modulo="PWA",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-001",
        Ruta="/cuenta",
        Requisitos="Móvil compatible",
        Datos_prueba="N/A",
        Pasos="1 Añadir a inicio 2 Abrir icono",
        Resultado_esperado="Abre misma app web",
        Prioridad="P2",
        Tipo="PWA",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §14",
    )
    add(
        ID="TC-CLI-041",
        Modulo="PWA manifest",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-001",
        Ruta="/cuenta",
        Requisitos="Navegador con soporte PWA",
        Datos_prueba="N/A",
        Pasos="1 Abrir manifest o DevTools Application 2 Verificar name icons start_url",
        Resultado_esperado="Manifest e iconos presentes sin error",
        Prioridad="P2",
        Tipo="PWA",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §14",
    )
    add(
        ID="TC-CLI-050",
        Modulo="Logout y legal",
        Rol="CLIENTE",
        Pantalla_ID="SCR-LEG-001",
        Ruta="/legal/privacidad",
        Requisitos="Sesión cliente",
        Datos_prueba="N/A",
        Pasos="1 Leer legal 2 Cerrar sesión",
        Resultado_esperado="Sin acceso a pedidos tras logout",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_CLIENTE §15",
    )

    add(
        ID="TC-SA-001",
        Modulo="Login SA",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-AUTH-001",
        Ruta="/login",
        Requisitos="Usuario SA",
        Datos_prueba="credenciales prueba",
        Pasos="1 Login",
        Resultado_esperado="Dashboard SA",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §1",
    )
    add(
        ID="TC-SA-002",
        Modulo="Login Soporte nav",
        Rol="SOPORTE",
        Pantalla_ID="SCR-SA-002",
        Ruta="/farmacias",
        Requisitos="Usuario soporte",
        Datos_prueba="credenciales",
        Pasos="1 Login 2 Revisar nav",
        Resultado_esperado="Solo Farmacias e Inventario",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN perfiles",
    )
    add(
        ID="TC-SA-010",
        Modulo="Dashboard SA",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-001",
        Ruta="/dashboard",
        Requisitos="Sesión SA",
        Datos_prueba="N/A",
        Pasos="1 Abrir dashboard",
        Resultado_esperado="Carga con acciones deshabilitadas según baseline",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §2",
    )
    add(
        ID="TC-SA-011",
        Modulo="Estadísticas SA",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-001",
        Ruta="/dashboard",
        Requisitos="Sesión SA",
        Datos_prueba="N/A",
        Pasos="1 Revisar resumen",
        Resultado_esperado="Sin módulo analítico avanzado",
        Prioridad="P2",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §12",
    )
    add(
        ID="TC-SA-020",
        Modulo="Listado farmacias",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-002",
        Ruta="/farmacias",
        Requisitos="Sesión SA/Soporte",
        Datos_prueba="N/A",
        Pasos="1 Buscar/filtrar",
        Resultado_esperado="Listado correcto e import/export disabled",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §3.1",
    )
    add(
        ID="TC-SA-021",
        Modulo="Alta farmacia",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-003",
        Ruta="/farmacias/nueva",
        Requisitos="SA Total",
        Datos_prueba="datos farmacia prueba",
        Pasos="1 Crear farmacia",
        Resultado_esperado="Aparece en listado/ficha",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_SUPERADMIN §3.2",
    )
    add(
        ID="TC-SA-022",
        Modulo="Ficha farmacia",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-004",
        Ruta="/farmacias/[id]",
        Requisitos="Sesión SA/Soporte",
        Datos_prueba="id existente",
        Pasos="1 Abrir ficha 2 Revisar tabs",
        Resultado_esperado="Datos OK y tabs no ready marcados",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §3.3",
    )
    add(
        ID="TC-SA-023",
        Modulo="Soporte no crea farmacia",
        Rol="SOPORTE",
        Pantalla_ID="SCR-SA-003",
        Ruta="/farmacias/nueva",
        Requisitos="Usuario soporte",
        Datos_prueba="N/A",
        Pasos="1 Intentar /farmacias/nueva",
        Resultado_esperado="Denegado o no en nav",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §3.2",
    )
    add(
        ID="TC-SA-030",
        Modulo="Usuarios plataforma",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-011",
        Ruta="/usuarios",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="1 Abrir /usuarios",
        Resultado_esperado="Stub/placeholder",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §4",
    )
    add(
        ID="TC-SA-040",
        Modulo="Cartera CRM",
        Rol="SUPERADMIN",
        Pantalla_ID="FUT-CARTERA",
        Ruta="N/A",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="N/A",
        Resultado_esperado="Feature no publicada",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §5",
    )
    add(
        ID="TC-SA-050",
        Modulo="Tarifas simulador",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-010",
        Ruta="/tarifas",
        Requisitos="Sesión SA",
        Datos_prueba="parámetros tarifa",
        Pasos="1 Simular precios",
        Resultado_esperado="Resultado coherente con reglas",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §6",
    )
    add(
        ID="TC-SA-051",
        Modulo="Contratos UI",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-017",
        Ruta="/contratos",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="1 Abrir /contratos",
        Resultado_esperado="Placeholder Fase 4",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §7",
    )
    add(
        ID="TC-SA-060",
        Modulo="Inventario listado",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-005",
        Ruta="/inventario-kioskos",
        Requisitos="SA/Soporte",
        Datos_prueba="N/A",
        Pasos="1 Abrir inventario",
        Resultado_esperado="Listado/conteos",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §8.1",
    )
    add(
        ID="TC-SA-061",
        Modulo="Asignación activo",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-006",
        Ruta="/inventario-kioskos/[assetId]",
        Requisitos="Activo existente",
        Datos_prueba="farmacia destino",
        Pasos="1 Asignar/cambiar estado",
        Resultado_esperado="Estado/asignación persistidos",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_SUPERADMIN §8.2",
    )
    add(
        ID="TC-SA-062",
        Modulo="Pegatina código",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-007",
        Ruta="/inventario-kioskos/[assetId]/pegatina",
        Requisitos="Activo",
        Datos_prueba="assetCode",
        Pasos="1 Ver pegatina 2 Resolver código",
        Resultado_esperado="Redirección a detalle",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §8.3",
    )
    add(
        ID="TC-SA-070",
        Modulo="Historial errores",
        Rol="SUPERADMIN",
        Pantalla_ID="FUT-066",
        Ruta="N/A",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="N/A",
        Resultado_esperado="No publicado",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §9",
    )
    add(
        ID="TC-SA-071",
        Modulo="Compras proveedores",
        Rol="SUPERADMIN",
        Pantalla_ID="FUT-068",
        Ruta="N/A",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="N/A",
        Resultado_esperado="No publicado",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §10",
    )
    add(
        ID="TC-SA-080",
        Modulo="Catálogo maestro",
        Rol="SUPERADMIN",
        Pantalla_ID="SCR-SA-009",
        Ruta="/catalogo",
        Requisitos="Sesión SA",
        Datos_prueba="producto maestro",
        Pasos="1 Buscar/editar según UI",
        Resultado_esperado="Cambios según permisos",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_SUPERADMIN §11",
    )
    add(
        ID="TC-SA-090",
        Modulo="Calendario",
        Rol="SUPERADMIN",
        Pantalla_ID="FUT-AGENDA",
        Ruta="N/A",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="N/A",
        Resultado_esperado="No publicado",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §13",
    )
    add(
        ID="TC-SA-091",
        Modulo="Comunicaciones UI",
        Rol="SUPERADMIN",
        Pantalla_ID="N/A",
        Ruta="N/A",
        Requisitos="N/A",
        Datos_prueba="N/A",
        Pasos="N/A",
        Resultado_esperado="Sin bandeja campañas publicada",
        Prioridad="P3",
        Tipo="No aplicable",
        Escritura="No",
        Manual_ref="MANUAL_SUPERADMIN §14",
    )

    add(
        ID="TC-KSK-001",
        Modulo="Pair device",
        Rol="KIOSKO",
        Pantalla_ID="SCR-KSK-001",
        Ruta="/k/pair",
        Requisitos="Código válido",
        Datos_prueba="código fresco",
        Pasos="1 Introducir código",
        Resultado_esperado="Sesión dispositivo",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="MANUAL_FARMACIA §9",
    )
    add(
        ID="TC-KSK-010",
        Modulo="Pedido kiosko",
        Rol="KIOSKO",
        Pantalla_ID="SCR-KSK-005",
        Ruta="/k/carrito",
        Requisitos="Dispositivo emparejado",
        Datos_prueba="productos",
        Pasos="1 Catálogo 2 Carrito 3 Confirmar",
        Resultado_esperado="Pedido llega a farmacia",
        Prioridad="P0",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="E2E-D",
    )
    add(
        ID="TC-KSK-011",
        Modulo="Impresión ticket",
        Rol="KIOSKO",
        Pantalla_ID="SCR-KSK-005",
        Ruta="/k/carrito",
        Requisitos="APK+impresora",
        Datos_prueba="pedido",
        Pasos="1 Confirmar con print",
        Resultado_esperado="Ticket físico (si no hay APK: Bloqueada)",
        Prioridad="P1",
        Tipo="Positiva",
        Escritura=AUTH,
        Manual_ref="E2E-D",
    )

    add(
        ID="TC-ISO-001",
        Modulo="Aislamiento cliente-profesional",
        Rol="CLIENTE",
        Pantalla_ID="SCR-SYS-002",
        Ruta="/dashboard",
        Requisitos="Sesión solo cliente",
        Datos_prueba="N/A",
        Pasos="1 Abrir /dashboard o /f/...",
        Resultado_esperado="Access denied o redirect",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="E2E-E",
    )
    add(
        ID="TC-ISO-002",
        Modulo="Aislamiento pedidos ajenos",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-010",
        Ruta="/e/[publicId]/cuenta/pedidos",
        Requisitos="Dos cuentas cliente",
        Datos_prueba="pedidos A y B",
        Pasos="1 Login A 2 Ver pedidos",
        Resultado_esperado="No ve pedidos de B",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="E2E-E",
    )
    add(
        ID="TC-ISO-003",
        Modulo="Aislamiento entre farmacias",
        Rol="FARMACIA",
        Pantalla_ID="SCR-FAR-002",
        Ruta="/f/[pharmacyId]/pedidos",
        Requisitos="Usuario solo de farmacia A",
        Datos_prueba="pedido de farmacia B",
        Pasos="1 Login miembro A 2 Intentar URL /f/B/pedidos o ID pedido B",
        Resultado_esperado="Sin acceso a pedidos ni datos de farmacia B",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="E2E-E",
    )
    add(
        ID="TC-ISO-004",
        Modulo="Aislamiento publicId cruzado",
        Rol="CLIENTE",
        Pantalla_ID="SCR-CLI-010",
        Ruta="/e/[publicIdB]/cuenta/pedidos",
        Requisitos="Cliente con pedidos solo en farmacia A",
        Datos_prueba="publicId B",
        Pasos="1 Login 2 Abrir Mis pedidos de publicId B",
        Resultado_esperado="No lista pedidos de A bajo B ni datos ajenos",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="E2E-E",
    )
    add(
        ID="TC-ISO-005",
        Modulo="Cuenta dual aislamiento",
        Rol="MULTI",
        Pantalla_ID="SCR-AUTH-001",
        Ruta="/login y /cuenta/entrar",
        Requisitos="Mismo email con rol profesional y cliente si aplica",
        Datos_prueba="user dual",
        Pasos="1 Acceso profesional 2 Cerrar o privada 3 Acceso cliente 4 Comparar datasets",
        Resultado_esperado="Datos de panel farmacia no aparecen en cuenta cliente y viceversa",
        Prioridad="P0",
        Tipo="Permisos",
        Escritura="No",
        Manual_ref="E2E-E",
    )

    add(
        ID="TC-E2E-A",
        Modulo="Recorrido A",
        Rol="MULTI",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Ver RECORRIDOS_E2E",
        Datos_prueba="datos piloto",
        Pasos="Ver E2E-A",
        Resultado_esperado="Cadena alta a pedido OK",
        Prioridad="P0",
        Tipo="E2E",
        Escritura=AUTH,
        Manual_ref="RECORRIDOS_E2E E2E-A",
    )
    add(
        ID="TC-E2E-B",
        Modulo="Recorrido B",
        Rol="CLIENTE",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Ver RECORRIDOS_E2E",
        Datos_prueba="cliente nuevo",
        Pasos="Ver E2E-B",
        Resultado_esperado="Registro a Mis pedidos",
        Prioridad="P0",
        Tipo="E2E",
        Escritura=AUTH,
        Manual_ref="RECORRIDOS_E2E E2E-B",
    )
    add(
        ID="TC-E2E-C",
        Modulo="Recorrido C",
        Rol="SUPERADMIN",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Features comerciales",
        Datos_prueba="N/A",
        Pasos="Ver E2E-C",
        Resultado_esperado="Tramos N/A marcados, tarifas+alta sí",
        Prioridad="P3",
        Tipo="E2E",
        Escritura=AUTH,
        Manual_ref="RECORRIDOS_E2E E2E-C",
    )
    add(
        ID="TC-E2E-D",
        Modulo="Recorrido D",
        Rol="MULTI",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Hardware/APK opc",
        Datos_prueba="activo+farmacia",
        Pasos="Ver E2E-D",
        Resultado_esperado="Pairing+pedido, print condicional",
        Prioridad="P0",
        Tipo="E2E",
        Escritura=AUTH,
        Manual_ref="RECORRIDOS_E2E E2E-D",
    )
    add(
        ID="TC-E2E-E",
        Modulo="Recorrido E",
        Rol="MULTI",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Cuenta dual",
        Datos_prueba="user dual",
        Pasos="Ver E2E-E",
        Resultado_esperado="Aislamiento OK",
        Prioridad="P0",
        Tipo="E2E",
        Escritura="No",
        Manual_ref="RECORRIDOS_E2E E2E-E",
    )
    add(
        ID="TC-E2E-F",
        Modulo="Recorrido F",
        Rol="MULTI",
        Pantalla_ID="varios",
        Ruta="varios",
        Requisitos="Auth+invitado",
        Datos_prueba="productos",
        Pasos="Ver E2E-F",
        Resultado_esperado="Diferencias seguimiento claras",
        Prioridad="P0",
        Tipo="E2E",
        Escritura=AUTH,
        Manual_ref="RECORRIDOS_E2E E2E-F",
    )


def write_csv() -> None:
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, delimiter=";")
        w.writeheader()
        w.writerows(rows)


def write_xlsx() -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Matriz"
    header_fill = PatternFill("solid", "1F4E79")
    header_font = Font(color="FFFFFF", bold=True)
    thin = Border(
        left=Side(style="thin", color="D0D7DE"),
        right=Side(style="thin", color="D0D7DE"),
        top=Side(style="thin", color="D0D7DE"),
        bottom=Side(style="thin", color="D0D7DE"),
    )
    for col, name in enumerate(COLS, 1):
        cell = ws.cell(1, col, name)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    for i, r in enumerate(rows, 2):
        for col, name in enumerate(COLS, 1):
            cell = ws.cell(i, col, r[name])
            cell.border = thin
            cell.alignment = Alignment(vertical="top", wrap_text=True)
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}{len(rows) + 1}"
    ws.freeze_panes = "A2"
    widths = {
        "ID": 12,
        "Modulo": 28,
        "Rol": 12,
        "Pantalla_ID": 14,
        "Ruta": 36,
        "Requisitos": 28,
        "Datos_prueba": 22,
        "Pasos": 42,
        "Resultado_esperado": 36,
        "Resultado_obtenido": 22,
        "Estado": 14,
        "Prioridad": 10,
        "Evidencia": 22,
        "Incidencia": 18,
        "Fecha": 12,
        "Responsable": 14,
        "Tipo": 12,
        "Escritura": 42,
        "Manual_ref": 28,
    }
    for col, name in enumerate(COLS, 1):
        ws.column_dimensions[get_column_letter(col)].width = widths.get(name, 16)

    dv1 = DataValidation(
        type="list",
        formula1='"No ejecutada,Correcta,Fallida,Bloqueada,No aplicable"',
        allow_blank=False,
    )
    dv2 = DataValidation(type="list", formula1='"P0,P1,P2,P3"', allow_blank=False)
    ws.add_data_validation(dv1)
    ws.add_data_validation(dv2)
    dv1.add(f"K2:K{len(rows) + 1}")
    dv2.add(f"L2:L{len(rows) + 1}")

    sm = wb.create_sheet("Resumen", 0)
    sm["A1"] = "Plan maestro de pruebas — FarmaFácil"
    sm["A1"].font = Font(bold=True, size=14)
    sm["A2"] = "Fuente canónica: MATRIZ_PRUEBAS.csv (mismos IDs). Baseline origin/main @ 00e8de4."
    sm["A3"] = "Estados iniciales: No ejecutada. No ejecutado en esta entrega documental."
    sm["A5"] = "Total casos"
    sm["B5"] = len(rows)
    sm["A6"] = "IDs únicos"
    sm["B6"] = len({r["ID"] for r in rows})

    sm["A8"] = "Por estado"
    sm["A8"].font = Font(bold=True)
    sm["A9"] = "Estado"
    sm["B9"] = "Recuento"
    for i, (k, v) in enumerate(sorted(Counter(r["Estado"] for r in rows).items()), 10):
        sm[f"A{i}"] = k
        sm[f"B{i}"] = v

    sm["A16"] = "Por prioridad"
    sm["A16"].font = Font(bold=True)
    sm["A17"] = "Prioridad"
    sm["B17"] = "Recuento"
    for i, (k, v) in enumerate(sorted(Counter(r["Prioridad"] for r in rows).items()), 18):
        sm[f"A{i}"] = k
        sm[f"B{i}"] = v

    sm["A24"] = "Por módulo"
    sm["A24"].font = Font(bold=True)
    sm["A25"] = "Módulo"
    sm["B25"] = "Recuento"
    for i, (k, v) in enumerate(sorted(Counter(r["Modulo"] for r in rows).items()), 26):
        sm[f"A{i}"] = k
        sm[f"B{i}"] = v

    sm["D5"] = "Por tipo"
    sm["D5"].font = Font(bold=True)
    sm["D6"] = "Tipo"
    sm["E6"] = "Recuento"
    for i, (k, v) in enumerate(sorted(Counter(r["Tipo"] for r in rows).items()), 7):
        sm[f"D{i}"] = k
        sm[f"E{i}"] = v

    sm["D16"] = "Escritura con autorización"
    sm["D16"].font = Font(bold=True)
    sm["E16"] = sum(1 for r in rows if r["Escritura"] == AUTH)
    sm["D17"] = "Casos permisos/aislamiento"
    sm["E17"] = sum(1 for r in rows if r["Tipo"] == "Permisos" or r["ID"].startswith("TC-ISO-"))
    sm["D18"] = "Responsive/PWA"
    sm["E18"] = sum(1 for r in rows if r["Tipo"] in ("Responsive", "PWA"))
    sm["D19"] = "Añadidos 2ª revisión"
    sm["E19"] = "TC-CLI-041, TC-ISO-003, TC-ISO-004, TC-ISO-005"

    sm.column_dimensions["A"].width = 36
    sm.column_dimensions["B"].width = 12
    sm.column_dimensions["D"].width = 32
    sm.column_dimensions["E"].width = 48

    ins = wb.create_sheet("Instrucciones")
    ins["A1"] = "Uso del Excel"
    ins["A1"].font = Font(bold=True, size=14)
    for i, t in enumerate(
        [
            "1. Hoja Matriz: filtros en fila 1 y encabezados fijos (freeze).",
            "2. Estado y Prioridad tienen lista desplegable.",
            "3. Resultado_obtenido, Evidencia, Incidencia, Fecha y Responsable se rellenan al ejecutar.",
            "4. Evidencia: ruta relativa a captura o URL. Sin datos personales.",
            "5. Escritura con autorización exige entorno/datos de prueba.",
            "6. CSV es la fuente canónica; regenerar xlsx con _gen_matriz.py si cambia.",
            "7. Pantalla_ID debe existir en INDICE_PANTALLAS.md (o FUT-* / N/A / varios).",
        ],
        3,
    ):
        ins[f"A{i}"] = t
    ins.column_dimensions["A"].width = 110

    wb.save(XLSX_PATH)


def main() -> None:
    build()
    ids = [r["ID"] for r in rows]
    dups = [i for i, c in Counter(ids).items() if c > 1]
    assert not dups, dups
    assert all(r["Estado"] == NE for r in rows)
    assert all(r["Prioridad"].startswith("P") for r in rows)
    write_csv()
    write_xlsx()
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        parsed = list(csv.DictReader(f, delimiter=";"))
    assert len(parsed) == len(rows)
    assert all(r["Estado"] == NE for r in parsed)
    print(f"OK cases={len(rows)} csv={CSV_PATH.name} xlsx={XLSX_PATH.name}")
    print("auth_writes", sum(1 for r in rows if r["Escritura"] == AUTH))
    print("permisos", sum(1 for r in rows if r["Tipo"] == "Permisos"))
    print("responsive_pwa", sum(1 for r in rows if r["Tipo"] in ("Responsive", "PWA")))


if __name__ == "__main__":
    main()
