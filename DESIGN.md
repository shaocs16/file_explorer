# Explorador Windows: criterios de diseno

## Objetivo

Un espacio de trabajo para localizar, organizar y operar sobre archivos con
rapidez, sin bloquear la interfaz y sin ocultar el resultado de las operaciones.
La lista de archivos es protagonista; no es una landing ni un dashboard.

Este documento registra criterios para la futura implementacion. No implica
que exista una interfaz, que se haya elegido definitivamente Tauri o que se
hayan ejecutado pruebas visuales o de rendimiento.

## Referencias revisadas

- `../rust/DESIGN.md`: decisiones visuales del curso Rust Atlas.
- `../rust/.agents/skills/design-taste-frontend/references/app-screens.md`:
  criterios para aplicaciones, listas, superficies y estados.
- `../rust/.agents/skills/web-design-guidelines/SKILL.md` y su fuente:
  https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- `../rust/VERIFICACION.md`: ejemplo de separar pruebas ejecutadas de limites
  de verificacion. Sus resultados no se trasladan a este proyecto.

Las referencias son orientativas, no dependencias de ejecucion. No se han
copiado skills, scripts, configuraciones MCP ni recursos del otro proyecto.

## Adoptar

- Superficies planas, separacion tonal y bordes discretos. Sombras reservadas
  principalmente para menus y dialogos flotantes.
- Un sistema de tokens semanticos para fondos, texto, seleccion, foco,
  controles, estados, espaciado y densidad.
- Tipografia legible, jerarquia contenida y cifras tabulares en tamanos y
  columnas comparables. Formatos de fechas y numeros segun la configuracion
  regional, sin modificar los nombres reales de los archivos.
- Navegacion discreta con etiquetas; acciones frecuentes visibles sin convertir
  cada fila en una tarjeta ni esconder todas las acciones en menus.
- Estados diferentes para hover, foco, seleccion, deshabilitado, carga, vacio,
  error y datos desactualizados. La seleccion multiple debe ser inequivoca.
- Controles semanticos, nombres accesibles, foco visible y uso completo por
  teclado. Arrastrar y soltar debe tener una alternativa por teclado.
- Animacion solo como respuesta a interacciones, breve y prescindible. Respetar
  movimiento reducido y evitar blur, shimmer y animaciones de entrada.
- Listados virtualizados, miniaturas bajo demanda y actualizaciones en lotes.
  Cambiar de carpeta o consulta cancela trabajos obsoletos.
- Pruebas con datos realistas y extremos: nombres largos, Unicode, carpetas
  vacias, listados grandes y operaciones parcialmente fallidas.
- Errores junto al contexto afectado, con acciones concretas y detalles
  tecnicos desplegables. No confundir fallo al leer con carpeta vacia.

## Adaptar A Windows

- Interfaz fluida que aproveche la ventana, con barra de ruta, busqueda,
  pestanas y paneles redimensionables. No limitar el contenido a una columna
  editorial centrada.
- Segoe UI Variable / Segoe UI como primera opcion tipografica a validar en
  Windows, en lugar de heredar las fuentes editoriales del curso.
- Densidad compacta y comoda, coordinando altura de fila, espaciado y texto.
  No adoptar literalmente las filas de 48 px de un dashboard.
- Columna de nombre prioritaria y redimensionable. No abreviar, renombrar ni
  normalizar nombres para mejorar la composicion; permitir consultar y copiar
  el nombre completo cuando haya truncamiento visual.
- Temas claro, oscuro, alto contraste y escalado DPI. El color de seleccion
  y el foco deben seguir siendo reconocibles y no depender solo del color.
- Iconos de archivos y miniaturas propios del sistema cuando corresponda.
  La regla de un unico juego monocromo se aplica a controles, no a contenido.
- Adaptar la composicion a ventanas estrechas y equipos tactiles Windows,
  sin convertir un producto de escritorio en una interfaz movil por defecto.
- Restaurar foco, seleccion y posicion de scroll al volver a una carpeta.
  Guardar rutas y consultas localmente cuando proceda, sin exponerlas en URLs
  externas ni en telemetria por defecto.
- Para carpetas en uso, intentar diagnosticar procesos con APIs Windows y
  reconocer cuando no se conoce la causa. Nunca cerrar procesos ni forzar
  desbloqueos automaticamente.

## Descartar

- La direccion `editorial-greeting` de Rust Atlas, titulos serif grandes,
  margenes de lectura amplios y paneles con radios de 22 px como norma.
- KPIs, graficos, saludos, ilustraciones de bienvenida y porcentajes ficticios.
- Limitar las listas principales a cuatro o seis filas con "Ver todo".
  El explorador necesita scroll virtualizado sobre el contenido disponible.
- Reglas esteticas absolutas de la plantilla, como prohibir un color concreto
  o imponer un porcentaje de pixeles coloreados. Accesibilidad y semantica
  de Windows tienen prioridad.
- Requisitos exclusivos de webs publicas: SEO, hidratacion SSR, marketing,
  navegacion movil obligatoria y recursos servidos desde CDN.
- Trasladar las pruebas o resultados del curso como evidencia del explorador.

## Verificacion Antes De Aprobar La Interfaz

- Revisar capturas reales de temas claro y oscuro, varios tamanos de ventana,
  ambos modos de densidad y escalado DPI de 100%, 150% y 200%.
- Probar teclado, lector de pantalla, alto contraste y dispositivos tactiles
  cuando esten disponibles. Verificar accesibilidad de filas virtualizadas.
- Medir arranque, memoria, respuesta y scroll con conjuntos de datos definidos;
  no inferir rendimiento a partir de la apariencia o del framework.
- Probar dialogos y errores de permisos, bloqueos, conflictos, disco lleno,
  desconexion de unidad y red, y resultados parciales.
- Validar integraciones del sistema en Windows real o VM Windows. Una prueba
  de navegador en Linux/WSL no valida Shell, Restart Manager ni WebView2.
- Registrar comandos y resultados efectivos junto con cualquier comprobacion
  pendiente; no declarar revision visual si no se pudieron ver las capturas.

## CodeGraph

Inicializado y verificado sobre el proyecto inicial: un archivo Rust, dos nodos
y una relacion. En esta ubicacion WSL `/mnt/c` el seguimiento automatico esta
deshabilitado. Ejecutar `codegraph sync` tras cambios antes de confiar en el
indice para analizar codigo actualizado. No se han instalado hooks de Git.
