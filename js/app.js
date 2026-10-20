/* =========================================================
   Veta — Configurador de mesas
   Lee el formulario, dibuja el plano en SVG y calcula el precio.
   ========================================================= */

// ---------- Datos del catálogo ----------

const MADERAS = {
  pino:     { nombre: "Pino",     color: "#DDB984", precioM2: 180, semanas: [3, 4] },
  petiribi: { nombre: "Petiribí", color: "#A86F45", precioM2: 320, semanas: [4, 5] },
  roble:    { nombre: "Roble",    color: "#C39762", precioM2: 380, semanas: [5, 6] },
  nogal:    { nombre: "Nogal",    color: "#5E3B28", precioM2: 520, semanas: [6, 7] },
};

const TERMINACIONES = {
  natural:  { nombre: "Natural",  recargo: 0,    brillo: 0 },
  satinado: { nombre: "Satinado", recargo: 0.08, brillo: 0.35 },
  laqueado: { nombre: "Laqueado", recargo: 0.15, brillo: 0.8 },
};

const PATAS = {
  rectas:  { nombre: "Rectas",  precio: 60 },
  conicas: { nombre: "Cónicas", precio: 90 },
  hierro:  { nombre: "Hierro",  precio: 140 },
};

const MANO_DE_OBRA = 150;     // USD fijos por mesa
const CM_POR_PERSONA = 60;    // espacio por persona en cada lado largo

// ---------- Geometría del plano (en px del viewBox) ----------

const ESCALA = 2.2;           // 1 cm = 2.2 px
const CX = 380;               // centro horizontal
const TOPE_Y = 60;            // altura de la tapa en vista frontal
const PISO_Y = 225;           // piso (75 cm de alto: 75 × 2.2 = 165)
const ESPESOR = 9;            // tapa de 4 cm
const CENTRO_SUP_Y = 430;     // centro de la vista superior
const RETIRO = 13;            // patas a 6 cm del borde
const PATA_W = 13;            // patas de 6 cm

// ---------- Elementos del DOM ----------

const form = document.getElementById("form-config");
const svg = {
  frontal: document.getElementById("frontal"),
  cotasFrontal: document.getElementById("cotas-frontal"),
  superior: document.getElementById("superior"),
  sillas: document.getElementById("sillas"),
  cotasSuperior: document.getElementById("cotas-superior"),
};
const ui = {
  largo: document.getElementById("largo-valor"),
  ancho: document.getElementById("ancho-valor"),
  precio: document.getElementById("precio"),
  detalle: document.getElementById("detalle"),
  entrega: document.getElementById("entrega"),
  resumen: document.getElementById("resumen-texto"),
  personas: document.getElementById("personas"),
  whatsapp: document.getElementById("btn-whatsapp"),
};

const sinAnimacion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Valores que se ven en pantalla (se acercan suavemente al objetivo)
const visible = { largo: 180, ancho: 90, rgb: hexARgb("#A86F45"), brillo: 0, precio: 0 };

// ---------- Utilidades ----------

