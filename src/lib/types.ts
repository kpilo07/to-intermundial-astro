// ─── Field value types ──────────────────────────────────────────────────────

export interface ImageValue {
  uri: string;
  alt: string;
  width: string;
  height: string;
  fileName: string;
}

export interface UrlValue {
  url: string | null;
  text: string | null;
}

// ─── Generic field container ─────────────────────────────────────────────────

export type CMSField =
  | { type: 'ezstring';       value: string }
  | { type: 'ezboolean';      value: boolean }
  | { type: 'ezselection';    value: number[] }
  | { type: 'ezimage';        value: ImageValue | null }
  | { type: 'ezurl';          value: UrlValue }
  | { type: 'ezxmltext';      value: string }
  | { type: 'ezobjectrelation'; value: string }
  | { type: 'ezkeyword';      value: string[] }
  | { type: 'ezpage';         value: string };

// ─── Content ─────────────────────────────────────────────────────────────────

export type ContentTypeIdentifier =
  | 'seccion_render'
  | 'imagen_texto'
  | 'seccion'
  | 'relacion_galeria_card_3_elementos'
  | 'block_widget'
  | 'miniatura_4'
  | 'carrusel_container'
  | 'miniatura_3'
  | 'preguntas_frecuentes'
  | 'banner_medios'
  | 'folder'
  | string;

export interface CMSContent {
  id: number;
  name: string;
  contentTypeIdentifier: ContentTypeIdentifier;
  lang: string;
  publishedAt: string;
  modifiedAt: string;
  mainLocationId: string;
  fields: Record<string, CMSField>;
}

// ─── Child / Parent location ─────────────────────────────────────────────────

export interface CMSChild {
  locationId: number;
  depth: number;
  pathString: string;
  content: CMSContent;
  /** Presente cuando se usa &depth=2 en la query (hijos anidados) */
  children?: CMSChild[];
}

// ─── Header (cabecera_block) ──────────────────────────────────────────────────

export interface HeaderTag {
  title:    string;
  iconUri:  string;
  iconAlt:  string;
}

export interface HeaderData {
  titulo:      string;
  descripcion: string;          // texto plano extraído del XML
  bgL:         string | null;   // imagen_fondo   (≥1280px)
  bgM:         string | null;   // imagen_fondo_m (960-1279px)
  bgS:         string | null;   // imagen_fondo_s (640-959px)
  bgXs:        string | null;   // imagen_fondo_xs(<640px)
  bgPosition:  string;          // background-position
  tags:        HeaderTag[];     // item_icon children
}

// ─── Root API response ───────────────────────────────────────────────────────

export interface CMSHomeResponse {
  locationId: number;
  lang: string;
  parent: {
    depth: number;
    pathString: string;
    content: CMSContent;
  };
  total: number;
  offset: number;
  limit: number;
  children: CMSChild[];
}

// ─── Typed helpers for commonly used sections ─────────────────────────────────

export interface ImagenTextoFields {
  nombre:              string;
  titulo:              string;
  pretitulo:           string;
  contenido:           string;   // raw XML, use parseXmlContent()
  imagen:              ImageValue | null;
  boton:               UrlValue;
  distribucion:        number[]; // [0]=left, [1]=right, [2]=center ...
}

export interface Miniatura4Item {
  titulo:       string;
  descripcion:  string;
  imagen:       ImageValue | null;
  url:          UrlValue;
}

export interface BannerMediosItem {
  imagen: ImageValue;
  url:    UrlValue;
}

export interface Miniatura3Item {
  titulo:      string;
  descripcion: string;
  imagen:      ImageValue | null;
}

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuItem {
  locationId:  number;
  /** CMS content ID — used as lookup key for relacion_multiple references */
  contentId:   number;
  nombre:      string;
  url:         string | null;
  iconUrl:     string | null;
  clase:       string;
  contenido:   string;
  /**
   * Content IDs of the submenu items (ezobjectrelationlist → content IDs).
   * Must be looked up against MenuItem.contentId, NOT locationId.
   */
  submenuIds:  number[];
}

export interface MenuData {
  /** Particulares | Empresas — barra superior izquierda */
  topBarLeft:  MenuItem[];
  /** Área cliente | Contacto | … — barra superior derecha */
  topBarRight: MenuItem[];
  /** Items principales del nav (Seguros de viaje, Seguros deportivos) */
  mainNav:     MenuItem[];
  /** Catálogo de productos / submenú (location 103) */
  submenus:    MenuItem[];
}

// ─── Product page (seguros-de-viaje/seguro-XXX) ──────────────────────────────

/** Fields from the cabecera_seguro node */
export interface CabeceraSeguroData {
  textoPrincipal: string;   // texto_principal → h1
  pretitulo:      string;
  imagenMobile:   string | null;  // imagen_cabecera_mobile full URL
  imagenLg:       string | null;  // imagen_cabecera_lg full URL
}

/** Fields from estructura_navegacion_producto (schema.org + breadcrumb) */
export interface EstructuraNavData {
  titulo:       string;
  description:  string;
  offersPrice:  string;   // "1.53"
  ratingValue:  string;   // "4.6"
  ratingCount:  string;   // "8943"
}

/** Fields from icono_texto node (e.g. eSIM promo) */
export interface IconoTextoData {
  subtitulo:    string;
  contenido:    string;
  urlContenido: UrlValue;
  imagen:       ImageValue | null;
}

/** Feature item inside a miniatura_4 node */
export interface CaracteristicaItem {
  titulo:       string;
  descripcion:  string;
  url:          UrlValue;
}

/** Fields from miniatura_4 node (tipo=1 → accordion layout) */
export interface CaracteristicasData {
  pretitulo:       string;
  titulo:          string;
  imagenPrincipal: string | null;  // full URL
  items:           CaracteristicaItem[];
}

/** Basic pricing info from tabla_comparativa + estructura_nav */
export interface TablaComparativaBasicData {
  pretitulo: string;
  titulo:    string;
  price:     string;   // offersPrice from estructura_nav
}

/** Aggregate data fetched once for the product page */
export interface ProductPageData {
  cabecera:         CabeceraSeguroData;
  structuredData:   EstructuraNavData;
  iconoTexto:       IconoTextoData | null;
  caracteristicas:  CaracteristicasData | null;
  tablaComparativa: TablaComparativaBasicData | null;
  /** miniatura_3 "Ventajas de contratar en Intermundial" */
  ventajas:         Miniatura3Item[] | null;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export interface FooterSubItem {
  locationId: number;
  contentId:  number;
  nombre:     string;
  url:        string | null;
}

export interface FooterColumn {
  title:       string;
  submenuIds:  number[];   // content IDs de los items en orden CMS
  items:       FooterSubItem[];
}

export interface FooterData {
  columns:    FooterColumn[];  // 4 columnas del nav del footer
  legalLeft:  FooterSubItem[]; // copyright / texto legal izquierda
  legalRight: FooterSubItem[]; // links legales derecha
}
