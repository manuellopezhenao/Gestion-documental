"""
Divide un PDF escaneado (multiples facturas/comprobantes concatenados) en
PDFs individuales, agrupando paginas por el numero de "Consecutivo" que
aparece impreso en la primera pagina de cada comprobante. Ademas extrae
cedula, nombre y fecha de esa primera pagina y los guarda en una base de
datos SQLite (documentos + personas) junto con el consecutivo y el archivo
generado, para poder buscar/gestionar los documentos despues.

Esquema de datos:
  - "personas": una fila por cedula (PK interno autoincrement, cedula
    UNIQUE). Evita duplicar a alguien si vuelve a aparecer en otro
    comprobante o en otro libro.
  - "documentos": PK interno autoincrement independiente del consecutivo
    leido en papel (que puede fallar el OCR, repetirse o no ser
    estrictamente secuencial). Referencia a personas via persona_id
    (NULL si no se pudo leer la cedula). La columna "revisar" se marca en 1
    cuando el consecutivo rompe la tendencia creciente/decreciente que
    traia el libro, para poder ir a comparar ese documento contra el
    anterior.

Regla de agrupacion:
  - Si una pagina contiene el texto "Consecutivo <numero>", esa pagina
    inicia un NUEVO documento.
  - Cualquier pagina siguiente que NO contenga "Consecutivo" se considera
    parte del documento anterior (continuacion), hasta encontrar la
    proxima pagina con "Consecutivo".

Extraccion de cedula/nombre/fecha:
  La primera pagina de cada comprobante repite la cedula y el nombre de
  la persona muchas veces (una vez en el encabezado y otra por cada fila
  del detalle contable). En vez de confiar en una sola lectura de OCR
  (que puede fallar un digito), se cuentan TODAS las coincidencias de esa
  pagina y se toma la mas frecuente (voto por mayoria). Esto es bastante
  mas confiable que leer solo el encabezado, sin necesitar una pasada de
  OCR adicional. La fecha se obtiene igual, tomando la fecha con formato
  AAAA/MM/DD que mas se repite en la pagina.

Requiere Tesseract OCR instalado (ya se instalo via winget:
UB-Mannheim.TesseractOCR) y el archivo tessdata/spa.traineddata que
acompana este script.

Uso:
    python split_consecutivos.py "ruta\al\archivo.pdf" --max-docs 5
    python split_consecutivos.py "ruta\al\archivo.pdf"           (PDF completo)
"""

import argparse
import os
import re
import sqlite3
from collections import Counter
from datetime import datetime

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TESSERACT_EXE = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

pytesseract.pytesseract.tesseract_cmd = TESSERACT_EXE
os.environ["TESSDATA_PREFIX"] = os.path.join(SCRIPT_DIR, "tessdata")

# Tolera errores tipicos de OCR sobre "Consecutivo" (p.ej. "Consecitivo",
# "Consecutwo") exigiendo solo el prefijo "consec" seguido en poca
# distancia por el numero.
CONSEC_RE = re.compile(r"consec\w*\D{0,12}(\d{3,8})", re.IGNORECASE)

# Cedula + nombre: numero de documento seguido (separado por espacio o
# puntuacion, nunca letras, para no comerse el nombre) del nombre en
# mayusculas. Aparece tanto en el encabezado como en cada fila del
# detalle contable de la pagina.
NAME_RE = re.compile(r"(\d{6,12})[ \t:.\-]{1,4}([A-ZÑÁÉÍÓÚÜ][A-ZÑÁÉÍÓÚÜ \.]{3,60})")

# Fecha en formato AAAA/MM/DD (o con - . como separador). Se exige el
# separador para evitar leer basura numerica como fecha.
DATE_RE = re.compile(r"(\d{4})[/\-.](\d{2})[/\-.](\d{2})")

