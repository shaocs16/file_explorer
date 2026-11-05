# Senda 1.0: Distribucion De Escritorio

## Alcance Cerrado

Aplicacion Windows con ventana propia, icono y recursos de interfaz incluidos.
No inicia Vite ni un servidor web al ejecutarse. WebView2 dibuja la interfaz y
Rust opera sobre el sistema de archivos.

Incluye navegacion por carpetas, pestanas, ordenacion, ocultos, panel de
metadatos, apertura con aplicaciones asociadas, filtros por tipo y busqueda
global por nombre con resultados progresivos y cancelacion.

Esta version no incluye copiar, mover, borrar, indice persistente, busqueda
por contenido, miniaturas ni identificacion del proceso que bloquea un recurso.
La version 1.0 identifica este alcance, no certifica pruebas Windows pendientes.

## Generar El Paquete

Desde PowerShell en la carpeta del proyecto, con Node.js y Rust MSVC instalados:

```powershell
npm run desktop:release
```

Opcionalmente, incluir las pruebas de navegador:

```powershell
powershell.exe -NoProfile -File scripts/release-windows.ps1 -BrowserTests
```

El script instala dependencias con `npm ci`, comprueba Rust, ejecuta tests,
Clippy y compila el ejecutable y el instalador. Se detiene al primer fallo.
Las compilaciones de desarrollo, pruebas e instaladores requieren acceso a
Internet para descargar dependencias y herramientas si no estan en cache.

## Archivos Resultantes

- `target/release/rust_file_explorer_v1.exe`: ejecutable de la aplicacion.
- `target/release/bundle/nsis/*-setup.exe`: instalador que se entrega al usuario.
- El script muestra la huella SHA256 del instalador para verificar su integridad.

El instalador configura la aplicacion para el usuario actual y crea accesos
directos en Inicio y escritorio. No sustituye al Explorador de Windows ni cambia
las asociaciones de archivos. Permite desinstalar desde Configuracion de Windows.

El instalador descarga WebView2 si falta; en ese caso requiere Internet. Una vez
instalada, Senda no necesita un servidor remoto para navegar o buscar. Unidades
de red, aplicaciones asociadas y archivos de nube pueden requerir conexion.

## Comprobaciones En Windows Antes De Distribuir

- Compilar con `desktop:release` sin errores de Rust, Clippy o bundling.
- Instalar sin ejecutar todo el explorador como administrador.
- Abrir desde Inicio y escritorio; comprobar icono, titulo y ausencia de aviso demo.
- Cerrar y volver a abrir la aplicacion sin una terminal ni servidor Vite.
- Navegar por unidades y rutas Unicode; comprobar rutas largas y permisos.
- Buscar un archivo que no este en la carpeta abierta, filtrar y abrir su ubicacion.
- Cambiar y cancelar consultas; comprobar que no aparecen resultados de otra busqueda.
- Probar unidades desconectadas, accesos denegados y resultados incompletos.
- Revisar ventanas estrechas, temas, teclado y DPI 100%, 150% y 200%.
- Desinstalar y comprobar que los accesos directos desaparecen y los archivos
  personales del usuario no se modifican.

## Firma Y Estado

No hay certificado de firma configurado. Windows puede mostrar editor
desconocido o un aviso SmartScreen: no se promete una distribucion firmada.
Para distribucion publica hay que configurar firma y completar las pruebas
anteriores, sin desactivar las protecciones de Windows como solucion.

En el entorno de preparacion se han probado motor e interfaz; la compilacion
MSVC y el instalador siguen pendientes si no hay toolchain Windows disponible.
Consulta VERIFICACION.md para los resultados realmente ejecutados.
