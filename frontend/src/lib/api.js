const API = `${(process.env.REACT_APP_BACKEND_URL || "https://tienda-profesional.preview.emergentagent.com").replace(/\/+$/, "")}/api`;
const LOCAL_PRODUCTS_URL = "/data/productos.json";

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

const normalizeProduct = (product) => ({
  sku: String(product.sku || product.id || "").trim(),
  nombre: product.nombre || product.name || "",
  categoria: product.categoria || product.category || "General",
  subcategoria: product.subcategoria || product.subcategory || "",
  marca: product.marca || product.brand || "",
  color: product.color || "",
  precio: Number(product.precio ?? product.price ?? 0) || 0,
  precio_oferta: Number(product.precio_oferta ?? 0) || 0,
  destacado: Boolean(product.destacado || false),
  stock: Number(product.stock ?? 0) || 0,
  imagen: product.imagen || product.image || "",
  imagenes: Array.isArray(product.imagenes)
    ? product.imagenes
    : product.imagen
      ? [product.imagen]
      : [],
  video_url: product.video_url || "",
  updated_at: product.updated_at || "",
});

const localStoreCache = {
  products: null,
};

const loadLocalProducts = async () => {
  if (localStoreCache.products) return localStoreCache.products;
  const response = await fetch(LOCAL_PRODUCTS_URL);
  if (!response.ok) throw new Error("No se pudo cargar el catálogo local");
  const data = await response.json();
  const products = Array.isArray(data) ? data.map(normalizeProduct) : [];
  localStoreCache.products = products;
  return products;
};

const getEffectivePrice = (product) =>
  product.precio_oferta > 0 ? product.precio_oferta : product.precio;

const sortLocalProducts = (items, sort) => {
  const products = [...items];
  switch (sort) {
    case "price_asc":
      return products.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b) || a.nombre.localeCompare(b.nombre));
    case "price_desc":
      return products.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a) || a.nombre.localeCompare(b.nombre));
    case "name_asc":
      return products.sort((a, b) => a.nombre.localeCompare(b.nombre));
    case "newest":
      return products.sort((a, b) => {
        const aTime = Date.parse(a.updated_at) || 0;
        const bTime = Date.parse(b.updated_at) || 0;
        return bTime - aTime || a.nombre.localeCompare(b.nombre);
      });
    case "offers":
      return products.sort((a, b) => b.precio_oferta - a.precio_oferta || a.nombre.localeCompare(b.nombre));
    default:
      return products.sort((a, b) => {
        if (a.destacado !== b.destacado) return b.destacado - a.destacado;
        if (a.stock !== b.stock) return b.stock - a.stock;
        return a.nombre.localeCompare(b.nombre);
      });
  }
};

