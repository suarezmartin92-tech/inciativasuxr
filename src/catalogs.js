export function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export const INITIATIVE_TYPES = [
  { code: "A_0.001", label: "Investigación" },
  { code: "A_2.001", label: "Discovery" },
  { code: "A_4.001", label: "Proyecto" },
  { code: "A_6.001", label: "Seguimiento" },
  { code: "A_8.001", label: "Gestión" },
  { code: "A_9.001", label: "Exposición" },
];

export const VERTICAL_CODES = [
  { code: "APP", label: "App" },
  { code: "APW", label: "App Web" },
  { code: "B2B", label: "B2B" },
  { code: "CDG", label: "Canal Digital" },
  { code: "CRO", label: "Cross" },
  { code: "FLW", label: "Flow" },
  { code: "PER", label: "Personal" },
  { code: "PRE", label: "Prepago" },
  { code: "ABN", label: "Abono" },
  { code: "NET", label: "Internet" },
  { code: "POR", label: "Portabilidad" },
  { code: "ROA", label: "Roaming" },
  { code: "SOL", label: "Soluciones Conversacionales" },
  { code: "TDA", label: "Tienda" },
  { code: "PAR", label: "Paraguay" },
  { code: "UYP", label: "Uruguay Personal" },
  { code: "UYF", label: "Uruguay Flow" },
  { code: "PPAY", label: "Personal Pay" },
  { code: "UXR", label: "UX Research" },
  { code: "SMH", label: "Smarthome" },
  { code: "DSY", label: "Design System" },
];

export const RESPONSIBLES = [
  { code: "K", name: "Kau" },
  { code: "M", name: "Martín" },
  { code: "C", name: "Cami" },
  { code: "P", name: "Pili" },
  { code: "Y", name: "Yami" },
  { code: "S", name: "Seri" },
];

export const LEVELS = [
  {
    key: "estrategico",
    label: "Estratégico",
    desc: "Objetivos a largo plazo, alto impacto dentro y fuera del ecosistema digital.",
    allowedTypes: ["Investigación", "Discovery", "Proyecto"],
  },
  {
    key: "tactico",
    label: "Táctico",
    desc: "Objetivos a corto plazo, resultados puntuales dentro del ecosistema digital.",
    allowedTypes: ["Investigación", "Seguimiento", "Gestión"],
  },
  {
    key: "proceso-interno",
    label: "Proceso interno",
    desc: "Optimiza estructura/flujo de trabajo para habilitar lo táctico y estratégico.",
    allowedTypes: ["Investigación", "Exposición", "Gestión"],
  },
];

export const PRODUCTS = [
  { id: "flow", name: "Flow", color: "#21D3A2", verticals: ["FLW"] },
  { id: "linea-movil", name: "Línea móvil", color: "#1EB2F5", verticals: ["PER", "PRE", "ABN", "POR", "ROA"] },
  { id: "internet-fibra", name: "Internet hogar (Fibra)", color: "#1EB2F5", verticals: ["NET"] },
  { id: "ppay", name: "PPay", color: "#5A50F9", verticals: ["PPAY"] },
  { id: "tienda-personal", name: "Tienda Personal", color: "#1EB2F5", verticals: ["TDA"] },
  { id: "smarthome", name: "Smarthome", color: "#052C50", verticals: ["SMH"] },
  { id: "personal-tech", name: "Personal Tech", color: "#1EB2F5", verticals: ["B2B"] },
  { id: "app", name: "APP", color: "#4F46E5", verticals: ["APP", "APW"] },
  { id: "sfe", name: "SFE", color: "#0EA5E9", verticals: ["CDG", "CRO", "SOL", "UXR", "DSY"] },
  { id: "ext", name: "EXT", color: "#F97316", verticals: ["PAR", "UYP", "UYF"] },
];

export const CATALOG_MAPS = {
  initiativeTypeDigits: Object.fromEntries(
    INITIATIVE_TYPES.map((t) => {
      const digit = t.code?.split("_")?.[1]?.split(".")?.[0] || "";
      return [digit, t];
    })
  ),
  verticalCodeMap: Object.fromEntries(VERTICAL_CODES.map((v) => [v.code, v.label])),
  verticalCodeSet: new Set(VERTICAL_CODES.map((v) => v.code)),
  responsibleCodeSet: new Set(RESPONSIBLES.map((r) => r.code)),
  productById: Object.fromEntries(PRODUCTS.map((p) => [p.id, p])),
  verticalToProduct: PRODUCTS.reduce((acc, product) => {
    product.verticals.forEach((code) => {
      acc[code] = product.id;
    });
    return acc;
  }, {}),
  levelLabelToKey: Object.fromEntries(LEVELS.map((l) => [normalizeHeader(l.label), l.key])),
};
