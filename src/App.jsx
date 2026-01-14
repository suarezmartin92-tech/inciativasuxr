import React, { useMemo, useState, useCallback, useEffect } from "react";
import ReactFlow, { Background, Controls, MiniMap, Handle, Position } from "reactflow";
import "reactflow/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  Layers,
  Info,
  Tag,
  Calendar,
  Users,
  Wrench,
  ListChecks,
  Link as LinkIcon,
  Save,
  X,
  Pencil,
  Filter,
  Plus,
  RotateCcw,
} from "lucide-react";
/**
 * UXR Mejora Continua — Árbol + buscador global + edición + crear iniciativa + filtros
 *
 * Implementado:
 * - Grafo global (opcional): ver resultados globales en el grafo.
 * - Crear iniciativa: botón “Nueva iniciativa” + ID auto-incremental por tipo (M-<tipo>-<###>).
 * - Editor usable (cerrar/guardar) + persistencia localStorage.
 * - Filtros reales (modal): Tipo, Quarter/Año, Vertical, Responsable, Técnica, Nivel.
 */

// ---------------------------------
// 0) CATALOGOS (tu convención)
// ---------------------------------
const INITIATIVE_TYPES = [
  { code: "A_0.001", label: "Investigación" },
  { code: "A_2.001", label: "Discovery" },
  { code: "A_4.001", label: "Proyecto" },
  { code: "A_6.001", label: "Seguimiento" },
  { code: "A_8.001", label: "Gestión" },
  { code: "A_9.001", label: "Exposición" },
];