function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbATexto([r, g, b], factor = 1) {
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function el(tag, attrs = {}, texto) {
  const nodo = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) nodo.setAttribute(k, v);
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

const usd = (n) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

// ---------- Estado a partir del formulario ----------

function leerEstado() {
  const datos = new FormData(form);
  return {
    madera: datos.get("madera"),
    terminacion: datos.get("terminacion"),
    patas: datos.get("patas"),
    largo: Number(datos.get("largo")),
    ancho: Number(datos.get("ancho")),
  };
}

// Ejemplo con la mesa por defecto (Petiribí 180 × 90, natural, patas rectas):
//   superficie = 1.8 × 0.9 = 1.62 m²
//   tapa       = 1.62 × 320 = 518.4
//   terminación= 518.4 × 0 = 0
//   total      = 518.4 + 0 + 60 + 150 = 728.4 → redondeado a 730
function calcularPrecio(e) {
  const madera = MADERAS[e.madera];
  const term = TERMINACIONES[e.terminacion];
  const m2 = (e.largo / 100) * (e.ancho / 100);
  const tapa = m2 * madera.precioM2;
  const terminacion = tapa * term.recargo;
  const patas = PATAS[e.patas].precio;
  const total = Math.round((tapa + terminacion + patas + MANO_DE_OBRA) / 10) * 10;
  return { m2, tapa, terminacion, patas, total };
}

// Personas: 60 cm por persona en cada lado largo, y una en cada cabecera si el ancho llega a 100 cm.
//   180 cm → 3 por lado = 6 · ancho 90 → sin cabeceras · total 6
function calcularPersonas(largo, ancho) {
  const porLado = Math.floor(largo / CM_POR_PERSONA);
  const cabeceras = ancho >= 100 ? 2 : 0;
  return { porLado, cabeceras, total: porLado * 2 + cabeceras };
}

// ---------- Dibujo ----------

function dibujar(e) {
  const L = visible.largo * ESCALA;
  const A = visible.ancho * ESCALA;
  const x0 = CX - L / 2;
  const x1 = CX + L / 2;
  const colorMadera = rgbATexto(visible.rgb);
  const colorSombra = rgbATexto(visible.rgb, 0.78);

  Object.values(svg).forEach((g) => g.replaceChildren());

  // ----- Vista frontal -----
  const f = svg.frontal;
  const patasY = TOPE_Y + ESPESOR;
  const altoPata = PISO_Y - patasY;

  // Sombra en el piso
  f.append(el("ellipse", { cx: CX, cy: PISO_Y + 2, rx: L / 2 + 10, ry: 5, fill: "rgba(0,0,0,.35)" }));

  [x0 + RETIRO, x1 - RETIRO - PATA_W].forEach((px) => {
    if (e.patas === "rectas") {
      f.append(el("rect", { x: px, y: patasY, width: PATA_W, height: altoPata, fill: colorSombra }));
    } else if (e.patas === "conicas") {
      const c = px + PATA_W / 2;
      f.append(el("path", {
        d: `M${c - 8} ${patasY} H${c + 8} L${c + 3} ${PISO_Y} H${c - 3} Z`,
        fill: colorSombra,
      }));
    } else {
      const c = px + PATA_W / 2;
      f.append(el("rect", { x: c - 2.5, y: patasY, width: 5, height: altoPata - 3, class: "pata-hierro" }));
      f.append(el("rect", { x: c - 12, y: PISO_Y - 4, width: 24, height: 4, class: "pata-hierro" }));
    }
  });

  // Faldón (madera) o bastidor (hierro) bajo la tapa
  if (e.patas === "hierro") {
    f.append(el("rect", { x: x0 + RETIRO, y: patasY, width: L - RETIRO * 2, height: 4, class: "pata-hierro" }));
  } else {
    f.append(el("rect", { x: x0 + RETIRO, y: patasY, width: L - RETIRO * 2, height: 16, fill: colorSombra }));
  }

  // Tapa
  f.append(el("rect", { x: x0, y: TOPE_Y, width: L, height: ESPESOR, rx: 1.5, fill: colorMadera }));
  f.append(el("rect", { x: x0, y: TOPE_Y, width: L, height: ESPESOR, rx: 1.5, fill: "url(#veta)" }));
  f.append(el("rect", { x: x0, y: TOPE_Y, width: L, height: 2, fill: "#fff", opacity: 0.15 + visible.brillo * 0.4 }));

  // Cotas frontales: largo arriba, alto a la derecha
  cotaHorizontal(svg.cotasFrontal, x0, x1, TOPE_Y - 22, `${e.largo} cm`, TOPE_Y - 4);
  cotaVertical(svg.cotasFrontal, x1 + 30, TOPE_Y, PISO_Y, "75 cm", x1 + 6);

  // ----- Vista superior -----
  const yTop = CENTRO_SUP_Y - A / 2;
  const yBot = CENTRO_SUP_Y + A / 2;
  const personas = calcularPersonas(e.largo, e.ancho);

  // Sillas (dibujadas antes, la tapa las tapa en parte)
  const paso = L / personas.porLado;
  for (let i = 0; i < personas.porLado; i++) {
    const cx = x0 + paso * (i + 0.5);
    svg.sillas.append(el("rect", { x: cx - 23, y: yTop - 30, width: 46, height: 38, rx: 6 }));
    svg.sillas.append(el("rect", { x: cx - 23, y: yBot - 8, width: 46, height: 38, rx: 6 }));
  }
  if (personas.cabeceras) {
    svg.sillas.append(el("rect", { x: x0 - 30, y: CENTRO_SUP_Y - 23, width: 38, height: 46, rx: 6 }));
    svg.sillas.append(el("rect", { x: x1 - 8, y: CENTRO_SUP_Y - 23, width: 38, height: 46, rx: 6 }));
  }

  const s = svg.superior;
  s.append(el("rect", { x: x0 + 4, y: yTop + 6, width: L, height: A, rx: 3, fill: "rgba(0,0,0,.3)" }));
  s.append(el("rect", { x: x0, y: yTop, width: L, height: A, rx: 3, fill: colorMadera }));
  s.append(el("rect", { x: x0, y: yTop, width: L, height: A, rx: 3, fill: "url(#veta)" }));
  s.append(el("rect", { x: x0, y: yTop, width: L, height: A, rx: 3, fill: "url(#brillo)", opacity: visible.brillo }));

  // Patas ocultas bajo la tapa (línea de trazos, como en un plano)
  if (e.patas === "hierro") {
    [x0 + RETIRO + 4, x1 - RETIRO - 9].forEach((px) => {
      s.append(el("rect", { x: px, y: yTop + RETIRO, width: 5, height: A - RETIRO * 2, class: "oculta" }));
    });
  } else {
    [[x0 + RETIRO, yTop + RETIRO], [x1 - RETIRO - PATA_W, yTop + RETIRO],
     [x0 + RETIRO, yBot - RETIRO - PATA_W], [x1 - RETIRO - PATA_W, yBot - RETIRO - PATA_W]]
      .forEach(([px, py]) => {
        const attrs = e.patas === "conicas"
          ? { cx: px + PATA_W / 2, cy: py + PATA_W / 2, r: PATA_W / 2, class: "oculta" }
          : { x: px, y: py, width: PATA_W, height: PATA_W, class: "oculta" };
        s.append(el(e.patas === "conicas" ? "circle" : "rect", attrs));
      });
  }

  // Cota del ancho, a la derecha (más afuera si hay silla en la cabecera)
  const xCota = x1 + (personas.cabeceras ? 48 : 26);
  cotaVertical(svg.cotasSuperior, xCota, yTop, yBot, `${e.ancho} cm`, x1 + 4);
}

function cotaHorizontal(g, xa, xb, y, texto, desdeY) {
  g.append(el("line", { x1: xa, y1: desdeY, x2: xa, y2: y - 6, class: "guia" }));
  g.append(el("line", { x1: xb, y1: desdeY, x2: xb, y2: y - 6, class: "guia" }));
  g.append(el("line", { x1: xa, y1: y, x2: xb, y2: y, "marker-start": "url(#flecha)", "marker-end": "url(#flecha)" }));
  const mx = (xa + xb) / 2;
  g.append(el("rect", { x: mx - 34, y: y - 11, width: 68, height: 22, class: "fondo-texto" }));
  g.append(el("text", { x: mx, y: y + 5 }, texto));
}

function cotaVertical(g, x, ya, yb, texto, desdeX) {
  g.append(el("line", { x1: desdeX, y1: ya, x2: x + 6, y2: ya, class: "guia" }));
  g.append(el("line", { x1: desdeX, y1: yb, x2: x + 6, y2: yb, class: "guia" }));
  g.append(el("line", { x1: x, y1: ya, x2: x, y2: yb, "marker-start": "url(#flecha)", "marker-end": "url(#flecha)" }));
  const my = (ya + yb) / 2;
  g.append(el("rect", { x: x - 11, y: my - 32, width: 22, height: 64, class: "fondo-texto" }));
  g.append(el("text", { x, y: my + 5, transform: `rotate(-90 ${x} ${my})` }, texto));
}

// ---------- Textos, precio y WhatsApp ----------

function actualizarTextos(e, p) {
  const madera = MADERAS[e.madera];
  const term = TERMINACIONES[e.terminacion];
  const patas = PATAS[e.patas];
  const personas = calcularPersonas(e.largo, e.ancho);

  ui.largo.textContent = e.largo;
  ui.ancho.textContent = e.ancho;
  ui.resumen.textContent = `${madera.nombre}, terminación ${term.nombre.toLowerCase()}, patas ${patas.nombre.toLowerCase()}`;
  ui.personas.textContent = `Entran ${personas.total} personas`;

  const extra = e.terminacion === "laqueado" ? 1 : 0;
  ui.entrega.textContent = `Entrega en ${madera.semanas[0] + extra} a ${madera.semanas[1] + extra} semanas`;

  const m2 = p.m2.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  const filas = [
    [`Tapa de ${madera.nombre.toLowerCase()} (${m2} m² × USD ${madera.precioM2})`, p.tapa],
    [`Terminación ${term.nombre.toLowerCase()} (+${Math.round(term.recargo * 100)} %)`, p.terminacion],
    [`Patas ${patas.nombre.toLowerCase()}`, p.patas],
    ["Mano de obra", MANO_DE_OBRA],
  ];
  ui.detalle.replaceChildren();
  filas.forEach(([concepto, valor]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = concepto;
    dd.textContent = `USD ${usd(valor)}`;
    ui.detalle.append(dt, dd);
  });
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = "Total (redondeado)";
  dd.textContent = `USD ${usd(p.total)}`;
  dt.className = dd.className = "total";
  ui.detalle.append(dt, dd);

  const mensaje = [
    "Hola Veta, quiero pedir esta mesa:",
    `• Madera: ${madera.nombre}`,
    `• Medidas: ${e.largo} × ${e.ancho} cm`,
    `• Terminación: ${term.nombre}`,
    `• Patas: ${patas.nombre}`,
    `• Precio estimado: USD ${usd(p.total)}`,
    "",
    `Mi diseño: ${location.href}`,
  ].join("\n");
  ui.whatsapp.href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

// ---------- Link compartible (?madera=nogal&largo=200...) ----------

function guardarEnUrl(e) {
  const params = new URLSearchParams(e);
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function cargarDesdeUrl() {
  const params = new URLSearchParams(location.search);
  for (const [nombre, valor] of params) {
    const campo = form.elements[nombre];
    if (!campo) continue;
    if (campo instanceof RadioNodeList) {
      const opcion = [...campo].find((r) => r.value === valor);
      if (opcion) opcion.checked = true;
    } else if (campo.type === "range") {
      const n = Number(valor);
      if (n >= Number(campo.min) && n <= Number(campo.max)) campo.value = n;
    }
  }
}

// ---------- Animación ----------

let objetivo = null;
let animando = false;

function paso() {
  const e = objetivo;
  const meta = {
    largo: e.largo,
    ancho: e.ancho,
    rgb: hexARgb(MADERAS[e.madera].color),
    brillo: TERMINACIONES[e.terminacion].brillo,
    precio: calcularPrecio(e).total,
  };
  const k = sinAnimacion ? 1 : 0.18;

  visible.largo += (meta.largo - visible.largo) * k;
  visible.ancho += (meta.ancho - visible.ancho) * k;
  visible.brillo += (meta.brillo - visible.brillo) * k;
  visible.precio += (meta.precio - visible.precio) * k;
  visible.rgb = visible.rgb.map((c, i) => c + (meta.rgb[i] - c) * k);

  dibujar(e);
  ui.precio.textContent = usd(Math.round(visible.precio));

  const quieto =
    Math.abs(meta.largo - visible.largo) < 0.2 &&
    Math.abs(meta.ancho - visible.ancho) < 0.2 &&
    Math.abs(meta.precio - visible.precio) < 0.5 &&
    Math.abs(meta.brillo - visible.brillo) < 0.01 &&
    visible.rgb.every((c, i) => Math.abs(c - meta.rgb[i]) < 0.5);

  if (quieto) {
    Object.assign(visible, meta);
    dibujar(e);
    ui.precio.textContent = usd(meta.precio);
    animando = false;
  } else {
    requestAnimationFrame(paso);
  }
}

function actualizar() {
  objetivo = leerEstado();
  actualizarTextos(objetivo, calcularPrecio(objetivo));
  guardarEnUrl(objetivo);
  if (!animando) {
    animando = true;
    requestAnimationFrame(paso);
  }
}

// ---------- Inicio ----------

cargarDesdeUrl();
{
  const inicial = leerEstado();
  visible.largo = inicial.largo;
  visible.ancho = inicial.ancho;
  visible.rgb = hexARgb(MADERAS[inicial.madera].color);
  visible.brillo = TERMINACIONES[inicial.terminacion].brillo;
}
form.addEventListener("input", actualizar);
actualizar();