const filterLocalProducts = (
  items,
  {
    categoria,
    subcategoria,
    marca,
    color,
    min_price,
    max_price,
    on_sale,
    q,
  } = {}
) => {
  const search = q?.trim().toLowerCase();
  return items.filter((item) => {
    if (categoria && categoria !== "Todos" && item.categoria !== categoria) return false;
    if (subcategoria && item.subcategoria !== subcategoria) return false;
    if (marca && item.marca !== marca) return false;
    if (color && item.color !== color) return false;
    if (on_sale && item.precio_oferta <= 0) return false;
    const price = getEffectivePrice(item);
    if (min_price !== undefined && min_price !== null && min_price !== "" && price < Number(min_price)) return false;
    if (max_price !== undefined && max_price !== null && max_price !== "" && price > Number(max_price)) return false;
    if (search) {
      const haystack = `${item.nombre} ${item.sku} ${item.marca}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
};

const buildLocalProductsResponse = async ({
  categoria,
  subcategoria,
  marca,
  color,
  min_price,
  max_price,
  on_sale,
  q,
  sort,
  skip = 0,
  limit = 48,
} = {}) => {
  const items = await loadLocalProducts();
  const filtered = filterLocalProducts(items, {
    categoria,
    subcategoria,
    marca,
    color,
    min_price,
    max_price,
    on_sale,
    q,
  });
  const sorted = sortLocalProducts(filtered, sort);
  return {
    items: sorted.slice(skip, skip + limit),
    total: filtered.length,
    skip,
    limit,
  };
};

const getLocalCategories = async () => {
  const items = await loadLocalProducts();
  const counts = items.reduce((acc, item) => {
    const key = item.categoria || "General";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    total: items.length,
    categories: Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
};

const getLocalFacets = async ({ categoria, subcategoria } = {}) => {
  const items = await loadLocalProducts();
  const base = items.filter((item) => {
    if (categoria && categoria !== "Todos" && item.categoria !== categoria) return false;
    if (subcategoria && item.subcategoria !== subcategoria) return false;
    return true;
  });
  const brands = {};
  const colors = {};
  const subcategories = {};
  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = 0;
  base.forEach((item) => {
    if (item.marca) brands[item.marca] = (brands[item.marca] || 0) + 1;
    if (item.color) colors[item.color] = (colors[item.color] || 0) + 1;
    if (item.subcategoria) subcategories[item.subcategoria] = (subcategories[item.subcategoria] || 0) + 1;
    const price = getEffectivePrice(item);
    if (price > 0) {
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    }
  });
  return {
    brands: Object.entries(brands)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    colors: Object.entries(colors)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    subcategorias: Object.entries(subcategories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    price: {
      min: minPrice === Number.POSITIVE_INFINITY ? 0 : minPrice,
      max: maxPrice === 0 ? 0 : maxPrice,
    },
  };
};

const getLocalFeatured = async (per_category = 3) => {
  const items = await loadLocalProducts();
  const categories = [
    "Marroquinería",
    "Librería",
    "Juguetería",
    "Regalería",
    "Tecno",
  ];
  const availableCategories = categories.filter((cat) => items.some((item) => item.categoria === cat));
  const fallbackCategories = availableCategories.length ? availableCategories : [...new Set(items.map((item) => item.categoria || "General"))].slice(0, 3);
  const sections = {};
  fallbackCategories.forEach((category) => {
    let sectionItems = items.filter((item) => item.categoria === category);
    if (!sectionItems.length) {
      sectionItems = items.filter((item) => item.categoria === "General");
    }
    sections[category] = sortLocalProducts(sectionItems, "relevance").slice(0, per_category);
  });
  return { sections };
};

export const fetchProducts = async ({
  categoria,
  subcategoria,
  marca,
  color,
  min_price,
  max_price,
  on_sale,
  q,
  sort,
  skip = 0,
  limit = 48,
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

  try {
    const r = await fetch(`${API}/products?${params.toString()}`);
    if (r.ok) {
      const data = await r.json();
      if (data?.items?.length > 0 || q || marca || color || min_price || max_price || on_sale) {
        return data;
      }
    }
    throw new Error("No se pudo cargar el catálogo");
  } catch (error) {
    return buildLocalProductsResponse({
      categoria,
      subcategoria,
      marca,
      color,
      min_price,
      max_price,
      on_sale,
      q,
      sort,
      skip,
      limit,
    });
  }
};

export const fetchFeatured = async () => {
  try {
    const r = await fetch(`${API}/featured`);
    if (r.ok) {
      const data = await r.json();
      if (data?.sections && Object.keys(data.sections).length > 0) {
        return data;
      }
    }
    throw new Error("No se pudo cargar destacados");
  } catch (error) {
    return getLocalFeatured();
  }
};

export const fetchFacets = async ({ categoria, subcategoria } = {}) => {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (subcategoria) params.set("subcategoria", subcategoria);
  try {
    const r = await fetch(`${API}/facets?${params}`);
    if (r.ok) {
      const data = await r.json();
      if ((data?.brands?.length || 0) > 0 || (data?.colors?.length || 0) > 0) {
        return data;
      }
    }
    throw new Error("No se pudo cargar filtros");
  } catch (error) {
    return getLocalFacets({ categoria, subcategoria });
  }
};

export const fetchStoreConfig = async () => {
  try {
    const r = await fetch(`${API}/store-config`);
    if (r.ok) {
      return r.json();
    }
    throw new Error("No se pudo cargar configuración");
  } catch (error) {
    return {
      about_text: "Un lugar pensado para conectar tus necesidades con la mejor selección de productos.",
      phone: "+54 9 3465 53-8232",
      email: "contacto@nexostore.com.ar",
      address: "Rosario, Santa Fe",
      maps_url: "",
      instagram_url: "",
      facebook_url: "",
      search_filters: [],
    };
  }
};

export const fetchKits = async () => {
  try {
    const r = await fetch(`${API}/kits`);
    if (r.ok) {
      return r.json();
    }
    throw new Error("No se pudo cargar kits");
  } catch (error) {
    return { items: [] };
  }
};

export const fetchProduct = async (sku) => {
  try {
    const r = await fetch(`${API}/products/${encodeURIComponent(sku)}`);
    if (r.ok) return r.json();
    throw new Error("Producto no encontrado");
  } catch (error) {
    const items = await loadLocalProducts();
    const product = items.find((item) => item.sku === sku);
    if (product) return product;
    throw new Error("Producto no encontrado");
  }
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error de autenticación");
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

export const adminUpdateStoreConfig = async (body) => {
  const r = await fetch(`${API}/admin/store-config`, {
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

export const adminCreateKit = async (kit) => {
  const r = await fetch(`${API}/admin/kits`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(kit),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || "Error");
  }
  return r.json();
};

export const adminUpdateKit = async (id, patch) => {
  const r = await fetch(`${API}/admin/kits/${encodeURIComponent(id)}`, {
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

export const adminDeleteKit = async (id) => {
  const r = await fetch(`${API}/admin/kits/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(true),
  });
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
