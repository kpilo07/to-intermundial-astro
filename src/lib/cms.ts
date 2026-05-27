import type {
  CMSHomeResponse,
  CMSField,
  CMSChild,
  ImageValue,
  UrlValue,
  ImagenTextoFields,
  Miniatura4Item,
  Miniatura3Item,
  BannerMediosItem,
  MenuItem,
  MenuData,
  FooterSubItem,
  FooterColumn,
  FooterData,
  HeaderTag,
  HeaderData,
  CabeceraSeguroData,
  EstructuraNavData,
  IconoTextoData,
  CaracteristicasData,
  TablaComparativaBasicData,
  ProductPageData,
} from './types';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL  = import.meta.env.CMS_BASE_URL as string;
const API_KEY   = import.meta.env.CMS_API_KEY  as string;
const LANG      = import.meta.env.CMS_LANG     as string;
const HOME_ID   = import.meta.env.CMS_HOME_LOCATION_ID as string;

// Jerarquía del menú escritorio (locationIds fijos del CMS)
const MENU_LOCATION_ID       = import.meta.env.CMS_MENU_LOCATION_ID as string; // 102
const SUBMENUS_LOCATION_ID   = '103';   // catálogo de productos
const TOP_LEFT_LOCATION_ID   = '13273'; // Particulares | Empresas
const TOP_RIGHT_LOCATION_ID  = '13271'; // Área cliente | Contacto | …

// Jerarquía del footer
const FOOTER_LOCATION_ID         = import.meta.env.CMS_FOOTER_LOCATION_ID as string; // 13501
const FOOTER_SUBMENUS_LOCATION_ID = '13525'; // submenú completo del footer
const FOOTER_LEGAL_LEFT_ID        = '15122'; // copyright / texto legal
const FOOTER_LEGAL_RIGHT_ID       = '15124'; // links legales

// ─── Fetch base ──────────────────────────────────────────────────────────────

async function fetchLocation(
  locationId: string | number,
  limit = 50,
  depth?: number,
): Promise<CMSHomeResponse> {
  const depthParam = depth !== undefined ? `&depth=${depth}` : '';
  const fetchUrl = `${BASE_URL}/apicms/fullcontent/${locationId}?lang=${LANG}&limit=${limit}${depthParam}`;
  const res = await fetch(fetchUrl, { headers: { 'X-Api-Key': API_KEY } });
  if (!res.ok) throw new Error(`CMS fetch failed [${res.status}]: ${fetchUrl}`);
  return res.json() as Promise<CMSHomeResponse>;
}

/** Build an absolute image URL from a raw CMS URI string */
function absoluteUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return `${BASE_URL}${uri}`;
}

/**
 * Fetches the full CMS content for the home location.
 * Uses depth=2 to get nested children (e.g. cabecera_block inside seccion_render).
 * Called at build time → output is fully pre-rendered (SSG).
 */
export async function fetchHomeContent(): Promise<CMSHomeResponse> {
  const url = `${BASE_URL}/apicms/fullcontent/${HOME_ID}?lang=${LANG}&limit=20&depth=2`;
  const res = await fetch(url, { headers: { 'X-Api-Key': API_KEY } });
  if (!res.ok) throw new Error(`CMS fetch failed [${res.status}]: ${url}`);
  return res.json() as Promise<CMSHomeResponse>;
}

/**
 * Fetches the item_icon children of a cabecera_block location.
 * These are the feature tags shown in the header (e.g. "Cobertura médica sin adelantar pagos").
 */
export async function fetchHeaderTags(cabeceraLocationId: number): Promise<HeaderTag[]> {
  const data = await fetchLocation(cabeceraLocationId, 10);
  return data.children
    .filter((c) => c.content.contentTypeIdentifier === 'item_icon')
    .map((c) => {
      const f = c.content.fields;
      const iconField = f['icon'];
      const iconVal   = iconField?.type === 'ezimage' ? iconField.value as ImageValue | null : null;
      return {
        title:   str(f['title']) || c.content.name,
        iconUri: iconVal?.uri  ?? '',
        iconAlt: iconVal?.alt  ?? '',
      };
    });
}

