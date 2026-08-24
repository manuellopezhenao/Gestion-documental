# Gestión documental — instalar en la máquina del cliente

Todo lo que hace falta instalar y hacer, en orden, para que la app
funcione completa (incluido "Subir libro"). El paquete que le vas a
mandar (carpeta `release`, generada con `npm run build:release`) ya trae
todo el código, sus dependencias y el script de OCR — en la máquina del
cliente solo hay que instalar estos 4 programas y descomprimir.

## 1. Node.js

1. Bajar la versión **LTS** de [nodejs.org](https://nodejs.org) e
   instalar con las opciones por defecto.
2. Verificar en una terminal nueva:
   ```
   node --version
   ```

## 2. Python

1. Bajar Python 3 de [python.org/downloads](https://www.python.org/downloads/).
2. Al instalar, **tildar "Add python.exe to PATH"** en la primera
   pantalla — sin esto no va a funcionar.
3. Verificar:
   ```
   python --version
   ```

## 3. Librerías de Python

En una terminal:
```
python -m pip install PyMuPDF pytesseract Pillow
```

## 4. Tesseract OCR

```
winget install UB-Mannheim.TesseractOCR
```
(Usar este comando tal cual, sin cambiar la carpeta de instalación —
el script espera encontrarlo en la ruta por defecto de este instalador.)

Verificar:
```
"C:\Program Files\Tesseract-OCR\tesseract.exe" --version
```

## 5. Instalar y arrancar la app

1. Descomprimir la carpeta `release` que te mandé, donde quieran.
2. Abrir una terminal ahí adentro y correr:
   ```
   npm start
   ```
3. Abrir el navegador en `http://localhost:3000`.

Listo — un solo proceso, un solo puerto, con todo funcionando (incluido
"Subir libro").
