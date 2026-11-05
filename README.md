# Senda

Explorador local de archivos para Windows. Primera entrega: navegacion,
pestanas, listado virtualizado, busqueda por nombre en todas las unidades
detectadas, filtros por tipo, ordenacion, archivos ocultos y panel de metadatos.
No hay indexacion ni operaciones de copiar, mover o borrar todavia.

## Desarrollo En Windows

Requisitos: Rust estable, Node.js 20.19+ o superior, Visual Studio Build Tools
con C++ y Windows SDK, y WebView2 Runtime.

```sh
npm install
npm run tauri dev
```

El backend accede al sistema de archivos local. Abrir un archivo utiliza su
aplicacion asociada: puede ejecutar programas y requiere la misma cautela que
abrirlos desde el Explorador de Windows. No hay apertura automatica por seleccion.

```sh
npm run tauri build
```

El empaquetado NSIS esta habilitado. Para la entrega de escritorio utiliza
`npm run desktop:release` desde Windows: ejecuta las comprobaciones y genera
el instalador en `target/release/bundle/nsis/` y el ejecutable en
`target/release/rust_file_explorer_v1.exe`. Consulta RELEASE.md.
El instalador incluye accesos directos en Inicio y escritorio; no esta firmado.

## Vista De Interfaz En Navegador

```sh
npm run dev
```

Abre http://localhost:1420. Este modo muestra un aviso y datos de demostracion;
no puede leer ni abrir archivos de tu disco. No representa una prueba de Tauri.

## Comprobaciones

```sh
cargo test --lib
cargo fmt --check
cargo clippy --lib --tests -- -D warnings
npm test
npm run build
npx playwright install chromium
npm run test:e2e
codegraph sync
```

El motor Rust puede probarse sin activar `desktop`. Para ejecutar Tauri en
Linux hacen falta GTK3 y WebKitGTK 4.1; WSL no valida las integraciones Windows.

## Limites De Esta Entrega

- La busqueda global recorre las unidades detectadas y publica resultados en
  lotes. Incluye unidades de red mapeadas, no rutas UNC no montadas. No busca
  contenido dentro de documentos y no tiene indice: un disco grande puede tardar.
- Filtros: carpetas, documentos, imagenes, videos, audio, comprimidos, codigo
  y otros. Clasificacion por extension, no inspeccion del contenido.
- Los ocultos y sus subcarpetas se excluyen salvo que se active "Ocultos".
  No se atraviesan enlaces ni directorios reparse de Windows para evitar ciclos.
- Limite de 10.000 resultados por busqueda, indicado en la interfaz. Los errores
  de lectura se cuentan y se muestran hasta 20 detalles como ejemplo.
- Cancelacion cooperativa entre entradas: no puede interrumpir una llamada
  al sistema bloqueada por una unidad lenta. Una nueva consulta cancela la anterior.

- Lee los metadatos de la carpeta completa en un worker antes de publicar el
  resultado. La virtualizacion reduce renderizado, no el coste de lectura.
- Descarta respuestas obsoletas al navegar; aun no cancela lecturas del disco
  en curso ni limita el numero de trabajos pendientes.
- Las ubicaciones comunes se detectan dentro del perfil; carpetas Windows
  redirigidas a OneDrive requieren integrar Known Folders en otra entrega.
- No hay seguimiento automatico de cambios, miniaturas, restauracion de scroll
  por pestana, seleccion multiple ni procesos responsables de bloqueos.
- Los enlaces se muestran como tales y no se recorren recursivamente.
- Rutas no representables como texto se rechazan en vez de operar con una ruta
  alterada. El soporte de rutas largas debe verificarse en Windows.

Consulta DESIGN.md para los criterios de interfaz y las referencias adoptadas.
