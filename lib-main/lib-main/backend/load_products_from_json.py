import argparse
import csv
import json
import os
import sys
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT_DIR = Path(__file__).resolve().parents[3]
DEFAULT_INPUT = ROOT_DIR / "frontend" / "public" / "data" / "productos.json"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "productos_upload.csv"

FIELD_NAMES = [
    "SKU",
    "Nombre",
    "Precio",
    "Stock",
    "Imagen URL",
    "Categoria",
    "Marca",
    "Color",
    "Subcategoria",
]


def normalize_item(item):
    sku = str(item.get("sku") or item.get("id") or "").strip()
    if not sku:
        return None
    nombre = item.get("nombre") or item.get("name") or ""
    precio = item.get("precio") if item.get("precio") is not None else item.get("price")
    stock = item.get("stock") or 0
    return {
        "SKU": sku,
        "Nombre": nombre,
        "Precio": round(float(precio or 0), 2),
        "Stock": int(float(stock or 0)),
        "Imagen URL": item.get("imagen") or item.get("image") or "",
        "Categoria": item.get("categoria") or item.get("category") or "General",
        "Marca": item.get("marca") or item.get("brand") or "",
        "Color": item.get("color") or "",
        "Subcategoria": item.get("subcategoria") or item.get("subcategory") or "",
    }


def write_csv(items, output_path):
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELD_NAMES)
        writer.writeheader()
        for item in items:
            writer.writerow(item)


def encode_multipart_formdata(fields, files, boundary=None):
    if boundary is None:
        boundary = uuid.uuid4().hex
    lines = []
    for (name, value) in fields:
        lines.append(f"--{boundary}")
        lines.append(f"Content-Disposition: form-data; name=\"{name}\"")
        lines.append("")
        lines.append(str(value))
    for (name, filename, value, content_type) in files:
        lines.append(f"--{boundary}")
        lines.append(
            f"Content-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\""
        )
        lines.append(f"Content-Type: {content_type}")
        lines.append("")
        if isinstance(value, str):
            value = value.encode("utf-8")
        lines.append(value)
    lines.append(f"--{boundary}--")
    lines.append("")
    body = b"\r\n".join(
        line if isinstance(line, (bytes, bytearray)) else line.encode("utf-8")
        for line in lines
    )
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type


def upload_csv(csv_path, backend_url, admin_password, mode="replace"):
    backend = backend_url.rstrip("/")
    api_url = f"{backend}/api/admin/csv-upload?mode={mode}"
    with csv_path.open("rb") as f:
        content = f.read()
    body, content_type = encode_multipart_formdata([], [("file", csv_path.name, content, "text/csv")])
    request = Request(
        api_url,
        data=body,
        headers={
            "Content-Type": content_type,
            "X-Admin-Token": admin_password,
        },
        method="POST",
    )
    try:
        with urlopen(request) as response:
            result = response.read().decode("utf-8")
            return json.loads(result)
    except HTTPError as exc:
        text = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {exc.code}: {text}")
    except URLError as exc:
        raise RuntimeError(f"Error de red: {exc.reason}")


def main():
    parser = argparse.ArgumentParser(
        description="Convierte el catálogo JSON local a CSV y opcionalmente lo sube al backend de Render."
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help=f"Ruta al JSON local (por defecto: {DEFAULT_INPUT})",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Ruta del CSV de salida.",
    )
    parser.add_argument(
        "--backend-url",
        default="",
        help="URL pública del backend donde se subirá el CSV (ej. https://mi-backend.onrender.com)",
    )
    parser.add_argument(
        "--admin-password",
        default="",
        help="ADMIN_PASSWORD del backend para la cabecera X-Admin-Token.",
    )
    parser.add_argument(
        "--mode",
        choices=["replace", "upsert"],
        default="replace",
        help="Modo de carga: replace borra y reemplaza, upsert actualiza/crea.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Archivo de entrada no encontrado: {input_path}")
        sys.exit(1)

    with input_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        print("El archivo JSON debe contener un arreglo de productos.")
        sys.exit(1)

    items = [normalize_item(item) for item in raw]
    items = [item for item in items if item is not None]
    if not items:
        print("No se encontraron productos válidos en el JSON de entrada.")
        sys.exit(1)

    output_path = Path(args.output)
    write_csv(items, output_path)
    print(f"CSV generado: {output_path} ({len(items)} productos)")

    if args.backend_url:
        if not args.admin_password:
            print("Para subir al backend se requiere --admin-password.")
            sys.exit(1)
        print("Subiendo CSV al backend...")
        result = upload_csv(output_path, args.backend_url, args.admin_password, args.mode)
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
