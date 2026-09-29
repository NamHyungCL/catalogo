/**
 * catalogo.js — Flowbite version. Fuente: carpetas en assets/img/ (productos.json pausado).
 * Cada subcarpeta = 1 producto. Card = archivo *Principal*. Modal = todas las fotos.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('catalogoGrid');
  if (!grid) return;

  const filtrosWrap = document.getElementById('filtrosVariedad');
  const contador = document.getElementById('contadorProductos');
  const vacio = document.getElementById('estadoVacio');
  const vacioTitle = vacio?.querySelector('.catalogo-vacio__title');
  const vacioDesc = vacio?.querySelector('.catalogo-vacio__desc');
  const buscador = document.getElementById('buscadorCatalogo');
  const btnLimpiar = document.getElementById('btnLimpiarFiltros');

  let productos = [];
  let catActiva = 'todas';
  let textoBusqueda = '';
  let errorCarga = null;
  // Anti-caché: las carpetas repiten nombres (Principal.jpg, 2.jpg...),
  // sin esto el navegador muestra fotos viejas al reemplazar archivos.
  const CB = Date.now();

  function normVariedad(v) {
    if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean).join(', ');
    return String(v || '').trim();
  }
  function variedadesDe(p) {
    return normVariedad(p.variedad).split(',').map(s => s.trim()).filter(Boolean);
  }

  // MODO CARPETAS (productos.json pausado): cada subcarpeta de assets/img/ = 1 producto.
  // Card = archivo con "principal" en el nombre. Modal = TODAS las fotos de la carpeta.
  function tituloAuto(p) {
    if (p.titulo && String(p.titulo).trim()) return String(p.titulo).trim();
    const base = String(p.imagen || (Array.isArray(p.imagenes) && p.imagenes[0]) || '').trim();
    if (!base) return 'Producto sin nombre';
    const partes = base.split('/').filter(Boolean);
    const carpeta = partes.length >= 2 ? partes[partes.length - 2] : '';
    const archivo = (partes[partes.length - 1] || '').replace(/\.[a-z0-9]+$/i, '');
    const semilla = carpeta && carpeta !== 'img' ? carpeta : archivo;
    const lindo = semilla.replace(/[-_]+/g, ' ').trim() || 'Producto';
    return 'Producto ' + lindo;
  }
  function precioAuto(p) {
    const v = String(p.precio || '').trim();
    return v || 'Consultar';
  }

  // Metadatos opcionales desde data/productos.json, clave = carpeta.
  async function cargarMetadatos() {
    try {
      const res = await fetch('./data/productos.json?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return {};
      const data = await res.json();
      const mapa = {};
      (Array.isArray(data) ? data : []).forEach(e => {
        if (e && e.carpeta) mapa[String(e.carpeta).trim()] = e;
      });
      return mapa;
    } catch { return {}; }
  }

  async function cargarProductos() {
    try {
      // 1) lista subcarpetas de assets/img/
      const res = await fetch('./assets/img/?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} listando assets/img/`);
      const html = await res.text();
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => decodeURIComponent(m[1]));
      const carpetas = hrefs.filter(h => h.endsWith('/') && h !== '../' && !h.startsWith('?') && !h.startsWith('/'));
      // 2) metadatos (nombre/precio) por carpeta — todo opcional
      const meta = await cargarMetadatos();
      // 3) por cada carpeta, lista sus imágenes
      const lista = [];
      for (const carp of carpetas) {
        const nombre = carp.replace(/\/$/, '');
        try {
          const r2 = await fetch('./assets/img/' + encodeURIComponent(nombre) + '/?v=' + CB, { cache: 'no-store' });
          if (!r2.ok) continue;
          const h2 = await r2.text();
          const files = [...h2.matchAll(/href="([^"]+)"/g)]
            .map(m => decodeURIComponent(m[1]))
            .filter(h => ES_IMG.test(h) && !h.endsWith('/'));
          if (!files.length) continue;
          files.sort((a, b) => {
            const ap = /principal/i.test(a) ? 0 : 1;
            const bp = /principal/i.test(b) ? 0 : 1;
            return ap - bp || a.localeCompare(b, 'es');
          });
          const rutas = files.map(f => `assets/img/${nombre}/${f}?v=${CB}`);
          lista.push(armarProducto(nombre, rutas, meta[nombre] || {}));
        } catch (e) { console.warn('[Catalogo] carpeta', nombre, e); }
      }
      // Fallback GitHub Pages (sin listado de carpetas): manifiesto explícito del JSON
      if (!lista.length) {
        const manif = await cargarManifiesto();
        manif.forEach(p => lista.push(p));
      }
      // Orden por número de carpeta: 1, 2, ... 10 (no alfabético 1, 10, 2)
      lista.sort((a, b) => {
        const na = parseInt(a.id, 10), nb = parseInt(b.id, 10);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return String(a.id).localeCompare(String(b.id), 'es', { numeric: true });
      });
      productos = lista;
      errorCarga = null;
    } catch (e) {
      console.warn('[Catalogo] No se pudo listar assets/img/:', e);
      productos = [];
      errorCarga = e;
    }
  }

  function armarProducto(nombre, rutas, m) {
    const titulo = (m.nombre || m.titulo || '').trim() || ('Producto ' + nombre.replace(/[-_]+/g, ' ').trim());
    return {
      id: nombre,
      carpeta: nombre,
      titulo,
      variedad: (m.variedad || '').trim(),
      categoria: categoriaDe(titulo, m.categoria),
      precio: (m.precio || '').trim() || 'Consultar',
      descripcionCorta: (m.descripcionCorta || '').trim(),
      descripcion: (m.descripcion || '').trim(),
      imagen: rutas[0],
      imagenes: rutas,
      badge: (m.badge || '').trim() || (rutas.length > 1 ? `${rutas.length} fotos` : '')
    };
  }

  // Manifiesto explícito (data/productos.json con "imagenes"): para GitHub Pages
  async function cargarManifiesto() {
    try {
      const res = await fetch('./data/productos.json?v=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return [];
      const data = await res.json();
      return (Array.isArray(data) ? data : [])
        .filter(e => e && e.carpeta && Array.isArray(e.imagenes) && e.imagenes.length)
        .map(e => armarProducto(
          String(e.carpeta).trim(),
          e.imagenes.map(s => String(s).trim()).filter(Boolean).map(s => s + `?v=${CB}`),
          e
        ));
    } catch { return []; }
  }

  // "variedad" = cantidad de variantes del producto → se muestra como "N diseños"
  function textoVariedad(v) {
    const t = String(v || '').trim();
    if (!t) return '';
    if (/^\d+$/.test(t)) return `${t} diseño${t === '1' ? '' : 's'}`;
    return t;
  }

  // Filtros por TIPO de producto: se detecta del nombre ("Funda..." → Fundas).
  // Si agregas "categoria" en el JSON, esa manda.
  const CATS = [
    ['funda', 'Fundas'], ['cojin', 'Cojines'], ['almohada', 'Almohadas'],
    ['bota', 'Botas'], ['cortina', 'Cortinas'], ['mantel', 'Manteles'],
    ['alfombra', 'Alfombras'], ['camino', 'Caminos de mesa'],
    ['frazada', 'Frazadas'], ['visillo', 'Visillos']
  ];
  function categoriaDe(titulo, forzada) {
    if (forzada && String(forzada).trim()) return String(forzada).trim();
    const t = String(titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [k, label] of CATS) if (t.includes(k)) return label;
    return '';
  }

  // Principal = "imagen" (card). Modal = todas las fotos de la carpeta + "imagenes" si existe.
  function listaImagenes(p) {
    const arr = Array.isArray(p.imagenes) ? p.imagenes.map(s => String(s).trim()).filter(Boolean) : [];
    const principal = String(p.imagen || '').trim();
    if (principal && !arr.includes(principal)) arr.unshift(principal);
    return arr;
  }
  function carpetaDe(path) {
    const i = String(path || '').lastIndexOf('/');
    return i > 0 ? path.slice(0, i + 1) : '';
  }
  const ES_IMG = /\.(jpe?g|jfif|png|webp|gif|avif)(\?.*)?$/i;
  // Lee el listado del servidor (python http.server / Live Server) y devuelve todas las imágenes de la carpeta
  async function imagenesDeCarpeta(principal) {
    const carpeta = carpetaDe(principal);
    if (!carpeta) return [];
    try {
      const res = await fetch('./' + carpeta + '?v=' + CB, { cache: 'no-store' });
      if (!res.ok) return [];
      const html = await res.text();
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
      const imgs = hrefs
        .filter(h => ES_IMG.test(h) && !h.includes('?'))
        .map(h => (h.startsWith('http') || h.startsWith('/') ? h : carpeta + h))
        .map(s => s.replace('./', '') + `?v=${CB}`);
      // principal primero, sin duplicados
      const uniq = [];
      if (principal) uniq.push(principal);
      imgs.forEach(s => { if (!uniq.includes(s)) uniq.push(s); });
      return uniq;
    } catch { return []; }
  }

  // Card Flowbite: imagen principal 4/5
  function crearCard(p) {
    const art = document.createElement('article');
    art.className = 'catalogo-card group flex flex-col overflow-hidden rounded-2xl bg-[#1C1C1E] border border-[#2E2E30] hover:border-gray-500 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-pointer';
    const varStr = normVariedad(p.variedad);
    const titulo = tituloAuto(p);
    const precio = precioAuto(p);
    const imgs = listaImagenes(p);
    const principal = imgs[0] || '';
    art.dataset.variedad = varStr;
    art.dataset.categoria = p.categoria || '';
    art.dataset.search = `${titulo} ${varStr} ${p.categoria || ''} ${p.descripcionCorta || ''} ${p.descripcion || ''}`.toLowerCase();
    art.dataset.title = titulo;
    art.dataset.precio = precio;
    art.dataset.img = principal;
    art.dataset.imagenes = JSON.stringify(imgs);
    art.dataset.desc = p.descripcion || '';
    art.dataset.descCorta = p.descripcionCorta || '';

    const hasImg = !!principal;
    const badge = p.badge ? `<span class="absolute top-3 left-3 bg-[#1A1A1E]/90 text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#2E2E30] text-gray-200">${p.badge}</span>` : '';
    const variBadge = textoVariedad(varStr);
    const variHtml = variBadge ? `<span class="w-fit text-[9px] font-bold tracking-widest uppercase text-[#D9A441] bg-[#C1272D]/10 border border-[#C1272D]/20 px-2 py-0.5 rounded-full truncate max-w-full">${variBadge}</span>` : '';
    const media = hasImg
      ? `<img src="${principal}" alt="${titulo}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="display:none" class="w-full h-full items-center justify-center text-4xl text-[#333]">◧</div>`
      : `<div class="w-full h-full flex items-center justify-center text-4xl text-[#333]">◧</div>`;

    art.innerHTML = `
      <div class="relative overflow-hidden aspect-[4/5] bg-[#1A1A1E]">
        ${media}
        ${badge}
      </div>
      <div class="p-3 flex flex-col gap-1.5 flex-1">
        ${variHtml}
        <h5 class="text-sm font-bold text-white truncate">${titulo}</h5>
        <p class="text-[11px] text-gray-400 truncate">${p.descripcionCorta || p.descripcion || ''}</p>
        <div class="flex items-center justify-between border-t border-[#2E2E30] pt-2 mt-auto">
          <span class="text-sm font-extrabold text-white">${precio}</span>
          <button type="button" class="text-xs font-bold text-[#D9A441] hover:text-white bg-[#C1272D]/10 hover:bg-[#C1272D] px-3 py-1.5 rounded-full border border-[#C1272D]/20 transition">Ver detalle</button>
        </div>
      </div>`;
    return art;
  }

  function renderGrid() {
    [...grid.querySelectorAll('.catalogo-card')].forEach(n => n.remove());
    if (productos.length === 0) return;
    const frag = document.createDocumentFragment();
    productos.forEach(p => frag.appendChild(crearCard(p)));
    grid.insertBefore(frag, vacio);
  }

  function getVariedades() {
    const set = new Set();
    productos.forEach(p => variedadesDe(p).forEach(v => set.add(v)));
    return [...set].sort((a, b) => {
      const na = parseInt(a, 10), nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b), 'es');
    });
  }
  function getCategorias() {
    const set = new Set();
    productos.forEach(p => { if (p.categoria) set.add(p.categoria); });
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }

  const FILTRO_BASE = 'catalogo-filtro inline-flex items-center px-4 py-2 text-sm font-medium rounded-full border transition';
  const FILTRO_OFF = 'bg-[#1A1A1E] border-[#2E2E30] text-gray-300 hover:border-gray-500 hover:text-white';
  const FILTRO_ON = 'catalogo-filtro--activo bg-[#C1272D] border-[#C1272D] text-white font-bold';

  function renderFiltros() {
    const categorias = getCategorias();
    if (!filtrosWrap) return;
    const conteo = { todas: productos.length };
    categorias.forEach(v => { conteo[v] = productos.filter(p => p.categoria === v).length; });

    const crearBtn = (valor, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.filtro = valor;
      const activo = valor === catActiva;
      btn.className = `${FILTRO_BASE} ${activo ? FILTRO_ON : FILTRO_OFF}`;
      const countCls = activo
        ? 'ml-2 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center bg-black/40 text-white'
        : 'ml-2 text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center bg-white/10';
      btn.innerHTML = `${label} <span class="${countCls}">${conteo[valor] ?? 0}</span>`;
      btn.addEventListener('click', () => { catActiva = valor; renderFiltros(); filtrar(); });
      return btn;
    };

    filtrosWrap.innerHTML = '';
    filtrosWrap.appendChild(crearBtn('todas', 'Todas'));

    if (productos.length === 0) {
      const span = document.createElement('span');
      span.className = 'text-sm text-gray-500';
      span.textContent = 'Sin fotos — crea una carpeta en assets/img/ y pon las fotos adentro.';
      filtrosWrap.appendChild(span);
      return;
    }
    // Filtros por tipo de producto (Fundas, Botas...). Sin categorías: solo "Todas".
    categorias.forEach(v => filtrosWrap.appendChild(crearBtn(v, v)));
  }

  function filtrar() {
    const cards = [...grid.querySelectorAll('.catalogo-card')];
    if (productos.length === 0) {
      if (contador) contador.textContent = '0 productos';
      if (vacio) {
        vacio.classList.remove('hidden');
        if (errorCarga) {
          if (vacioTitle) vacioTitle.textContent = 'No se pudo cargar el catálogo';
          if (vacioDesc) vacioDesc.innerHTML = location.protocol === 'file:'
            ? 'Lo abriste con doble click (file://). Abrí <b>http://localhost:8000/index.html</b> o usa Live Server.'
            : `Error: ${errorCarga.message}`;
        } else {
          if (vacioTitle) vacioTitle.textContent = 'Sin fotos';
          if (vacioDesc) vacioDesc.textContent = 'Crea una carpeta en assets/img/ (ej: assets/img/2/) y pon las fotos adentro. La card usa la Principal y el modal muestra todas.';
        }
      }
      return;
    }
    let visibles = 0;
    const q = textoBusqueda.toLowerCase().trim();
    cards.forEach(card => {
      const okV = catActiva === 'todas' || (card.dataset.categoria || '') === catActiva;
      const okT = !q || (card.dataset.search || '').includes(q);
      const mostrar = okV && okT;
      card.classList.toggle('hidden', !mostrar);
      if (mostrar) visibles++;
    });
    if (contador) contador.textContent = `${visibles} producto${visibles !== 1 ? 's' : ''}`;
    if (vacio) vacio.classList.toggle('hidden', visibles !== 0);
  }

  // Modal
  const modal = document.getElementById('catalogoModal');
  const modalImg = document.getElementById('modalImg');
  const modalPlaceholder = document.getElementById('modalPlaceholder');
  const modalTitle = document.getElementById('modalTitle');
  const modalVariedad = document.getElementById('modalVariedad');
  const modalDesc = document.getElementById('modalDesc');
  const modalPrecio = document.getElementById('modalPrecio');
  const modalMeta = document.getElementById('modalMeta');
  const modalBadge = document.getElementById('modalBadge');

  const modalThumbs = document.getElementById('modalThumbs');

  function setModalMain(src, titulo) {
    if (src) {
      modalImg.src = src; modalImg.alt = titulo;
      modalImg.classList.remove('hidden'); modalPlaceholder.classList.add('hidden');
      modalImg.onerror = () => { modalImg.classList.add('hidden'); modalPlaceholder.classList.remove('hidden'); };
    } else {
      modalImg.classList.add('hidden'); modalPlaceholder.classList.remove('hidden');
    }
    // marca thumb activa
    modalThumbs?.querySelectorAll('button').forEach(b => {
      const on = b.dataset.src === src;
      b.className = on
        ? 'shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-[#C1272D] shadow-[0_0_10px_rgba(193,39,45,0.4)]'
        : 'shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[#2E2E30] opacity-70 hover:opacity-100 transition';
    });
  }

  function pintarThumbs(imgs, titulo) {
    if (!modalThumbs) return;
    modalThumbs.innerHTML = '';
    if (imgs.length <= 1) {
      modalThumbs.style.display = 'none';
      return;
    }
    modalThumbs.style.display = '';
    imgs.forEach((src, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.src = src;
      b.title = `Foto ${i + 1}`;
      b.className = 'shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[#2E2E30] opacity-70 hover:opacity-100 transition';
      b.innerHTML = `<img src="${src}" alt="Foto ${i + 1}" loading="lazy" class="w-full h-full object-cover" onerror="this.parentElement.style.display='none'">`;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); setModalMain(src, titulo); });
      modalThumbs.appendChild(b);
    });
    setModalMain(imgs[0] || '', titulo);
  }

  async function abrirModal(card) {
    if (!modal || !card) return;
    const titulo = card.dataset.title || 'Producto';
    const variedad = card.dataset.variedad || '';
    modalTitle.textContent = titulo;
    modalVariedad.textContent = textoVariedad(variedad) || 'Diseños a consultar';
    modalDesc.textContent = card.dataset.desc || card.dataset.descCorta || 'Sin descripción.';
    modalPrecio.textContent = card.dataset.precio || '$ —';
    const badgeText = card.querySelector('.absolute.top-3')?.textContent.trim() || '';
    if (badgeText) { modalBadge.textContent = badgeText; modalBadge.classList.remove('hidden'); }
    else modalBadge.classList.add('hidden');

    // 1) Principal al instante (card) + lista base del JSON
    let base = [];
    try { base = JSON.parse(card.dataset.imagenes || '[]'); } catch { base = []; }
    const principal = card.dataset.img || base[0] || card.querySelector('img')?.getAttribute('src') || '';
    if (principal && !base.includes(principal)) base.unshift(principal);
    if (!base.length && principal) base = [principal];
    modalMeta.textContent = base.length > 1 ? `${base.length} fotos` : (variedad ? `${variedad.split(',').length} variedad(es)` : '');
    pintarThumbs(base, titulo);
    setModalMain(base[0] || '', titulo);

    // 2) Completa con TODAS las fotos de la carpeta (cualquier nombre), sin tocar el JSON
    if (principal) {
      const completas = await imagenesDeCarpeta(principal);
      if (completas.length > base.length) {
        try { card.dataset.imagenes = JSON.stringify(completas); } catch {}
        modalMeta.textContent = `${completas.length} fotos`;
        pintarThumbs(completas, titulo);
      }
    }
    modal.classList.remove('hidden'); modal.classList.add('flex', 'catalogo-modal--open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function cerrarModal() {
    if (!modal) return;
    modal.classList.add('hidden'); modal.classList.remove('flex', 'catalogo-modal--open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.catalogo-card');
    if (!card || card.classList.contains('hidden')) return;
    abrirModal(card);
  });
  modal?.addEventListener('click', (e) => { if (e.target.dataset.cerrar === 'modal') cerrarModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) cerrarModal();
  });

  buscador?.addEventListener('input', (e) => { textoBusqueda = e.target.value; filtrar(); });
  btnLimpiar?.addEventListener('click', () => {
    catActiva = 'todas'; textoBusqueda = '';
    if (buscador) buscador.value = '';
    renderFiltros(); filtrar();
  });

  window.Catalogo = {
    get productos() { return productos; },
    recargar: async () => { await cargarProductos(); renderGrid(); renderFiltros(); filtrar(); },
    getVariedades, getCategorias, abrirModal, cerrarModal
  };

  await cargarProductos();
  renderGrid();
  renderFiltros();
  filtrar();
});
