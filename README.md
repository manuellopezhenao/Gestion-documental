# Gestión documental — instalar en la máquina del cliente

Todo lo que hace falta instalar y hacer, en orden, para que la app
funcione completa (incluido "Subir libro"). El paquete que le vas a
mandar (carpeta `release`, generada con `npm run build:release`) ya trae
todo el código, sus dependencias y el script de OCR — en la máquina del
cliente solo hay que instalar estos programas, descomprimir y configurar
la conexión a SQL Server.

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

## 5. SQL Server

La app guarda todo en SQL Server. Si el cliente ya tiene uno (en esa PC
o en la red), saltar al punto 2.

1. Instalar **SQL Server Express** (gratis):
   ```
   winget install Microsoft.SQLServer.2022.Express
   ```
   y, para administrarlo, SQL Server Management Studio (SSMS):
   ```
   winget install Microsoft.SQLServerManagementStudio
   ```
2. Crear la base vacía (en SSMS, "New Query"):
   ```sql
   CREATE DATABASE gestion_documental;
   ```
   Solo eso: las tablas y el usuario admin los crea la app sola al
   arrancar.
3. Si se va a entrar con usuario/clave de SQL (`sa` u otro), en SSMS:
   click derecho al servidor → Properties → Security → **"SQL Server and
   Windows Authentication mode"**, y reiniciar el servicio. Habilitar
   también TCP/IP en "SQL Server Configuration Manager" si la conexión
   es por `host:1433`.

## 6. Instalar y arrancar la app

1. Descomprimir la carpeta `release` que te mandé, donde quieran.
2. Abrir `release\.env` con el Bloc de notas y cambiar **solo la línea
   `DATABASE_URL`** por la conexión a ese SQL Server. Formatos:
   ```
   Usuario SQL:        sqlserver://localhost:1433;database=gestion_documental;user=sa;password=CLAVE;trustServerCertificate=true
   Instancia Express:  sqlserver://localhost\SQLEXPRESS;database=gestion_documental;user=sa;password=CLAVE;trustServerCertificate=true
   Auth de Windows:    sqlserver://localhost:1433;database=gestion_documental;integratedSecurity=true;trustServerCertificate=true
   ```
   (Si la clave tiene `;` `=` `{` o `}`, va entre llaves: `password={mi;clave}`.)
3. Abrir una terminal ahí adentro y correr:
   ```
   npm start
   ```
   La primera vez crea las tablas y el usuario admin; las siguientes no
   cambia nada. Si la conexión está mal, se corta con el error en
   pantalla (o en `inicio.log` si arranca solo) en vez de levantar la
   app a medias.
4. Abrir el navegador en `http://localhost:3000`.

Listo — un solo proceso, un solo puerto, con todo funcionando (incluido
"Subir libro").

## 7. (Opcional) Que arranque solo con el PC

El release trae `iniciar.bat` (corre `node iniciar.js` y guarda la salida
en `release/inicio.log`, para poder revisar errores si algo falla sin
que nadie este mirando la pantalla) y dos instaladores para no tener que
tipear nada a mano:

1. Dentro de la carpeta `release`, **doble click en `instalar-arranque.bat`**.
2. Windows va a pedir permiso de administrador (SmartScreen o UAC) —
   aceptar. El script:
   - Registra una tarea programada (`GestionDocumental`) que corre
     `iniciar.bat` al **encender el PC** (no solo al iniciar sesion),
     con la cuenta `SYSTEM` — asi arranca aunque nadie haga login.
   - La deja corriendo ya mismo y abre `http://localhost:3000` en el
     navegador para confirmar que funciona.

Para desactivarlo, **doble click en `desinstalar-arranque.bat`** (borra
la tarea; la carpeta y los datos quedan intactos, solo deja de arrancar
sola).

Notas:
- Como corre con `SYSTEM`, no se ve ninguna ventana — si algo falla,
  revisar `release/inicio.log`.
- Al encender el PC, si SQL Server todavía no levantó, la app reintenta
  la conexión cada 15 s durante 5 minutos antes de rendirse.
- Para el arranque automático, usar **usuario/clave de SQL** en
  `DATABASE_URL`, no "Auth de Windows": la tarea corre como `SYSTEM`, no
  como el usuario que inició sesión, y con `integratedSecurity` entraría
  a SQL Server con esa cuenta (que normalmente no tiene permisos en la
  base).
- Si el PC tiene antivirus/firewall corporativo, puede pedir que se
  apruebe `node.exe` escuchando en el puerto 3000 la primera vez.
- Si se mueve la carpeta `release` a otro lugar despues de instalar el
  arranque automatico, hay que correr `desinstalar-arranque.bat` ahi
  (la ruta vieja) e `instalar-arranque.bat` de nuevo desde la ubicacion
  nueva.

<details>
<summary>Equivalente manual con <code>schtasks</code> (por si no se puede
correr el .bat)</summary>

```
schtasks /create /tn "GestionDocumental" /tr "\"C:\ruta\a\release\iniciar.bat\"" /sc onstart /ru SYSTEM /rl HIGHEST /f
schtasks /run /tn "GestionDocumental"
```
Para borrarla: `schtasks /delete /tn "GestionDocumental" /f`

</details>

Notas:
- Corre con la cuenta `SYSTEM`, asi que arranca aunque nadie inicie
  sesion — pero por eso tambien corre sin ventana visible; si algo
  falla, mirar `release/inicio.log`.
- Si el PC tiene antivirus/firewall corporativo, puede pedir que se
  apruebe `node.exe` escuchando en el puerto 3000 la primera vez.