const VERTICAL_CODES = [
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

const RESPONSIBLES = [
  { code: "K", name: "Kau" },
  { code: "M", name: "Cucho" },
  { code: "C", name: "Cami" },
  { code: "P", name: "Pili" },
  { code: "Y", name: "Yami" },
  { code: "S", name: "Seri" },
];

const LEVELS = [
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

// ---------------------------------
// 1) PRODUCTO / FRANQUICIA (UI del grafo)
// ---------------------------------
const PRODUCTS = [
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

// ---------------------------------
// CSV NAMING PARSER
// ---------------------------------
const INITIATIVE_TYPE_DIGITS = Object.fromEntries(
  INITIATIVE_TYPES.map((t) => {
    const digit = t.code?.split("_")?.[1]?.split(".")?.[0] || "";
    return [digit, t];
  })
);

const VERTICAL_CODE_MAP = Object.fromEntries(VERTICAL_CODES.map((v) => [v.code, v.label]));
const VERTICAL_CODE_SET = new Set(VERTICAL_CODES.map((v) => v.code));
const RESPONSIBLE_CODE_SET = new Set(RESPONSIBLES.map((r) => r.code));
const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const VERTICAL_TO_PRODUCT = PRODUCTS.reduce((acc, product) => {
  product.verticals.forEach((code) => {
    acc[code] = product.id;
  });
  return acc;
}, {});

const LEVEL_LABEL_TO_KEY = Object.fromEntries(LEVELS.map((l) => [normalizeHeader(l.label), l.key]));

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function verticalLabel(code) {
  return VERTICAL_CODE_MAP[code] || code || "—";
}

function productMeta(productId) {
  return PRODUCT_BY_ID[productId] || null;
}

function productIdForVertical(code) {
  return VERTICAL_TO_PRODUCT[code] || null;
}

function normalizeTechniques(raw) {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.toLowerCase() === "mix") return ["Mix"];
  return value
    .split(/[+,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSubproductFromTitle(title) {
  const raw = String(title || "").trim();
  const match = raw.match(/\[([^\]]+)\]/);
  const subproductName = match ? match[1].trim() : "";
  const cleanedTitle = raw.replace(/\s*\[[^\]]+\]\s*/, " ").replace(/\s+/g, " ").trim();
  return { subproductName, cleanedTitle };
}

function ensureSubproduct(verticalCode, subproductName) {
  const name = (subproductName || "").trim() || "Sin subproducto";
  const keyBase = verticalCode || "sin-vertical";
  return {
    name,
    id: `${keyBase}-${slugify(name)}`,
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function initiativeTypeFromValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/A_([0-9])\./) || raw.match(/([0-9])/);
  const digit = match?.[1] || null;
  return digit ? INITIATIVE_TYPE_DIGITS[digit] || null : null;
}

function levelKeyFromValue(value) {
  const normalized = normalizeHeader(value);
  return LEVEL_LABEL_TO_KEY[normalized] || null;
}

// ---------------------------------
// 2) DATA DE EJEMPLO
// ---------------------------------
const DEFAULT_STUDIES = [
  {
    id: "M-6-001",
    initiativeTypeCode: "A_6.001",
    initiativeTypeLabel: "Seguimiento",
    quarter: "Q2.24",
    verticalCode: "FLW",
    titleShort: "Home — motivo de visita y encontrabilidad",
    techniques: ["Encuesta continua", "Tracking"],
    levelKey: "tactico",
    responsible: "K",
    productId: "flow",
    subproductName: "Home y landings contratación",
    subproductId: "FLW-home-y-landings-contratacion",
    parentId: null,
    status: "🟢 Implementado",
    type: "Encuesta permanente",
    tools: ["(tool) Encuestas", "(tool) Dashboard"],
    roles: {
      uxr: ["UXR Vertical TV"],
      product: ["PM Flow"],
      design: ["UX/UI Flow"],
      data: ["BI"],
      vendor: [],
    },
    insights: [
      "Se observa fricción de encontrabilidad en accesos a secciones específicas desde Home.",
      "Motivos de visita se agrupan en: ver en vivo, retomar VOD, gestionar suscripción.",
    ],
    notes: "Encuesta always-on para capturar cambios a lo largo del tiempo.",
    links: [
      { label: "Deck/Doc", url: "#" },
      { label: "Dashboard", url: "#" },
    ],
  },
  {
    id: "M-0-009",
    initiativeTypeCode: "A_0.001",
    initiativeTypeLabel: "Investigación",
    quarter: "Q3.25",
    verticalCode: "FLW",
    titleShort: "Music — motivo de visita y encontrabilidad",
    techniques: ["Encuesta"],
    levelKey: "tactico",
    responsible: "M",
    productId: "flow",
    subproductName: "Landing Música",
    subproductId: "FLW-landing-musica",
    parentId: "M-6-001",
    status: "🟡 Parcial",
    type: "Encuesta (derivada)",
    tools: ["(tool) Encuestas"],
    roles: {
      uxr: ["UXR Vertical TV"],
      product: ["PM Música"],
      design: ["UX/UI Música"],
      data: ["BI"],
      vendor: [],
    },
    insights: [
      "Mayor proporción de visitas orientadas a exploración (no a búsqueda directa).",
      "Encontrabilidad de categorías musicales depende de etiquetas y jerarquía.",
    ],
    notes: "Investigación de 2do nivel derivada del estudio de Home/landings.",
    links: [{ label: "Doc", url: "#" }],
  },
];

// ---------------------------------
// 3) HELPERS
// ---------------------------------
const clamp = (s = "", n = 140) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

function quarterToYear(quarter) {
  const m = String(quarter || "").match(/Q[1-4]\.([0-9]{2})/);
  if (!m) return null;
  const yy = parseInt(m[1], 10);
  return 2000 + yy;
}

function techniqueToken(techniques = []) {
  const t = (techniques || []).filter(Boolean);
  if (t.length <= 0) return "(técnica)";
  if (t.length === 1) return `(${t[0]})`;
  if (t.length === 2) return `(${t[0]} + ${t[1]})`;
  return "(mix)";
}

function levelLabel(levelKey) {
  return LEVELS.find((l) => l.key === levelKey)?.label || "—";
}

function responsibleLabel(code) {
  const r = RESPONSIBLES.find((x) => x.code === code);
  return r ? `${r.code} — ${r.name}` : "—";
}

function buildInitiativeName(study) {
  const typeCode = study.initiativeTypeCode || "A_0.001";
  const q = study.quarter || "Q?.??";
  const v = study.verticalCode || "CRO";
  const title = study.titleShort || "(sin título)";
  const tech = techniqueToken(study.techniques);
  const lvl = levelLabel(study.levelKey);
  return `${typeCode} (${q}) ${v} ${title} ${tech} — ${lvl}`;
}

function buildHaystack(study) {
  return [
    study.id,
    buildInitiativeName(study),
    study.initiativeTypeLabel,
    study.quarter,
    String(quarterToYear(study.quarter) || ""),
    study.verticalCode,
    study.titleShort,
    productLabel(study.productId),
    verticalLabel(study.verticalCode),
    study.subproductName,
    study.status,
    study.type,
    study.responsible,
    responsibleLabel(study.responsible),
    study.levelKey,
    levelLabel(study.levelKey),
    study.productId,
    study.subproductId,
    ...(study.insights || []),
    ...(study.tools || []),
    ...(study.techniques || []),
    ...(study.links || []).map((l) => `${l.label} ${l.url}`),
  ]
    .join(" ")
    .toLowerCase();
}

function productLabel(productId) {
  return productMeta(productId)?.name || productId || "—";
}

function verticalOptionsForProduct(productId) {
  const product = productMeta(productId);
  const codes = product?.verticals?.length ? product.verticals : VERTICAL_CODES.map((v) => v.code);
  return codes.map((code) => ({
    code,
    label: verticalLabel(code),
  }));
}

function typeDigitFromInitiativeTypeCode(initiativeTypeCode) {
  const m = String(initiativeTypeCode || "").match(/^A_([0-9])\./);
  return m ? m[1] : "0";
}

function nextIdForType(studies, initiativeTypeCode) {
  const digit = typeDigitFromInitiativeTypeCode(initiativeTypeCode);
  const re = new RegExp(`^M-${digit}-([0-9]{3})$`);
  let max = 0;
  for (const s of studies) {
    const m = String(s.id || "").match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = String(max + 1).padStart(3, "0");
  return `M-${digit}-${next}`;
}

function currentQuarterString() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const m = d.getMonth() + 1;
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4;
  return `Q${q}.${yy}`;
}

// Filters
const DEFAULT_FILTERS = {
  types: new Set(),
  quarters: new Set(),
  years: new Set(),
  verticals: new Set(),
  responsibles: new Set(),
  techniques: new Set(),
  levels: new Set(),
};

function cloneFilters(f) {
  return {
    types: new Set(f.types),
    quarters: new Set(f.quarters),
    years: new Set(f.years),
    verticals: new Set(f.verticals),
    responsibles: new Set(f.responsibles),
    techniques: new Set(f.techniques),
    levels: new Set(f.levels),
  };
}

function countActiveFilters(f) {
  return (
    f.types.size +
    f.quarters.size +
    f.years.size +
    f.verticals.size +
    f.responsibles.size +
    f.techniques.size +
    f.levels.size
  );
}

function passesFilters(study, f) {
  if (f.types.size > 0) {
    const label = study.initiativeTypeLabel || "";
    if (!f.types.has(label)) return false;
  }

  if (f.quarters.size > 0) {
    if (!f.quarters.has(study.quarter)) return false;
  }

  if (f.years.size > 0) {
    const y = quarterToYear(study.quarter);
    if (!y || !f.years.has(String(y))) return false;
  }

  if (f.verticals.size > 0) {
    const code = study.verticalCode || "";
    if (!f.verticals.has(code)) return false;
  }

  if (f.responsibles.size > 0) {
    const r = study.responsible || "";
    if (!f.responsibles.has(r)) return false;
  }

  if (f.techniques.size > 0) {
    const ts = new Set((study.techniques || []).map((x) => String(x)));
    let hit = false;
    for (const t of f.techniques) {
      if (ts.has(t)) {
        hit = true;
        break;
      }
    }
    if (!hit) return false;
  }

  if (f.levels.size > 0) {
    const lk = study.levelKey || "";
    if (!f.levels.has(lk)) return false;
  }

  return true;
}

function applySearchAndFilters(studies, search, filters) {
  const q = (search || "").trim().toLowerCase();
  return studies.filter((s) => {
    if (!passesFilters(s, filters)) return false;
    if (!q) return true;
    return buildHaystack(s).includes(q);
  });
}

// Persistencia simple
const STORAGE_KEY = "uxr_tree_studies_v5";
function loadStudies() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STUDIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_STUDIES;
    return parsed;
  } catch {
    return DEFAULT_STUDIES;
  }
}
function saveStudies(studies) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(studies));
  } catch {
    // noop
  }
}

// ---------------------------------
// 4) UI PIEZAS
// ---------------------------------
const StatusPill = ({ status }) => (
  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">{status}</span>
);

const Chip = ({ children }) => (
  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{children}</span>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
    <Icon className="h-4 w-4" />
    <span>{children}</span>
  </div>
);