# El nombre del libro de origen (ej. "LIBRO 2-2 ENERO 2024.pdf") suele decir
# el mes/anio de todo lo que contiene. Sirve de fecha aproximada cuando el
# OCR no pudo leer la fecha exacta impresa en el comprobante.
MESES = {
    "ENERO": "01", "FEBRERO": "02", "MARZO": "03", "ABRIL": "04",
    "MAYO": "05", "JUNIO": "06", "JULIO": "07", "AGOSTO": "08",
    "SEPTIEMBRE": "09", "SETIEMBRE": "09", "OCTUBRE": "10",
    "NOVIEMBRE": "11", "DICIEMBRE": "12",
}


def parse_periodo_libro(pdf_path):
    """Extrae AAAA/MM del nombre del archivo de origen, si lo trae."""
    name = os.path.basename(pdf_path).upper()
    year_match = re.search(r"(20\d{2})", name)
    mes = next((cod for nombre, cod in MESES.items() if nombre in name), None)
    if year_match and mes:
        return f"{year_match.group(1)}/{mes}"
    return None


def ocr_page_text(page, dpi):
    pix = page.get_pixmap(dpi=dpi)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    return pytesseract.image_to_string(img, lang="spa")


def find_consecutivo(text):
    m = CONSEC_RE.search(text)
    return m.group(1) if m else None


def extract_header_fields(text):
    """A partir del OCR completo de la primera pagina de un comprobante,
    obtiene cedula, nombre y fecha por voto de mayoria entre todas las
    coincidencias encontradas en la pagina."""
    matches = NAME_RE.findall(text)
    cedula = nombre = fecha = None

    if matches:
        cedula_counts = Counter(m[0] for m in matches)
        cedula = cedula_counts.most_common(1)[0][0]

        # El nombre suele salir truncado en las filas del detalle (columna
        # angosta) y completo solo en el encabezado, que a veces trae la
        # cedula con un digito mal leido. Por eso el nombre NO se filtra
        # por la cedula ganadora: se toma el mas repetido como base fiable
        # y, si existe una variante mas larga que empiece igual (el
        # encabezado con nombre completo), se prefiere esa.
        nombre_counts = Counter(re.sub(r"\s+", " ", m[1]).strip() for m in matches)
        base = nombre_counts.most_common(1)[0][0]
        candidatos = [c for c in nombre_counts if c.startswith(base)]
        nombre = max(candidatos, key=len)

    dates = DATE_RE.findall(text)
    if dates:
        date_counts = Counter(dates)
        y, mo, d = date_counts.most_common(1)[0][0]
        fecha = f"{y}/{mo}/{d}"

    return cedula, nombre, fecha


def build_output_path(out_dir, consecutivo, cedula, fecha, periodo_libro):
    """Organiza los PDFs en subcarpetas anio/mes para que la carpeta de salida
    sirva de archivo consultable por periodo, en vez de acumular miles de
    archivos sueltos. Usa la fecha exacta del comprobante si se pudo leer;
    si no, cae en el periodo aproximado del libro de origen (ver
    parse_periodo_libro). Solo si ninguna de las dos esta disponible el
    documento va a 'sin_fecha' para revisarlo manualmente.
    El nombre de archivo incluye la cedula para poder identificar el
    documento sin tener que abrir la base de datos."""
    periodo = fecha[:7] if fecha else periodo_libro
    if periodo:
        year, month = periodo.split("/")
        subdir = os.path.join(out_dir, year, month)
    else:
        subdir = os.path.join(out_dir, "sin_fecha")
    os.makedirs(subdir, exist_ok=True)

    base = f"{consecutivo}_{cedula}" if cedula else f"{consecutivo}_desconocido"
    path = os.path.join(subdir, f"{base}.pdf")
    if not os.path.exists(path):
        return path
    n = 2
    while True:
        path = os.path.join(subdir, f"{base}_{n}.pdf")
        if not os.path.exists(path):
            return path
        n += 1


