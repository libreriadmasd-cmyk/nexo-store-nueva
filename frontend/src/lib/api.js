const API = `${(process.env.REACT_APP_BACKEND_URL || "https://tienda-profesional.preview.emergentagent.com").replace(/\/+$/, "")}/api`;

const TOKEN_KEY = "nexo_admin_token";

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY) || "";
export const setAdminToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(TOKEN_KEY);

const headers = (admin = false) => {
  const h = { "Content-Type": "application/json" };
  if (admin) {
    const t = getAdminToken();
    if (t) h["X-Admin-Token"] = t;
  }
  return h;
};

// ---------------- Public ----------------
export const fetchProducts = async ({
  categoria, subcategoria, marca, color, min_price, max_price, on_sale,
  q, sort, skip = 0, limit = 48,
} = {}) => {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (subcategoria) params.set("subcategoria", subcategoria);
  if (marca) params.set("marca", marca);
  if (color) params.set("color", color);
  if (min_price !== undefined && min_price !== null && min_price !== "") params.set("min_price", String(min_price));
  if (max_price !== undefined && max_price !== null && max_price !== "") params.set("max_price", String(max_price));
  if (on_sale) params.set("on_sale", "true");
  if (q) params.set("q", q);
  if (sort) params.set("sort", sort);
  params.set("skip", String(skip));
  params.set("limit", String(limit));
  const r = await fetch(`${API}/products?${params.toString()}`);
  if (!r.ok) throw new Error("No se pudo cargar el catálogo");
  return r.json();
};

export const fetchFeatured = async () => {
  const r = await fetch(`${API}/featured`);
  if (!r.ok) throw new Error("No se pudo cargar destacados");
  return r.json();
};

export const fetchFacets = async ({ categoria, subcategoria } = {}) => {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (subcategoria) params.set("subcategoria", subcategoria);
  const r = await fetch(`${API}/facets?${params}`);
  if (!r.ok) throw new Error("No se pudo cargar filtros");
  return r.json();
};

export const fetchStoreConfig = async () => {
  const r = await fetch(`${API}/store-config`);
  if (!r.ok) throw new Error("No se pudo cargar configuración");
  return r.json();
};

export const fetchKits = async () => {
  const r = await fetch(`${API}/kits`);
  if (!r.ok) throw new Error("No se pudo cargar kits");
  return r.json();
};

export const adminCreateKit = async (kit) => {
  const r = await fetch(`${API}/admin/kits`, {
    method: "POST", headers: headers(true), body: JSON.stringify(kit),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminUpdateKit = async (id, patch) => {
  const r = await fetch(`${API}/admin/kits/${id}`, {
    method: "PUT", headers: headers(true), body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminDeleteKit = async (id) => {
  const r = await fetch(`${API}/admin/kits/${id}`, {
    method: "DELETE", headers: headers(true),
  });
  if (!r.ok) throw new Error("Error");
  return r.json();
};

export const adminUpdateStoreConfig = async (patch) => {
  const r = await fetch(`${API}/admin/store-config`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminExtractAttributes = async () => {
  const r = await fetch(`${API}/admin/extract-attributes`, {
    method: "POST",
    headers: headers(true),
  });
  if (!r.ok) throw new Error("Error");
  return r.json();
};

export const fetchProduct = async (sku) => {
  const r = await fetch(`${API}/products/${encodeURIComponent(sku)}`);
  if (!r.ok) throw new Error("Producto no encontrado");
  return r.json();
};

export const fetchCategories = async () => {
  const r = await fetch(`${API}/categories`);
  if (!r.ok) throw new Error("No se pudo cargar las categorías");
  return r.json();
};

// ---------------- Admin ----------------
export const adminLogin = async (password) => {
  const r = await fetch(`${API}/admin/login`, {
    method: "POST",
    headers: headers(false),
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Contraseña incorrecta");
  }
  const data = await r.json();
  setAdminToken(data.token);
  return data.token;
};

export const adminVerify = async () => {
  const r = await fetch(`${API}/admin/verify`, {
    method: "POST",
    headers: headers(true),
  });
  return r.ok;
};

export const adminStats = async () => {
  const r = await fetch(`${API}/admin/stats`, { headers: headers(true) });
  if (!r.ok) throw new Error("Sin acceso");
  return r.json();
};

export const adminUploadCSV = async (file, mode = "upsert") => {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API}/admin/csv-upload?mode=${mode}`, {
    method: "POST",
    headers: { "X-Admin-Token": getAdminToken() },
    body: fd,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error al subir CSV");
  }
  return r.json();
};

export const adminUpdateProduct = async (sku, patch) => {
  const r = await fetch(`${API}/admin/products/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: headers(true),
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminCreateProduct = async (product) => {
  const r = await fetch(`${API}/admin/products`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(product),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminDeleteProduct = async (sku) => {
  const r = await fetch(`${API}/admin/products/${encodeURIComponent(sku)}`, {
    method: "DELETE",
    headers: { "X-Admin-Token": getAdminToken() },
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminImageTemplate = async ({ prefix, suffix, apply, sampleSize = 5 }) => {
  const r = await fetch(`${API}/admin/image-template`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ prefix, suffix, apply, sample_size: sampleSize }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminReclassify = async ({ scope, apply }) => {
  const r = await fetch(`${API}/admin/reclassify`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ scope, apply }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminCleanTitles = async () => {
  const r = await fetch(`${API}/admin/clean-titles`, {
    method: "POST",
    headers: headers(true),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminAddImage = async (sku, url, index = null) => {
  const body = { url };
  if (index !== null) body.index = index;
  const r = await fetch(`${API}/admin/products/${encodeURIComponent(sku)}/images`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminRemoveImage = async (sku, index) => {
  const r = await fetch(
    `${API}/admin/products/${encodeURIComponent(sku)}/images/${index}`,
    { method: "DELETE", headers: { "X-Admin-Token": getAdminToken() } }
  );
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const searchSuggest = async (q, limit = 6) => {
  if (!q || !q.trim()) return { items: [] };
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const r = await fetch(`${API}/search/suggest?${params}`);
  if (!r.ok) return { items: [] };
  return r.json();
};