function Modal({ open, title, onClose, footer, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            className="w-full max-w-[920px] overflow-hidden rounded-2xl border bg-white shadow-xl"
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.98 }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-500">{title}</div>
              </div>
              <button onClick={onClose} className="rounded-xl border p-2 hover:bg-zinc-50" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto p-5">{children}</div>

            {footer ? <div className="sticky bottom-0 border-t bg-white px-5 py-4">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs font-semibold text-zinc-700">{label}</div>
        {hint ? <div className="text-[11px] text-zinc-500">{hint}</div> : null}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CheckboxItem({ checked, onChange, label, sublabel }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-2 hover:bg-zinc-50">
      <input type="checkbox" className="mt-1" checked={checked} onChange={onChange} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900">{label}</span>
        {sublabel ? <span className="block text-xs text-zinc-600">{sublabel}</span> : null}
      </span>
    </label>
  );
}

function FilterModal({ open, onClose, studies, value, onApply }) {
  const [draft, setDraft] = useState(() => cloneFilters(value));

  useEffect(() => {
    if (open) setDraft(cloneFilters(value));
  }, [open, value]);

  const quartersOptions = useMemo(() => uniqueSorted(studies.map((s) => s.quarter)), [studies]);
  const yearsOptions = useMemo(
    () => uniqueSorted(studies.map((s) => quarterToYear(s.quarter)).filter(Boolean).map((y) => String(y))),
    [studies]
  );
  const techniquesOptions = useMemo(
    () => uniqueSorted(studies.flatMap((s) => s.techniques || []).map((t) => String(t))),
    [studies]
  );

  const toggle = (setName, key) => {
    setDraft((prev) => {
      const next = cloneFilters(prev);
      if (next[setName].has(key)) next[setName].delete(key);
      else next[setName].add(key);
      return next;
    });
  };

  const clearAll = () => setDraft(cloneFilters(DEFAULT_FILTERS));

  return (
    <Modal
      open={open}
      title="Filtros"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50">
              Cerrar
            </button>
            <button
              onClick={() => {
                onApply(draft);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-xl border bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
            >
              <Save className="h-4 w-4" />
              Aplicar
            </button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Tipo de iniciativa</div>
            <div className="mt-2">
              {INITIATIVE_TYPES.map((t) => (
                <CheckboxItem
                  key={t.label}
                  checked={draft.types.has(t.label)}
                  onChange={() => toggle("types", t.label)}
                  label={t.label}
                  sublabel={t.code}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Nivel</div>
            <div className="mt-2">
              {LEVELS.map((l) => (
                <CheckboxItem
                  key={l.key}
                  checked={draft.levels.has(l.key)}
                  onChange={() => toggle("levels", l.key)}
                  label={l.label}
                  sublabel={l.desc}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Responsable</div>
            <div className="mt-2">
              {RESPONSIBLES.map((r) => (
                <CheckboxItem
                  key={r.code}
                  checked={draft.responsibles.has(r.code)}
                  onChange={() => toggle("responsibles", r.code)}
                  label={`${r.code} — ${r.name}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Quarter</div>
            <div className="mt-2 max-h-[220px] overflow-auto">
              {quartersOptions.length === 0 ? (
                <div className="text-sm text-zinc-600">No hay quarters cargados.</div>
              ) : (
                quartersOptions.map((q) => (
                  <CheckboxItem
                    key={q}
                    checked={draft.quarters.has(q)}
                    onChange={() => toggle("quarters", q)}
                    label={q}
                    sublabel={quarterToYear(q) ? String(quarterToYear(q)) : ""}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Año</div>
            <div className="mt-2">
              {yearsOptions.length === 0 ? (
                <div className="text-sm text-zinc-600">No hay años detectados.</div>
              ) : (
                yearsOptions.map((y) => (
                  <CheckboxItem
                    key={y}
                    checked={draft.years.has(y)}
                    onChange={() => toggle("years", y)}
                    label={y}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Vertical (código)</div>
            <div className="mt-2 max-h-[220px] overflow-auto">
              {VERTICAL_CODES.map((v) => (
                <CheckboxItem
                  key={v.code}
                  checked={draft.verticals.has(v.code)}
                  onChange={() => toggle("verticals", v.code)}
                  label={v.label}
                  sublabel={v.code}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-semibold text-zinc-600">Técnica</div>
            <div className="mt-2 max-h-[220px] overflow-auto">
              {techniquesOptions.length === 0 ? (
                <div className="text-sm text-zinc-600">No hay técnicas detectadas.</div>
              ) : (
                techniquesOptions.map((t) => (
                  <CheckboxItem
                    key={t}
                    checked={draft.techniques.has(t)}
                    onChange={() => toggle("techniques", t)}
                    label={t}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------
// 5) NODOS
// ---------------------------------
function StudyNode({ data }) {
  return (
    <div
      className={`min-w-[260px] max-w-[340px] overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow ${
        data.isSelected ? "ring-2 ring-zinc-900" : ""
      }`}
    >
      <div className="h-1.5" style={{ backgroundColor: data.verticalColor || "#e5e7eb" }} />
      <div className="px-3 py-2">
        <Handle type="target" position={Position.Top} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-500">
              {data.id} • {data.quarter} • {data.verticalCode}
              {data.responsible ? ` • ${data.responsible}` : ""}
            </div>
            <div className="mt-0.5 line-clamp-2 text-sm font-semibold text-zinc-900">{data.titleShort}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Chip>{data.initiativeTypeLabel || data.type}</Chip>
              <Chip>{data.status}</Chip>
            </div>
          </div>
          <div className="mt-1 rounded-xl border bg-zinc-50 px-2 py-1 text-[11px] text-zinc-600">Abrir</div>
        </div>
        <div className="mt-2 text-xs text-zinc-600 line-clamp-2">{data.preview}</div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
}

function VerticalNode({ data }) {
  return (
    <div
      className={`min-w-[260px] rounded-2xl border bg-white px-3 py-2 shadow-sm ${
        data.isSelected ? "ring-2 ring-zinc-900" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-500">Vertical</div>
          <div className="text-sm font-semibold text-zinc-900">
            {data.code} — {data.name}
          </div>
        </div>
        <Layers className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="mt-2 text-xs text-zinc-600">{data.subtitle}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function SubproductNode({ data }) {
  return (
    <div
      className={`min-w-[260px] rounded-2xl border bg-white px-3 py-2 shadow-sm ${
        data.isSelected ? "ring-2 ring-zinc-900" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-zinc-500">Subproducto</div>
          <div className="text-sm font-semibold text-zinc-900">{data.name}</div>
        </div>
        <Layers className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="mt-2 text-xs text-zinc-600">{data.subtitle}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ProductNode({ data }) {
  return (
    <div
      className={`min-w-[360px] rounded-2xl border px-4 py-3 text-white shadow ${
        data.isSelected ? "ring-2 ring-zinc-900 ring-offset-2" : ""
      }`}
      style={{ backgroundColor: data.color || "#111827", borderColor: data.color || "#111827" }}
    >
      <div className="text-xs font-semibold text-white/80">Producto / Franquicia</div>
      <div className="mt-0.5 text-base font-semibold">{data.name}</div>
      <div className="mt-2 text-xs text-white/80">{data.subtitle}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { product: ProductNode, vertical: VerticalNode, subproduct: SubproductNode, study: StudyNode };

// ---------------------------------
// 6) BUILDERS: modo producto/franquicia / modo global
// ---------------------------------
function orderStudiesByHierarchy(arr) {
  const map = new Map(arr.map((s) => [s.id, s]));
  const roots = arr.filter((s) => !s.parentId || !map.has(s.parentId));
  const children = new Map();
  arr.forEach((s) => {
    if (s.parentId) {
      if (!children.has(s.parentId)) children.set(s.parentId, []);
      children.get(s.parentId).push(s);
    }
  });

  const out = [];
  const dfs = (s, depth = 0) => {
    out.push({ s, depth });
    (children.get(s.id) || []).forEach((c) => dfs(c, depth + 1));
  };

  roots.forEach((r) => dfs(r, 0));
  return out;
}

function buildProductGraph({ productId, search, filters, studies }) {
  const product = productMeta(productId) || PRODUCTS[0];
  const scope = studies.filter((s) => s.productId === product.id);
  const filteredStudies = applySearchAndFilters(scope, search, filters);

  const nodes = [];
  const edges = [];

  nodes.push({
    id: `product:${product.id}`,
    type: "product",
    position: { x: 0, y: 0 },
    data: {
      name: product.name,
      subtitle: `${product.verticals.length} verticales`,
      color: product.color,
    },
  });

  const verticalGap = 420;
  const verticalY = 180;
  const verticals = product.verticals.map((code) => ({
    code,
    name: verticalLabel(code),
  }));

  verticals.forEach((vertical, index) => {
    const vx = index * verticalGap - ((verticals.length - 1) * verticalGap) / 2;
    nodes.push({
      id: `vertical:${product.id}:${vertical.code}`,
      type: "vertical",
      position: { x: vx, y: verticalY },
      data: {
        code: vertical.code,
        name: vertical.name,
        subtitle: "Vertical",
      },
    });

    edges.push({
      id: `e:product:${product.id}->vertical:${vertical.code}`,
      source: `product:${product.id}`,
      target: `vertical:${product.id}:${vertical.code}`,
      animated: false,
      style: { strokeWidth: 2 },
    });

    const studiesInVertical = filteredStudies.filter((s) => s.verticalCode === vertical.code);
    const subMap = new Map();
    studiesInVertical.forEach((s) => {
      const fallback = ensureSubproduct(s.verticalCode, s.subproductName);
      const subKey = s.subproductId || fallback.id;
      if (!subMap.has(subKey)) {
        subMap.set(subKey, {
          name: s.subproductName || fallback.name,
          items: [],
        });
      }
      subMap.get(subKey).items.push(s);
    });

    const subproducts = Array.from(subMap.entries()).map(([id, value]) => ({
      id,
      name: value.name,
      items: value.items,
    }));

    const subGap = 320;
    const subY = 360;
    subproducts.forEach((sub, subIndex) => {
      const sx = vx + subIndex * subGap - ((subproducts.length - 1) * subGap) / 2;
      nodes.push({
        id: `sub:${product.id}:${vertical.code}:${sub.id}`,
        type: "subproduct",
        position: { x: sx, y: subY },
        data: { name: sub.name, subtitle: "Subproducto" },
      });

      edges.push({
        id: `e:vertical:${product.id}:${vertical.code}->sub:${sub.id}`,
        source: `vertical:${product.id}:${vertical.code}`,
        target: `sub:${product.id}:${vertical.code}:${sub.id}`,
        animated: false,
        style: { strokeWidth: 2 },
      });

      const ordered = orderStudiesByHierarchy(sub.items);
      const baseY = 520;
      ordered.forEach(({ s, depth }, idx) => {
        const x = sx + depth * 120;
        const y = baseY + idx * 140;
        nodes.push({
          id: `study:${s.id}`,
          type: "study",
          position: { x, y },
          data: {
            ...s,
            verticalColor: product.color,
            preview: clamp((s.insights?.[0] || s.notes || "").toString(), 120),
          },
        });

        if (!s.parentId) {
          edges.push({
            id: `e:sub:${sub.id}->study:${s.id}`,
            source: `sub:${product.id}:${vertical.code}:${sub.id}`,
            target: `study:${s.id}`,
            style: { strokeWidth: 2 },
          });
        }

        if (s.parentId) {
          edges.push({
            id: `e:study:${s.parentId}->study:${s.id}`,
            source: `study:${s.parentId}`,
            target: `study:${s.id}`,
            animated: true,
            style: { strokeWidth: 2 },
          });
        }
      });
    });
  });

  return {
    mode: "product",
    title: product.name,
    nodes,
    edges,
    filteredStudies,
    studiesInScope: scope,
  };
}

function buildGlobalGraph({ search, filters, studies }) {
  const matched = applySearchAndFilters(studies, search, filters);
  const byProduct = new Map();
  matched.forEach((s) => {
    const pId = s.productId || "(sin producto)";
    if (!byProduct.has(pId)) byProduct.set(pId, []);
    byProduct.get(pId).push(s);
  });

  const products = Array.from(byProduct.keys())
    .map((id) => productMeta(id))
    .filter(Boolean);

  const nodes = [];
  const edges = [];
  const productGap = 620;

  products.forEach((product, productIndex) => {
    const px = productIndex * productGap - ((products.length - 1) * productGap) / 2;
    nodes.push({
      id: `product:${product.id}`,
      type: "product",
      position: { x: px, y: 0 },
      data: {
        name: product.name,
        subtitle: `${product.verticals.length} verticales`,
        color: product.color,
      },
    });

    const studiesInProduct = byProduct.get(product.id) || [];
    const byVertical = new Map();
    studiesInProduct.forEach((s) => {
      const code = s.verticalCode || "(sin vertical)";
      if (!byVertical.has(code)) byVertical.set(code, []);
      byVertical.get(code).push(s);
    });

    const verticals = Array.from(byVertical.keys()).map((code) => ({
      code,
      name: verticalLabel(code),
    }));

    const verticalGap = 380;
    const verticalY = 200;
    verticals.forEach((vertical, verticalIndex) => {
      const vx = px + verticalIndex * verticalGap - ((verticals.length - 1) * verticalGap) / 2;
      nodes.push({
        id: `vertical:${product.id}:${vertical.code}`,
        type: "vertical",
        position: { x: vx, y: verticalY },
        data: {
          code: vertical.code,
          name: vertical.name,
          subtitle: "Vertical",
        },
      });

      edges.push({
        id: `e:product:${product.id}->vertical:${vertical.code}`,
        source: `product:${product.id}`,
        target: `vertical:${product.id}:${vertical.code}`,
        style: { strokeWidth: 2 },
      });

      const studiesInVertical = byVertical.get(vertical.code) || [];
      const subMap = new Map();
      studiesInVertical.forEach((s) => {
        const fallback = ensureSubproduct(s.verticalCode, s.subproductName);
        const subKey = s.subproductId || fallback.id;
        if (!subMap.has(subKey)) {
          subMap.set(subKey, {
            name: s.subproductName || fallback.name,
            items: [],
          });
        }
        subMap.get(subKey).items.push(s);
      });

      const subproducts = Array.from(subMap.entries()).map(([id, value]) => ({
        id,
        name: value.name,
        items: value.items,
      }));

      const subGap = 300;
      const subY = 380;
      subproducts.forEach((sub, subIndex) => {
        const sx = vx + subIndex * subGap - ((subproducts.length - 1) * subGap) / 2;
        nodes.push({
          id: `sub:${product.id}:${vertical.code}:${sub.id}`,
          type: "subproduct",
          position: { x: sx, y: subY },
          data: { name: sub.name, subtitle: "Subproducto" },
        });

        edges.push({
          id: `e:vertical:${product.id}:${vertical.code}->sub:${sub.id}`,
          source: `vertical:${product.id}:${vertical.code}`,
          target: `sub:${product.id}:${vertical.code}:${sub.id}`,
          style: { strokeWidth: 2 },
        });

        const ordered = orderStudiesByHierarchy(sub.items);
        const baseY = 540;
        ordered.forEach(({ s, depth }, idx) => {
          const x = sx + depth * 120;
          const y = baseY + idx * 140;
          nodes.push({
            id: `study:${s.id}`,
            type: "study",
            position: { x, y },
            data: {
              ...s,
              verticalColor: product.color,
              preview: clamp((s.insights?.[0] || s.notes || "").toString(), 120),
            },
          });

          if (!s.parentId) {
            edges.push({
              id: `e:sub:${sub.id}->study:${s.id}`,
              source: `sub:${product.id}:${vertical.code}:${sub.id}`,
              target: `study:${s.id}`,
              style: { strokeWidth: 2 },
            });
          }

          if (s.parentId) {
            edges.push({
              id: `e:study:${s.parentId}->study:${s.id}`,
              source: `study:${s.parentId}`,
              target: `study:${s.id}`,
              animated: true,
              style: { strokeWidth: 2 },
            });
          }
        });
      });
    });
  });

  return {
    mode: "global",
    title: "Resultados globales",
    nodes,
    edges,
    filteredStudies: matched,
    studiesInScope: matched,
  };
}

// ---------------------------------
// 7) DETAILS + EDIT FORM
// ---------------------------------
function DetailsPanel({ selectedStudy, onGoToStudy, studiesInScope, onEdit }) {
  if (!selectedStudy) {
    return (
      <div className="h-full rounded-2xl border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <Info className="h-4 w-4" />
          <span>Detalle</span>
        </div>
        <p className="mt-2 text-sm text-zinc-600">Seleccioná una iniciativa para ver sus características.</p>
        <div className="mt-4 rounded-xl border bg-zinc-50 p-3 text-xs text-zinc-600">
          Tip: podés filtrar por Tipo/Quarter/Vertical/Responsable/Nivel y además buscar por tema.
        </div>
      </div>
    );
  }

  const parent = selectedStudy.parentId ? studiesInScope.find((s) => s.id === selectedStudy.parentId) : null;
  const children = studiesInScope.filter((s) => s.parentId === selectedStudy.id);

  return (
    <div className="h-full rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-zinc-500">
            {selectedStudy.id} • {selectedStudy.quarter} • {selectedStudy.verticalCode}
            {selectedStudy.responsible ? ` • ${selectedStudy.responsible}` : ""}
          </div>
          <div className="mt-1 text-base font-semibold text-zinc-900">{selectedStudy.titleShort}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill status={selectedStudy.status} />
            <Chip>{selectedStudy.initiativeTypeLabel || "—"}</Chip>
            <Chip>{levelLabel(selectedStudy.levelKey)}</Chip>
            <Chip>{responsibleLabel(selectedStudy.responsible)}</Chip>
          </div>
          <div className="mt-2 rounded-xl border bg-zinc-50 p-2 text-xs text-zinc-700">
            <div className="font-semibold">Naming</div>
            <div className="mt-1">{buildInitiativeName(selectedStudy)}</div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <SectionTitle icon={Tag}>Técnicas</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {(selectedStudy.techniques || []).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon={Wrench}>Herramientas</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {(selectedStudy.tools || []).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon={Users}>Roles</SectionTitle>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(selectedStudy.roles || {}).map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-zinc-50 p-2">
                <div className="font-semibold capitalize text-zinc-700">{k}</div>
                <div className="mt-1 text-zinc-600">{(v || []).join(", ") || "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle icon={ListChecks}>Insights</SectionTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {(selectedStudy.insights || []).map((ins, idx) => (
              <li key={idx}>{ins}</li>
            ))}
          </ul>
        </div>

        <div>
          <SectionTitle icon={Calendar}>Notas</SectionTitle>
          <div className="mt-2 rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">{selectedStudy.notes || "—"}</div>
        </div>

        <div>
          <SectionTitle icon={LinkIcon}>Navegación</SectionTitle>
          <div className="mt-2 space-y-2">
            {parent ? (
              <button
                onClick={() => onGoToStudy(parent.id)}
                className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span className="text-zinc-600">Padre</span>
                <span className="font-semibold text-zinc-900">{parent.id}</span>
              </button>
            ) : (
              <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Sin padre (raíz)</div>
            )}

            {children.length > 0 ? (
              <div className="rounded-xl border p-2">
                <div className="px-1 pb-2 text-xs font-semibold text-zinc-600">Hijas / derivadas</div>
                <div className="space-y-1">
                  {children.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onGoToStudy(c.id)}
                      className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      <span className="text-zinc-600">{c.id}</span>
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-zinc-50 px-3 py-2 text-sm text-zinc-600">Sin derivadas todavía</div>
            )}

            {(selectedStudy.links || []).length > 0 && (
              <div className="rounded-xl border p-2">
                <div className="px-1 pb-2 text-xs font-semibold text-zinc-600">Links</div>
                <div className="space-y-1">
                  {selectedStudy.links.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      className="block rounded-xl px-2 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditStudyForm({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const typeLabel = INITIATIVE_TYPES.find((t) => t.code === value.initiativeTypeCode)?.label || "—";

  useEffect(() => {
    if (typeLabel !== value.initiativeTypeLabel) set({ initiativeTypeLabel: typeLabel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.initiativeTypeCode]);

  const allowedLevelHint = useMemo(() => {
    const allowed = LEVELS.filter((l) => l.allowedTypes.includes(typeLabel)).map((l) => l.label);
    return allowed.length ? `Sugeridos para “${typeLabel}”: ${allowed.join(", ")}` : "";
  }, [typeLabel]);

  const namingPreview = useMemo(() => buildInitiativeName(value), [value]);

  const verticalOptions = verticalOptionsForProduct(value.productId);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-zinc-50 p-4">
        <div className="text-xs font-semibold text-zinc-600">Preview naming</div>
        <div className="mt-2 text-sm font-semibold text-zinc-900">{namingPreview}</div>
        <div className="mt-2 text-xs text-zinc-600">Se arma con: Tipo + Quarter + Vertical + Título + Técnica + Nivel</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Tipo de iniciativa (código)">
          <select
            value={value.initiativeTypeCode || ""}
            onChange={(e) => set({ initiativeTypeCode: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            {INITIATIVE_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.code} — {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Quarter" hint="Formato: Q1.25 / Q2.25 / ...">
          <input
            value={value.quarter || ""}
            onChange={(e) => set({ quarter: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Q1.26"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Producto / Franquicia">
          <select
            value={value.productId || ""}
            onChange={(e) => {
              const nextProductId = e.target.value;
              const options = verticalOptionsForProduct(nextProductId);
              const hasVertical = options.some((option) => option.code === value.verticalCode);
              const nextVerticalCode = hasVertical ? value.verticalCode : options[0]?.code || "";
              const sub = ensureSubproduct(nextVerticalCode, value.subproductName);
              set({
                productId: nextProductId,
                verticalCode: nextVerticalCode,
                subproductId: sub.id,
                subproductName: value.subproductName || sub.name,
              });
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            {PRODUCTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Vertical (código)">
          <select
            value={value.verticalCode || ""}
            onChange={(e) => {
              const nextVerticalCode = e.target.value;
              const nextProductId = productIdForVertical(nextVerticalCode) || value.productId;
              const sub = ensureSubproduct(nextVerticalCode, value.subproductName);
              set({
                verticalCode: nextVerticalCode,
                productId: nextProductId,
                subproductId: sub.id,
                subproductName: value.subproductName || sub.name,
              });
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            {verticalOptions.map((v) => (
              <option key={v.code} value={v.code}>
                {v.code} — {v.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nivel" hint={allowedLevelHint || ""}>
          <select
            value={value.levelKey || ""}
            onChange={(e) => set({ levelKey: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            {LEVELS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Responsable" hint="Código corto para filtros y naming">
          <select
            value={value.responsible || ""}
            onChange={(e) => set({ responsible: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {RESPONSIBLES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Subproducto (nombre)" hint="Se agrupa por vertical + subproducto">
          <input
            value={value.subproductName || ""}
            onChange={(e) => {
              const sub = ensureSubproduct(value.verticalCode, e.target.value);
              set({ subproductName: e.target.value, subproductId: sub.id });
            }}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Ej: Flujo Portabilidad"
          />
        </Field>

        <Field label="Técnicas (separadas por coma)" hint="Ej: Entrevistas, Usabilidad">
          <input
            value={(value.techniques || []).join(", ")}
            onChange={(e) =>
              set({
                techniques: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Entrevistas, Test de usabilidad"
          />
        </Field>
      </div>

      <Field label="Título (local/componente/flujo + tema)">
        <input
          value={value.titleShort || ""}
          onChange={(e) => set({ titleShort: e.target.value })}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="Home — motivo de visita y encontrabilidad"
        />
      </Field>

      <Field label="Insights (uno por línea)">
        <textarea
          value={(value.insights || []).join("\n")}
          onChange={(e) =>
            set({
              insights: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
          className="min-h-[120px] w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={`Insight 1\nInsight 2\nInsight 3`}
        />
      </Field>

      <Field label="Notas">
        <textarea
          value={value.notes || ""}
          onChange={(e) => set({ notes: e.target.value })}
          className="min-h-[90px] w-full rounded-xl border px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status">
          <input
            value={value.status || ""}
            onChange={(e) => set({ status: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="🟡 En curso"
          />
        </Field>
        <Field label="Tipo (operativo)">
          <input
            value={value.type || ""}
            onChange={(e) => set({ type: e.target.value })}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Encuesta permanente"
          />
        </Field>
      </div>

      <Field label="ParentId" hint="Para derivadas (opcional)">
        <input
          value={value.parentId || ""}
          onChange={(e) => set({ parentId: e.target.value || null })}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="M-6-001"
        />
      </Field>
    </div>
  );
}

// ---------------------------------
// 8) SELF-TESTS (no afectan UI)
// ---------------------------------
function runSelfTests() {
  try {
    console.assert(techniqueToken([]) === "(técnica)", "techniqueToken: empty");
    console.assert(techniqueToken(["Entrevistas"]) === "(Entrevistas)", "techniqueToken: 1");
    console.assert(techniqueToken(["A", "B", "C"]) === "(mix)", "techniqueToken: 3+");
    console.assert(typeDigitFromInitiativeTypeCode("A_6.001") === "6", "typeDigit: A_6.001");
    console.assert(nextIdForType([{ id: "M-6-001" }], "A_6.001") === "M-6-002", "nextIdForType increments");

    // Filters tests
    const f = cloneFilters(DEFAULT_FILTERS);
    f.types.add("Investigación");
    console.assert(
      passesFilters(
        {
          initiativeTypeLabel: "Investigación",
          quarter: "Q1.25",
          verticalCode: "FLW",
          techniques: [],
          levelKey: "tactico",
          responsible: "K",
        },
        f
      ) === true,
      "passesFilters: type"
    );
    console.assert(
      passesFilters(
        {
          initiativeTypeLabel: "Seguimiento",
          quarter: "Q1.25",
          verticalCode: "FLW",
          techniques: [],
          levelKey: "tactico",
          responsible: "K",
        },
        f
      ) === false,
      "passesFilters: type negative"
    );

    const f2 = cloneFilters(DEFAULT_FILTERS);
    f2.techniques.add("Tracking");
    console.assert(
      passesFilters(
        {
          initiativeTypeLabel: "Seguimiento",
          quarter: "Q2.24",
          verticalCode: "FLW",
          techniques: ["Tracking"],
          levelKey: "tactico",
        },
        f2
      ) === true,
      "passesFilters: technique"
    );
  } catch {
    // noop
  }
}

// ---------------------------------
// 9) APP
// ---------------------------------
export default function App() {
  useEffect(() => {
    runSelfTests();
  }, []);

  const [productId, setProductId] = useState(PRODUCTS[0]?.id || "flow");
  const [search, setSearch] = useState("");
  const [selectedStudyId, setSelectedStudyId] = useState(null);
  const [studies, setStudies] = useState(() => loadStudies());

  function importFromCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (!rows.length) return;

      const headerCells = parseCsvLine(rows[0]).map((cell) => normalizeHeader(cell));
      const headerIndex = (keyOptions) =>
        headerCells.findIndex((cell) => keyOptions.some((k) => normalizeHeader(k) === cell));

      const required = {
        responsable: ["Responsable"],
        iniciativa: ["Iniciativa"],
        orden: ["Orden"],
        quarter: ["Q"],
        vertical: ["Vertical"],
        titulo: ["Título", "Titulo"],
        metodo: ["Método o recursos", "Metodo o recursos", "Metodo"],
        nivel: ["Nivel"],
      };

      const indexes = Object.fromEntries(
        Object.entries(required).map(([key, keys]) => [key, headerIndex(keys)])
      );

      const missing = Object.entries(indexes)
        .filter(([, idx]) => idx === -1)
        .map(([key]) => key);

      if (missing.length > 0) {
        window.alert(
          `El CSV debe incluir las columnas: Responsable, Iniciativa, Orden, Q, Vertical, Título, Método o recursos, Nivel.`
        );
        return;
      }

      const imported = rows
        .slice(1)
        .map((line) => parseCsvLine(line))
        .map((cells) => {
          const clean = (value) => String(value || "").replace(/^\uFEFF/, "").trim();
          const responsableRaw = clean(cells[indexes.responsable]);
          const iniciativaRaw = clean(cells[indexes.iniciativa]);
          const ordenRaw = clean(cells[indexes.orden]);
          const quarterRaw = clean(cells[indexes.quarter]);
          const verticalRaw = clean(cells[indexes.vertical]);
          const tituloRaw = clean(cells[indexes.titulo]);
          const metodoRaw = clean(cells[indexes.metodo]);
          const nivelRaw = clean(cells[indexes.nivel]);

          const responsible = RESPONSIBLE_CODE_SET.has(responsableRaw) ? responsableRaw : null;
          const initiativeType = initiativeTypeFromValue(iniciativaRaw);
          const orderNumber = parseInt(ordenRaw, 10);
          const correlativo = Number.isFinite(orderNumber) ? String(orderNumber).padStart(3, "0") : "000";
          const quarter = quarterRaw || null;
          const verticalCode = VERTICAL_CODE_SET.has(verticalRaw) ? verticalRaw : null;
          const { subproductName, cleanedTitle } = extractSubproductFromTitle(tituloRaw);
          const subproduct = ensureSubproduct(verticalCode, subproductName);
          const productId = productIdForVertical(verticalCode);
          const levelKey = levelKeyFromValue(nivelRaw);
          const techniques = normalizeTechniques(metodoRaw);

          if (!initiativeType || !verticalCode || !productId || !cleanedTitle) return null;

          return {
            id: `M-${initiativeType.code?.split("_")?.[1]?.split(".")?.[0] || "0"}-${correlativo}`,
            initiativeTypeCode: initiativeType.code,
            initiativeTypeLabel: initiativeType.label,
            quarter,
            verticalCode,
            titleShort: cleanedTitle,
            techniques,
            responsible,
            levelKey,
            status: "🟡 Importado",
            productId,
            subproductName: subproduct.name,
            subproductId: subproduct.id,
            parentId: null,
            type: "",
            tools: [],
            roles: { uxr: [], product: [], design: [], data: [], vendor: [] },
            insights: [],
            notes: "",
            links: [],
          };
        })
        .filter(Boolean);

      setStudies((prev) => [...prev, ...imported]);
    };
    reader.readAsText(file);
  }

  const [viewMode, setViewMode] = useState("product"); // product | global

  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftMode, setDraftMode] = useState("edit"); // edit | create

  const [filters, setFilters] = useState(() => cloneFilters(DEFAULT_FILTERS));
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    saveStudies(studies);
  }, [studies]);

  useEffect(() => {
    if (viewMode === "global" && !search.trim()) setViewMode("product");
  }, [viewMode, search]);

  const activeFiltersCount = useMemo(() => countActiveFilters(filters), [filters]);

  const graph = useMemo(() => {
    if (viewMode === "global") return buildGlobalGraph({ search, filters, studies });
    return buildProductGraph({ productId, search, filters, studies });
  }, [viewMode, productId, search, filters, studies]);

  const selectedStudy = useMemo(() => {
    if (!selectedStudyId) return null;
    return studies.find((s) => s.id === selectedStudyId) || null;
  }, [selectedStudyId, studies]);

  const nodesWithSelection = useMemo(() => {
    return graph.nodes.map((n) => {
      if (n.type === "study") {
        const isSelected = n.id === `study:${selectedStudyId}`;
        return { ...n, data: { ...n.data, isSelected } };
      }
      return n;
    });
  }, [graph.nodes, selectedStudyId]);

  const globalResults = useMemo(
    () => applySearchAndFilters(studies, search, filters).slice(0, 50),
    [studies, search, filters]
  );

  const groupedGlobal = useMemo(() => {
    const map = new Map();
    globalResults.forEach((s) => {
      const p = s.productId || "(sin producto)";
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(s);
    });
    return Array.from(map.entries()).map(([pId, arr]) => {
      const p = productMeta(pId);
      return {
        productId: pId,
        productName: p ? p.name : pId,
        color: p?.color || "#e5e7eb",
        items: arr,
      };
    });
  }, [globalResults]);

  const onNodeClick = useCallback((_, node) => {
    if (node.type === "study") setSelectedStudyId(node.data.id);
  }, []);

  const goToStudy = useCallback(
    (studyId) => {
      const s = studies.find((x) => x.id === studyId);
      if (s?.productId) setProductId(s.productId);
      setSelectedStudyId(studyId);
      if (viewMode === "global") setViewMode("product");
    },
    [studies, viewMode]
  );

  useEffect(() => {
    if (viewMode !== "product") return;
    if (!selectedStudyId) return;
    const s = studies.find((x) => x.id === selectedStudyId);
    if (!s || s.productId !== productId) setSelectedStudyId(null);
  }, [viewMode, productId, selectedStudyId, studies]);

  const openEdit = useCallback(() => {
    if (!selectedStudy) return;
    setDraftMode("edit");
    setDraft(JSON.parse(JSON.stringify(selectedStudy)));
    setEditorOpen(true);
  }, [selectedStudy]);

  const openCreate = useCallback(() => {
    const product = productMeta(productId) || PRODUCTS[0];
    const defaultType = INITIATIVE_TYPES[0];
    const newId = nextIdForType(studies, defaultType.code);
    const defaultVertical = product?.verticals?.[0] || VERTICAL_CODES[0]?.code || "";
    const subproduct = ensureSubproduct(defaultVertical, "");

    setDraftMode("create");
    setDraft({
      id: newId,
      initiativeTypeCode: defaultType.code,
      initiativeTypeLabel: defaultType.label,
      quarter: currentQuarterString(),
      verticalCode: defaultVertical,
      titleShort: "",
      techniques: [],
      levelKey: "tactico",
      responsible: "",

      productId: product.id,
      subproductName: subproduct.name,
      subproductId: subproduct.id,
      parentId: null,
      status: "🟡 En curso",
      type: "",
      tools: [],
      roles: { uxr: [], product: [], design: [], data: [], vendor: [] },
      insights: [],
      notes: "",
      links: [],
    });

    setEditorOpen(true);
  }, [productId, studies]);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setDraft(null);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) return;

    if (draftMode === "create") {
      setStudies((prev) => [draft, ...prev]);
      setSelectedStudyId(draft.id);
    } else {
      setStudies((prev) => prev.map((s) => (s.id === draft.id ? draft : s)));
    }

    setEditorOpen(false);
    setDraft(null);
  }, [draft, draftMode]);

  useEffect(() => {
    if (!draft || draftMode !== "create") return;
    const expectedPrefix = `M-${typeDigitFromInitiativeTypeCode(draft.initiativeTypeCode)}-`;
    const looksAuto = String(draft.id || "").startsWith("M-") && String(draft.id || "").includes("-");
    if (looksAuto && !String(draft.id || "").startsWith(expectedPrefix)) {
      const newId = nextIdForType(studies, draft.initiativeTypeCode);
      setDraft((d) => ({ ...d, id: newId }));
    }
  }, [draft?.initiativeTypeCode, draftMode, studies]);

  useEffect(() => {
    if (!draft) return;
    const nextProductId = draft.productId || productIdForVertical(draft.verticalCode) || PRODUCTS[0]?.id;
    const verticalOptions = verticalOptionsForProduct(nextProductId);
    const nextVerticalCode = draft.verticalCode || verticalOptions[0]?.code || "";
    const sub = ensureSubproduct(nextVerticalCode, draft.subproductName);
    setDraft((prev) => {
      if (
        prev.productId === nextProductId &&
        prev.verticalCode === nextVerticalCode &&
        prev.subproductId === sub.id &&
        prev.subproductName === (draft.subproductName || sub.name)
      ) {
        return prev;
      }
      return {
        ...prev,
        productId: nextProductId,
        verticalCode: nextVerticalCode,
        subproductId: sub.id,
        subproductName: draft.subproductName || sub.name,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.productId, draft?.verticalCode, draft?.subproductName]);

  const viewTitle = useMemo(() => {
    if (viewMode === "global") return "Resultados globales";
    const p = productMeta(productId);
    return p ? p.name : "Vista";
  }, [viewMode, productId]);

  return (
    <div className="h-screen w-full bg-zinc-50">
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        studies={studies}
        value={filters}
        onApply={(next) => setFilters(cloneFilters(next))}
      />

      <Modal
        open={editorOpen}
        title={
          draft
            ? `${draftMode === "create" ? "Nueva" : "Editar"} • ${draft.id} — ${draft.titleShort || "(sin título)"}`
            : ""
        }
        onClose={closeEditor}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-zinc-500">ESC para cerrar</div>
            <div className="flex items-center gap-2">
              <button onClick={closeEditor} className="rounded-xl border px-4 py-2 text-sm hover:bg-zinc-50">
                Cerrar
              </button>
              <button
                onClick={saveDraft}
                className="inline-flex items-center gap-2 rounded-xl border bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                <Save className="h-4 w-4" />
                Guardar
              </button>
            </div>
          </div>
        }
      >
        {draft ? <EditStudyForm value={draft} onChange={setDraft} /> : null}
      </Modal>

      <div className="mx-auto flex h-full max-w-[1500px] gap-4 p-4">
        <motion.aside
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-full w-[380px] flex-col gap-3"
        >
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-zinc-500">UXR Mejora Continua</div>
            <div className="mt-1 text-lg font-semibold text-zinc-900">Árbol de Iniciativas Viva</div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl border bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <Plus className="h-4 w-4" />
                Nueva iniciativa
              </button>
<label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50">
  Importar CSV
  <input
    type="file"
    accept=".csv"
    className="hidden"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) importFromCSV(file);
    }}
  />
</label>

              <button
                onClick={() => setViewMode((m) => (m === "global" ? "product" : "global"))}
                disabled={!search.trim()}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50 ${
                  !search.trim() ? "opacity-50" : ""
                }`}
                title={search.trim() ? "Alternar vista global/producto" : "Escribí una búsqueda para habilitar"}
              >
                <Filter className="h-4 w-4" />
                {viewMode === "global" ? "Ver producto" : "Ver grafo global"}
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-700">Buscar (global)</div>
                <button
                  onClick={() => setFilterOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs hover:bg-zinc-50"
                  title="Abrir filtros"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {activeFiltersCount > 0 ? (
                    <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] font-semibold">
                      {activeFiltersCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2 rounded-xl border bg-white px-3 py-2">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder='Ej: "encontrabilidad" o "A_6.001" o "Kau"'
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>

              <div className="mt-2 text-xs text-zinc-600">
                {viewMode === "global" ? (
                  <>
                    Grafo global mostrando <b>{graph.filteredStudies.length}</b> resultado(s)
                  </>
                ) : (
                  <>
                    En la vista actual: <b>{graph.filteredStudies.length}</b> — Global: <b>{globalResults.length}</b>
                  </>
                )}
              </div>

              {search.trim() || activeFiltersCount > 0 ? (
                <div className="mt-3 rounded-2xl border bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-700">Resultados globales</div>
                  <div className="mt-2 space-y-2">
                    {groupedGlobal.length === 0 ? (
                      <div className="text-xs text-zinc-600">Sin resultados.</div>
                    ) : (
                      groupedGlobal.map((g) => (
                        <div key={g.productId} className="rounded-xl border bg-white p-2">
                          <div className="flex items-center gap-2 px-1 pb-1">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                            <div className="text-[11px] font-semibold text-zinc-600">{g.productName}</div>
                          </div>
                          <div className="space-y-1">
                            {g.items.slice(0, 6).map((s) => (
                              <button
                                key={s.id}
                                onClick={() => goToStudy(s.id)}
                                className="w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-zinc-50"
                              >
                                <div className="text-[11px] font-semibold text-zinc-500">
                                  {s.id} • {s.quarter} • {s.verticalCode}
                                  {s.responsible ? ` • ${s.responsible}` : ""}
                                </div>
                                <div className="text-sm font-semibold text-zinc-900 line-clamp-1">{s.titleShort}</div>
                              </button>
                            ))}
                          </div>
                          {g.items.length > 6 ? (
                            <div className="px-2 pt-1 text-[11px] text-zinc-500">+{g.items.length - 6} más…</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="text-xs font-semibold text-zinc-700">Producto / Franquicia (vista)</div>
              <div className="mt-2 space-y-2">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProductId(p.id);
                      setViewMode("product");
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-zinc-50 ${
                      p.id === productId && viewMode === "product" ? "border-zinc-900" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <div className="font-semibold text-zinc-900">{p.name}</div>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-600">{p.verticals.length} verticales</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <Info className="h-4 w-4" />
              <span>Cómo usar</span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600">
              <li>
                Usá <b>Filtros</b> para Tipo/Quarter/Año/Vertical/Responsable/Técnica/Nivel.
              </li>
              <li>El buscador es global y se combina con los filtros.</li>
              <li>
                <b>Ver grafo global</b> muestra los resultados filtrados en un grafo global.
              </li>
            </ul>
          </div>
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex h-full min-w-0 flex-1 flex-col gap-3"
        >
          <div className="rounded-2xl border bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-500">Vista</div>
                <div className="text-sm font-semibold text-zinc-900">{viewTitle}</div>
              </div>
              <div className="text-xs text-zinc-600">Tip: zoom + pan • MiniMap abajo</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <ReactFlow
              nodes={nodesWithSelection}
              edges={graph.edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) => {
                  if (n.type === "product") return n.data?.color || "#111827";
                  if (n.type === "study") return n.data?.verticalColor || "#9ca3af";
                  return "#e5e7eb";
                }}
              />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </motion.main>

        <motion.aside initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-full w-[440px]">
          <DetailsPanel
            selectedStudy={selectedStudy}
            onGoToStudy={goToStudy}
            studiesInScope={graph.studiesInScope}
            onEdit={openEdit}
          />
        </motion.aside>
      </div>
    </div>
  );
}