def init_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    # Tabla de personas separada: el PK interno (id) es autoincrement y no
    # depende del OCR; la cedula es UNIQUE para no duplicar una persona si
    # vuelve a aparecer en otro comprobante o en otro libro.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS personas (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            cedula  TEXT UNIQUE,
            nombre  TEXT
        )
    """)
    # El PK de documentos tambien es el id interno autoincrement; el
    # "consecutivo" leido del papel se guarda aparte porque puede fallar,
    # repetirse o no ser estrictamente creciente. "revisar" marca los casos
    # donde el consecutivo rompe la tendencia (creciente o decreciente) que
    # traía el libro, para poder compararlos rapido contra el anterior.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS documentos (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutivo     TEXT NOT NULL,
            persona_id      INTEGER REFERENCES personas(id),
            fecha           TEXT,
            periodo_libro   TEXT,
            revisar         INTEGER NOT NULL DEFAULT 0,
            pagina_inicio   INTEGER NOT NULL,
            pagina_fin      INTEGER NOT NULL,
            archivo         TEXT NOT NULL,
            pdf_origen      TEXT NOT NULL,
            procesado_en    TEXT NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_documentos_consecutivo ON documentos(consecutivo)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_documentos_persona ON documentos(persona_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_personas_cedula ON personas(cedula)")
    conn.commit()
    return conn


def get_or_create_persona(conn, cedula, nombre):
    """Busca la persona por cedula (evita duplicarla si ya existe) o la crea.
    Si no se pudo leer la cedula, se deja persona_id en NULL en vez de
    inventar un valor: es preferible saber que falta el dato a esconderlo
    detras de un 'desconocido' que choque con otras filas sin dato."""
    if not cedula:
        return None
    row = conn.execute("SELECT id, nombre FROM personas WHERE cedula = ?", (cedula,)).fetchone()
    if row:
        persona_id, nombre_guardado = row
        if nombre and not nombre_guardado:
            conn.execute("UPDATE personas SET nombre = ? WHERE id = ?", (nombre, persona_id))
        return persona_id
    cur = conn.execute("INSERT INTO personas (cedula, nombre) VALUES (?, ?)", (cedula, nombre))
    return cur.lastrowid


def load_trend_state(conn, pdf_origen):
    """Retoma la tendencia (creciente/decreciente) del consecutivo a partir de
    los ultimos documentos ya guardados PARA ESE MISMO PDF de origen, para
    poder seguir comparando contra el anterior aunque el script se corra en
    varias tandas."""
    rows = conn.execute(
        "SELECT consecutivo FROM documentos WHERE pdf_origen = ? ORDER BY id DESC LIMIT 2",
        (pdf_origen,),
    ).fetchall()
    nums = []
    for (c,) in rows:
        try:
            nums.append(int(c))
        except (TypeError, ValueError):
            nums.append(None)
    last_num = nums[0] if nums else None
    last_direction = None
    if len(nums) == 2 and nums[0] is not None and nums[1] is not None and nums[0] != nums[1]:
        last_direction = 1 if nums[0] - nums[1] > 0 else -1
    return last_num, last_direction


def check_consecutivo(consecutivo, last_num, last_direction):
    """Compara el consecutivo actual contra el anterior. No lo trata como ley
    (un libro puede tener saltos por anulaciones), solo marca 'revisar' cuando
    se repite o cuando rompe la tendencia que traia, para poder ir a mirar
    ese documento puntual contra el anterior."""
    try:
        num = int(consecutivo)
    except (TypeError, ValueError):
        return last_num, last_direction, True  # no se pudo leer como numero: revisar

    revisar = False
    if last_num is not None:
        diff = num - last_num
        if diff == 0:
            revisar = True
        else:
            direction = 1 if diff > 0 else -1
            if last_direction is not None and direction != last_direction:
                revisar = True
            last_direction = direction
    return num, last_direction, revisar


def guardar_documento(conn, src, out_dir, pdf_origen, periodo_libro, ahora,
                       consecutivo, start, end, start_text, last_num, last_direction):
    """Escribe el PDF y la fila en la base de datos para UN documento ya
    cerrado (se le conoce pagina de inicio y fin). Se llama apenas se detecta
    el cierre del grupo, no al final de todo el libro, para que el progreso
    quede guardado en disco de inmediato y una corrida larga se pueda
    interrumpir/reanudar sin perder lo ya procesado."""
    cedula, nombre, fecha = extract_header_fields(start_text)

    out_path = build_output_path(out_dir, consecutivo, cedula, fecha, periodo_libro)
    new_doc = fitz.open()
    new_doc.insert_pdf(src, from_page=start, to_page=end)
    new_doc.save(out_path)
    new_doc.close()

    persona_id = get_or_create_persona(conn, cedula, nombre)
    last_num, last_direction, revisar = check_consecutivo(consecutivo, last_num, last_direction)

    conn.execute(
        "INSERT INTO documentos (consecutivo, persona_id, fecha, periodo_libro, revisar, pagina_inicio, "
        "pagina_fin, archivo, pdf_origen, procesado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (consecutivo, persona_id, fecha, periodo_libro, int(revisar), start, end,
         os.path.abspath(out_path), pdf_origen, ahora),
    )
    conn.commit()

    aviso = "  <-- REVISAR" if revisar else ""
    fecha_info = fecha or f"(sin fecha exacta, libro: {periodo_libro})"
    print(f"  -> {os.path.relpath(out_path, out_dir)}  (paginas {start}-{end}, {end - start + 1} pag.) "
          f"| cedula={cedula} nombre={nombre!r} fecha={fecha_info}{aviso}")

    return last_num, last_direction


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf_path", help="Ruta al PDF escaneado de origen")
    parser.add_argument("--out", default=None,
                         help="Carpeta de salida para los PDFs (default: <script>/output)")
    parser.add_argument("--db", default=None,
                         help="Ruta a la base de datos SQLite (default: <script>/documentos.db)")
    parser.add_argument("--max-docs", type=int, default=None,
                         help="Detener tras encontrar N documentos completos (util para pruebas)")
    parser.add_argument("--start-page", type=int, default=0,
                         help="Pagina (0-indexed) donde empezar a leer")
    parser.add_argument("--dpi", type=int, default=250,
                         help="Resolucion de render para el OCR (mas alto = mas lento pero mas preciso)")
    args = parser.parse_args()

    out_dir = args.out or os.path.join(SCRIPT_DIR, "output")
    db_path = args.db or os.path.join(SCRIPT_DIR, "documentos.db")
    os.makedirs(out_dir, exist_ok=True)

    src = fitz.open(args.pdf_path)
    n_pages = len(src)

    conn = init_db(db_path)
    pdf_origen = os.path.abspath(args.pdf_path)
    periodo_libro = parse_periodo_libro(args.pdf_path)
    ahora = datetime.now().isoformat(timespec="seconds")
    last_num, last_direction = load_trend_state(conn, pdf_origen)

    current = None
    leading_pages_skipped = 0
    docs_guardados = 0

    for i in range(args.start_page, n_pages):
        text = ocr_page_text(src[i], dpi=args.dpi)
        consec = find_consecutivo(text)

        if consec:
            if current:
                last_num, last_direction = guardar_documento(
                    conn, src, out_dir, pdf_origen, periodo_libro, ahora,
                    *current, last_num, last_direction,
                )
                docs_guardados += 1
                if args.max_docs and docs_guardados >= args.max_docs:
                    current = None
                    print(f"\nLimite de {args.max_docs} documentos alcanzado, deteniendo lectura en pagina {i}.")
                    break
            current = [consec, i, i, text]
            print(f"Pagina {i}: nuevo consecutivo detectado -> {consec}")
        else:
            if current:
                current[2] = i
            else:
                leading_pages_skipped += 1
                print(f"Pagina {i}: sin 'Consecutivo' y aun no hay documento abierto, se omite")

    if current:
        last_num, last_direction = guardar_documento(
            conn, src, out_dir, pdf_origen, periodo_libro, ahora,
            *current, last_num, last_direction,
        )
        docs_guardados += 1

    if leading_pages_skipped:
        print(f"\nAviso: {leading_pages_skipped} pagina(s) iniciales no tenian 'Consecutivo' "
              f"y quedaron fuera de cualquier documento.")

    conn.close()
    src.close()
    print(f"\n{docs_guardados} documento(s) guardado(s). Base de datos: {db_path}")


if __name__ == "__main__":
    main()
