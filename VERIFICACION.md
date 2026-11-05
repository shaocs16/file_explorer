# Verificacion De La Primera Entrega

## Preparacion De Distribucion 1.0

- Configuracion NSIS habilitada, iconos y acceso directo de escritorio definidos.
- `tauri info` reconoce el modo bundle y la configuracion de la aplicacion.
- `npm run build`: recursos de produccion compilados correctamente.
- Script `scripts/release-windows.ps1`: sintaxis validada con el parser real de
  Windows PowerShell. No ejecuta instalacion de herramientas automaticamente.
- No se ha generado un `.exe` ni un instalador Windows: no estan instalados
  Rust/Cargo Windows ni se ha encontrado el instalador de Visual Studio Build Tools.
- Firma digital, pruebas MSVC, instalacion y desinstalacion pendientes.
- Al salir de la aplicacion se solicita cancelar la busqueda en curso.
- Tests de distribucion: coherencia de versiones, iconos existentes, instalador
  para usuario actual y protocolo de produccion incluidos en la verificacion.
- Las pruebas E2E usan ahora la compilacion de produccion con Vite preview,
  no el servidor de desarrollo, tras un error de permisos de cache en WSL.

## Ampliacion: Filtros Y Busqueda Global

- `cargo test --lib`: 8 pruebas correctas incluyendo varias raices, recursion,
  filtro de documentos, ocultos, raiz inexistente, cancelacion y ciclos de enlaces.
- `npm run test:e2e`: 5 pruebas correctas; busqueda desde Descargas encuentra
  un PDF de Documentos, filtros combinados, abrir ubicacion y cancelacion en debounce.
- `npm run build` y Clippy correctos. La simulacion de navegador no valida los
  canales IPC ni el recorrido de unidades Windows, pendientes de prueba alli.
- La busqueda ahora es global por nombre con lotes y cancelacion cooperativa,
  sin indice. Se mantiene la limitacion de lectura completa en navegacion normal.

## Ejecutado En Linux / WSL

- `cargo test --lib`: 5 pruebas correctas. Archivos, carpetas, tamanos, ocultos,
  rutas inexistentes, rutas de archivo, Unicode y enlaces sin recursion.
- `cargo fmt --check`: correcto.
- `cargo clippy --lib --tests -- -D warnings`: sin advertencias.
- `npm test`: 3 pruebas correctas de filtros, ordenacion y formato de tamanos.
- `npm run build`: TypeScript y compilacion Vite correctos.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades conocidas al verificar.
- `npm run test:e2e`: 3 pruebas correctas en Chromium. Navegacion, errores de
  ruta y recuperacion, busqueda, detalles, ocultos, pestanas y atajo de teclado.
- Prueba de interfaz con 10.000 entradas simuladas: menos de 100 filas en el
  DOM y busqueda del ultimo elemento correcta. No mide lectura real de disco.
- Sin overflow horizontal de pagina a 1440, 900, 680 y 390 px en el recorrido
  probado. Capturas generadas en `test-results/`.
- CodeGraph sincronizado con los nuevos archivos.

## Pendiente Y Limitaciones

- El visor de imagenes omite la captura por limites de redimensionado. No se
  afirma una revision visual completa a partir de capturas no visibles.
- No se ha compilado ni ejecutado el feature `desktop`: faltan GTK3 y
  WebKitGTK 4.1 en este entorno. `tauri info` reconoce la configuracion y
  registra las dependencias ausentes.
- Pendiente compilar y ejecutar en Windows, comprobar WebView2, apertura con
  aplicaciones asociadas, unidades, rutas largas y archivos bloqueados.
- Pendiente medir latencia, memoria, discos lentos y red. La prueba de
  virtualizacion no demuestra un objetivo de rendimiento global.
- Pendiente revisar lector de pantalla, DPI, alto contraste y entrada tactil.
- Los listados se leen completos en un worker, sin streaming ni cancelacion
  efectiva del trabajo de disco para navegacion. No hay indexacion; la busqueda
  global recursiva se documenta en la ampliacion anterior.

Los errores detectados durante la verificacion (descubrimiento de tests E2E
por Vitest, tipos Rust costosos y version vulnerable de Vitest) se corrigieron
antes de estas ejecuciones finales.