/**
 * Extracts HeaderData from a cabecera_block CMSChild + pre-fetched tags.
 */
export function extractHeaderData(cabeceraBlock: CMSChild, tags: HeaderTag[]): HeaderData {
  const f = cabeceraBlock.content.fields;
  const BASE = BASE_URL;

  const getImgUri = (key: string): string | null => {
    const field = f[key];
    if (!field || field.type !== 'ezimage' || !field.value) return null;
    return `${BASE}${(field.value as ImageValue).uri}`;
  };

  // Description: strip XML wrapper, convert paragraph to plain text
  let desc = '';
  if (f['descripcion']?.type === 'ezxmltext') {
    desc = (f['descripcion'].value as string)
      .replace(/<\?xml[^>]*\?>\n?/, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    titulo:     str(f['titulo']),
    descripcion: desc,
    bgL:        getImgUri('imagen_fondo'),
    bgM:        getImgUri('imagen_fondo_m'),
    bgS:        getImgUri('imagen_fondo_s'),
    bgXs:       getImgUri('imagen_fondo_xs'),
    bgPosition: str(f['background_position']) || 'center center',
    tags,
  };
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

/**
 * URL map for nav submenu items (catalog 103), keyed by CONTENT ID.
 *
 * WHY THIS EXISTS:
 *   The main-nav items use `ezobjectrelationlist` (field relacion_multiple) to
 *   reference submenu entries by their CMS content ID. Resolving those content IDs
 *   to URL aliases requires the EzPublish URL-alias service, which isn't exposed
 *   by the `apicms/fullcontent` endpoint. This static map bridges that gap.
 *
 * KEY:   content.id of the catalog-103 item (NOT its locationId)
 *        Derived: loc=111 content.id=118 → Totaltravel
 * VALUE: URL path of the corresponding product page on this Astro site
 *
 * TO UPDATE: add an entry whenever a new product page is built.
 * PRODUCTION NOTE: store urls directly in `url_externa` inside the CMS items,
 *   or expose a URL-alias resolver endpoint in the API.
 *
 * Content-ID ↔ locationId ↔ product page URL mapping verified 2026-05-27:
 *   content 118 → loc 111 (Totaltravel)          content 123 → loc 116 (go|cruise)
 *   content 120 → loc 113 (Totaltravel annual)    content 119 → loc 112 (Grand tour 365)
 *   content 128 → loc 121 (Todos seguros viaje)   content 142 → loc 141 (Totalsports)
 *   content 73303 → loc 73074 (Aquasports)        content 73305 → loc 73076 (Runsports)
 *   content 2127  → loc 2115  (Todos deportivos)
 */
const PRODUCT_PAGE_URLS: Record<number, string> = {
  // ── Seguros de viaje ──────────────────────────────────────────────────────
  118:   '/seguros-de-viaje/seguro-totaltravel',              // Totaltravel
  123:   '/seguros-de-viaje/seguro-go-cruise',                // go | cruise
  120:   '/seguros-de-viaje/seguro-totaltravel-annual',       // Totaltravel annual
  119:   '/seguros-de-viaje/seguro-larga-estancia-grand-tour-365', // Grand tour 365
  128:   '/seguros-de-viaje',                                 // Todos los seguros de viaje
  // ── Seguros deportivos ────────────────────────────────────────────────────
  142:   '/seguros-deportivos/seguro-totalsports',            // Totalsports
  73303: '/seguros-deportivos/seguro-aquasports',             // Aquasports
  73305: '/seguros-deportivos/seguro-runsports',              // Runsports
  2127:  '/seguros-deportivos',                               // Todos los seguros deportivos
};

/** Cache de módulo: en SSG todas las páginas comparten el mismo proceso Node.js */
let _menuCache: MenuData | null = null;

function childToMenuItem(child: CMSChild): MenuItem {
  const f = child.content.fields;
  const urlExt = f['url_externa']?.type === 'ezurl'
    ? f['url_externa'].value as { url: string | null; text: string | null }
    : null;
  const relMultiple = f['relacion_multiple']?.value as string | undefined;

  // url_externa first; fallback to static product URL map keyed by content ID
  const resolvedUrl = urlExt?.url ?? PRODUCT_PAGE_URLS[child.content.id] ?? null;

  return {
    locationId: child.locationId,
    contentId:  child.content.id,
    nombre:     str(f['nombre']) || child.content.name,
    url:        resolvedUrl,
    iconUrl:    str(f['url_icono']) || null,
    clase:      str(f['clase']),
    contenido:  str(f['contenido']),
    // relacion_multiple stores content IDs (ezobjectrelationlist)
    submenuIds: relMultiple
      ? relMultiple.split(',').map(Number).filter(Boolean)
      : [],
  };
}

/**
 * Fetches and assembles the full navigation menu.
 * Uses a module-level cache so el menú solo se pide una vez por build.
 *
 * Estructura del CMS:
 *   102 (menu_escritorio)
 *    ├─ 103  Submenus  ← catálogo de todos los productos
 *    ├─ 13269 menu_superior
 *    │   ├─ 13273 items_izquierdo  (Particulares | Empresas)
 *    │   └─ 13271 items_derecho    (Área cliente | Contacto | …)
 *    ├─ 109  Seguros de viaje      ← nav principal con relacion_multiple
 *    └─ 133  Seguros deportivos    ← nav principal con relacion_multiple
 */
export async function fetchMenuContent(): Promise<MenuData> {
  if (_menuCache) return _menuCache;

  // 4 peticiones en paralelo
  const [rootData, submenusData, leftData, rightData] = await Promise.all([
    fetchLocation(MENU_LOCATION_ID),
    fetchLocation(SUBMENUS_LOCATION_ID),
    fetchLocation(TOP_LEFT_LOCATION_ID),
    fetchLocation(TOP_RIGHT_LOCATION_ID),
  ]);

  // Solo items de tipo 'enlaces' en el root son los ítems principales del nav
  const mainNavChildren = rootData.children.filter(
    (c) => c.content.contentTypeIdentifier === 'enlaces',
  );

  _menuCache = {
    topBarLeft:  leftData.children.map(childToMenuItem),
    topBarRight: rightData.children.map(childToMenuItem),
    mainNav:     mainNavChildren.map(childToMenuItem),
    submenus:    submenusData.children.map(childToMenuItem),
  };

  return _menuCache;
}

// ─── Field helpers ────────────────────────────────────────────────────────────

export function str(field: CMSField | undefined): string {
  if (!field || field.type !== 'ezstring') return '';
  return field.value ?? '';
}

export function img(field: CMSField | undefined): ImageValue | null {
  if (!field || field.type !== 'ezimage') return null;
  return field.value;
}

export function url(field: CMSField | undefined): UrlValue {
  if (!field || field.type !== 'ezurl') return { url: null, text: null };
  return field.value;
}

/** Builds an absolute image URL from a CMS image URI */
export function imageUrl(image: ImageValue | null): string | null {
  if (!image?.uri) return null;
  return `${BASE_URL}${image.uri}`;
}

// ─── XML → HTML converter ─────────────────────────────────────────────────────

/**
 * Converts the ezxmltext format to plain HTML.
 * Handles: <paragraph>, <link url="">, <strong>, <em>, <line>
 */
export function parseXmlContent(xml: string): string {
  if (!xml) return '';

  return xml
    // Strip XML declaration and <section> wrapper
    .replace(/<\?xml[^>]*\?>\n?/, '')
    .replace(/<section[^>]*>/, '')
    .replace(/<\/section>/, '')
    // Block elements
    .replace(/<paragraph>/g, '<p>')
    .replace(/<\/paragraph>/g, '</p>')
    .replace(/<line>/g, '<br>')
    .replace(/<\/line>/g, '')
    // Links: <link url="...">text</link>
    .replace(/<link url="([^"]+)"[^>]*>/g, '<a href="$1" class="text-semantic-primary underline">')
    .replace(/<\/link>/g, '</a>')
    // Inline formatting
    .replace(/<strong>/g, '<strong>')
    .replace(/<\/strong>/g, '</strong>')
    .replace(/<emphasize>/g, '<em>')
    .replace(/<\/emphasize>/g, '</em>')
    .trim();
}

// ─── Section data extractors ──────────────────────────────────────────────────

export function extractImagenTexto(
  fields: Record<string, CMSField>
): ImagenTextoFields {
  return {
    nombre:       str(fields['nombre']),
    titulo:       str(fields['titulo']),
    pretitulo:    str(fields['pretitulo']),
    contenido:    parseXmlContent(
                    fields['contenido']?.type === 'ezxmltext'
                      ? fields['contenido'].value
                      : ''
                  ),
    imagen:       img(fields['imagen']),
    boton:        url(fields['boton']),
    distribucion: fields['distribucion']?.type === 'ezselection'
                    ? fields['distribucion'].value
                    : [],
  };
}

export function extractMiniatura4Items(
  fields: Record<string, CMSField>
): Miniatura4Item[] {
  const items: Miniatura4Item[] = [];
  for (let i = 1; i <= 4; i++) {
    const titulo = str(fields[`titulo_item${i}`]);
    if (!titulo) break;
    items.push({
      titulo,
      descripcion: str(fields[`descripcion_item${i}`]),
      imagen:      img(fields[`imagen_item${i}`]),
      url:         url(fields[`url_texto_enlace_item${i}`]),
    });
  }
  return items;
}

export function extractMiniatura3Items(
  fields: Record<string, CMSField>
): Miniatura3Item[] {
  const items: Miniatura3Item[] = [];
  for (let i = 1; i <= 3; i++) {
    const titulo = str(fields[`titulo_item${i}`]);
    if (!titulo) break;
    items.push({
      titulo,
      descripcion: str(fields[`descripcion_item${i}`]),
      imagen:      img(fields[`imagen_item${i}`]),
    });
  }
  return items;
}

export function extractBannerMediosItems(
  fields: Record<string, CMSField>
): BannerMediosItem[] {
  const items: BannerMediosItem[] = [];
  for (let i = 1; i <= 6; i++) {
    const imagen = img(fields[`imagen_${i}`]);
    if (!imagen) break;
    items.push({
      imagen,
      url: url(fields[`imagen_url_${i}`]),
    });
  }
  return items;
}

// ─── Product page ─────────────────────────────────────────────────────────────

/**
 * Fetches all data needed to render a product page (e.g. /seguros-de-viaje/seguro-totaltravel).
 *
 * Strategy:
 *   - One call to `locationId` with depth=2 yields:
 *       • resumen  → cabecera_seguro, icono_texto, miniatura_3 (ventajas), …
 *       • seccion_resumen  → miniatura_4 (características), tabla_comparativa, …
 *       • estructura_navegacion_producto  → schema.org fields (price, rating …)
 *   All fields are available at that depth.
 */
export async function fetchProductPage(locationId: string | number): Promise<ProductPageData | null> {
  const data = await fetchLocation(locationId, 20, 2);

  // ── Key nodes ──────────────────────────────────────────────────────────────
  const resumenNode       = data.children.find(c => c.content.contentTypeIdentifier === 'resumen');
  const estructuraNode    = data.children.find(c => c.content.contentTypeIdentifier === 'estructura_navegacion_producto');
  const seccionResumenNode = data.children.find(c => c.content.contentTypeIdentifier === 'seccion_resumen');

  if (!resumenNode || !estructuraNode) return null;

  const resumenChildren = resumenNode.children ?? [];
  const seccionChildren = seccionResumenNode?.children ?? [];

  // ── CabeceraSeguro ────────────────────────────────────────────────────────
  const cabeceraNode = resumenChildren.find(c => c.content.contentTypeIdentifier === 'cabecera_seguro');
  if (!cabeceraNode) return null;

  const cf = cabeceraNode.content.fields;
  const imgFieldUri = (key: string): string | null => {
    const f = cf[key];
    if (!f || f.type !== 'ezimage' || !f.value) return null;
    return absoluteUri((f.value as { uri: string }).uri);
  };

  const cabecera: CabeceraSeguroData = {
    textoPrincipal: str(cf['texto_principal']),
    pretitulo:      str(cf['pretitulo']),
    imagenMobile:   imgFieldUri('imagen_cabecera_mobile'),
    imagenLg:       imgFieldUri('imagen_cabecera_lg'),
  };

  // ── EstructuraNav (schema.org + pricing) ──────────────────────────────────
  const ef = estructuraNode.content.fields;
  const structuredData: EstructuraNavData = {
    titulo:      str(ef['titulo']),
    description: str(ef['description']),
    offersPrice: str(ef['offers_price']),
    ratingValue: str(ef['ratingvalue']),
    ratingCount: str(ef['ratingcount']),
  };

  // ── IconoTexto (eSIM promo) ────────────────────────────────────────────────
  const iconoTextoNode = resumenChildren.find(c => c.content.contentTypeIdentifier === 'icono_texto');
  let iconoTexto: IconoTextoData | null = null;
  if (iconoTextoNode) {
    const itf = iconoTextoNode.content.fields;
    iconoTexto = {
      subtitulo:    str(itf['subtitulo']),
      contenido:    str(itf['contenido']),
      urlContenido: url(itf['url_cotenido']),
      imagen:       img(itf['imagen']),
    };
  }

  // ── Características (miniatura_4, tipo=1 → accordion layout) ─────────────
  const miniatura4Node = seccionChildren.find(c => c.content.contentTypeIdentifier === 'miniatura_4');
  let caracteristicas: CaracteristicasData | null = null;
  if (miniatura4Node) {
    const m4f = miniatura4Node.content.fields;
    const imgPrincipalField = m4f['imagen_principal'];
    const imgPrincipalUri = imgPrincipalField?.type === 'ezimage' && imgPrincipalField.value
      ? absoluteUri((imgPrincipalField.value as { uri: string }).uri)
      : null;

    const items: CaracteristicasData['items'] = [];
    for (let i = 1; i <= 4; i++) {
      const titulo = str(m4f[`titulo_item${i}`]);
      if (!titulo) break;
      items.push({
        titulo,
        descripcion: str(m4f[`descripcion_item${i}`]),
        url:         url(m4f[`url_texto_enlace_item${i}`]),
      });
    }

    caracteristicas = {
      pretitulo:       str(m4f['pretitulo']),
      titulo:          str(m4f['titulo']),
      imagenPrincipal: imgPrincipalUri,
      items,
    };
  }

  // ── Tabla comparativa (basic — pricing from estructura_nav) ───────────────
  const tablaNode = seccionChildren.find(c => c.content.contentTypeIdentifier === 'tabla_comparativa');
  let tablaComparativa: TablaComparativaBasicData | null = null;
  if (tablaNode) {
    const tf = tablaNode.content.fields;
    tablaComparativa = {
      pretitulo: str(tf['pretitulo']),
      titulo:    str(tf['titulo']),
      price:     structuredData.offersPrice,
    };
  }

  // ── Ventajas miniatura_3 (first miniatura_3 in resumen section) ───────────
  const ventajasNode = resumenChildren.find(c => c.content.contentTypeIdentifier === 'miniatura_3');
  let ventajas: import('./types').Miniatura3Item[] | null = null;
  if (ventajasNode) {
    ventajas = extractMiniatura3Items(ventajasNode.content.fields);
  }

  return {
    cabecera,
    structuredData,
    iconoTexto,
    caracteristicas,
    tablaComparativa,
    ventajas,
  };
}

// ─── Footer ───────────────────────────────────────────────────────────────────

/** Cache de módulo para el footer */
let _footerCache: FooterData | null = null;

/**
 * Fetches and assembles the full footer data.
 * Uses module-level cache: only fetched once per build.
 *
 * Estructura del CMS:
 *   13501 (menu_footer)
 *    ├─ 13525  Submenus   ← catálogo completo de items del footer
 *    ├─ 15106  menu_inferior
 *    │   ├─ 15122 items_izquierdo  (copyright)
 *    │   └─ 15124 items_derecho    (links legales)
 *    ├─ 67829  Seguros de viaje      ← columna 1, relacion_multiple usa content IDs
 *    ├─ 59135  Destinos destacados   ← columna 2
 *    ├─ 67826  Asegurados y viajeros ← columna 3
 *    └─ 67828  Sobre nosotros        ← columna 4
 *
 * NOTA: relacion_multiple almacena content IDs (child.content.id),
 * NO location IDs (child.locationId).
 */
export async function fetchFooterContent(): Promise<FooterData> {
  if (_footerCache) return _footerCache;

  const [rootData, submenusData, legalLeftData, legalRightData] = await Promise.all([
    fetchLocation(FOOTER_LOCATION_ID, 50),
    fetchLocation(FOOTER_SUBMENUS_LOCATION_ID, 80),
    fetchLocation(FOOTER_LEGAL_LEFT_ID),
    fetchLocation(FOOTER_LEGAL_RIGHT_ID),
  ]);

  // Mapa por content ID (no locationId) para cruzar con relacion_multiple
  const submenuMap = new Map<number, FooterSubItem>(
    submenusData.children.map((child) => {
      const f = child.content.fields;
      const urlExt = f['url_externa']?.type === 'ezurl'
        ? (f['url_externa'].value as { url: string | null; text: string | null })
        : null;
      return [
        child.content.id,
        {
          locationId: child.locationId,
          contentId:  child.content.id,
          nombre:     str(f['nombre']) || child.content.name,
          url:        urlExt?.url ?? null,
        },
      ];
    })
  );

  // Columnas: solo items tipo 'enlaces' del root (67829, 59135, 67826, 67828)
  const columnChildren = rootData.children.filter(
    (c) => c.content.contentTypeIdentifier === 'enlaces'
  );

  const columns: FooterColumn[] = columnChildren.map((child) => {
    const f = child.content.fields;
    const relMultiple = f['relacion_multiple']?.value as string | undefined;
    const submenuIds  = relMultiple
      ? relMultiple.split(',').map(Number).filter(Boolean)
      : [];

    return {
      title:      str(f['nombre']) || child.content.name,
      submenuIds,
      items:      submenuIds
                    .map((id) => submenuMap.get(id))
                    .filter((s): s is FooterSubItem => s !== undefined),
    };
  });

  const toLegalItem = (child: CMSChild): FooterSubItem => {
    const f = child.content.fields;
    const urlExt = f['url_externa']?.type === 'ezurl'
      ? (f['url_externa'].value as { url: string | null; text: string | null })
      : null;
    return {
      locationId: child.locationId,
      contentId:  child.content.id,
      nombre:     child.content.name,
      url:        urlExt?.url ?? null,
    };
  };

  _footerCache = {
    columns,
    legalLeft:  legalLeftData.children.map(toLegalItem),
    legalRight: legalRightData.children.map(toLegalItem),
  };

  return _footerCache;
}
