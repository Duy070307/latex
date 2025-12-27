// Geo2LaTeX Lite
// A simple, client-side "trace" tool: user clicks to place points/shapes, then export TikZ code.
// No auto-recognition here (that's the "paid upgrade" story).

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const bgFile = document.getElementById("bgFile");
const btnClearBg = document.getElementById("btnClearBg");
const bgOpacity = document.getElementById("bgOpacity");
const bgOpacityVal = document.getElementById("bgOpacityVal");

const snapGrid = document.getElementById("snapGrid");
const showPoints = document.getElementById("showPoints");
const showLabels = document.getElementById("showLabels");

const latexOut = document.getElementById("latexOut");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnSelectAll = document.getElementById("btnSelectAll");
const btnPretty = document.getElementById("btnPretty");

const btnUndo = document.getElementById("btnUndo");
const btnReset = document.getElementById("btnReset");
const hint = document.getElementById("hint");
const toolName = document.getElementById("toolName");

const tikzWidthInput = document.getElementById("tikzWidth");
const lineWidthInput = document.getElementById("lineWidth");
const modeSelect = document.getElementById("modeSelect");

const btnFinishPoly = document.getElementById("btnFinishPoly");

const TOOL_LABELS = {
  point: "Point",
  segment: "Segment",
  polygon: "Polygon",
  circle: "Circle",
  angle: "Angle",
  label: "Label"
};

let state = {
  tool: "point",
  bgImg: null,
  bgOpacity: parseFloat(bgOpacity.value),
  // Core geometry model
  points: [],       // { id, name, x, y }  (x,y in canvas px)
  shapes: [],       // { type, ... } (segment, polygon, circle, angle)
  // transient selections
  picking: [],      // list of point ids in-progress
  polyTemp: null,   // { pointIds: [] } while building polygon
  history: []       // snapshots for undo
};

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

function saveHistory(){
  // Keep last 80 states to avoid infinite memory for enthusiastic clicking.
  state.history.push(deepClone({
    points: state.points,
    shapes: state.shapes,
    polyTemp: state.polyTemp
  }));
  if(state.history.length > 80) state.history.shift();
}

function restoreFromHistory(){
  if(state.history.length === 0) return;
  const last = state.history.pop();
  state.points = last.points;
  state.shapes = last.shapes;
  state.polyTemp = last.polyTemp;
  state.picking = [];
  syncUI();
}

function resetAll(){
  saveHistory();
  state.points = [];
  state.shapes = [];
  state.polyTemp = null;
  state.picking = [];
  syncUI();
}

function setTool(t){
  state.tool = t;
  state.picking = [];
  if(t !== "polygon") state.polyTemp = null;
  toolName.textContent = TOOL_LABELS[t] || t;
  updateHintForTool();
  syncUI();
}

function showHint(text){
  hint.textContent = text;
  hint.classList.add("show");
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => hint.classList.remove("show"), 1800);
}

function updateHintForTool(){
  const t = state.tool;
  if(t === "point") showHint("Click để thêm điểm. Điểm gần nhau sẽ được tự chọn lại.");
  if(t === "segment") showHint("Chọn 2 điểm để tạo đoạn thẳng.");
  if(t === "polygon") showHint("Click nhiều điểm để tạo đa giác. Bấm “Hoàn tất đa giác” khi xong.");
  if(t === "circle") showHint("Chọn tâm O, rồi chọn 1 điểm trên đường tròn.");
  if(t === "angle") showHint("Chọn 3 điểm theo thứ tự A–B–C (góc tại B).");
  if(t === "label") showHint("Click 1 điểm để đổi tên/nhãn.");
}

// --- Geometry helpers
function dist2(ax, ay, bx, by){
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy;
}

function snap(x){
  if(!snapGrid.checked) return x;
  const step = 20; // px
  return Math.round(x/step)*step;
}

function findNearestPoint(x, y, maxPx=12){
  let best = null;
  const maxD2 = maxPx*maxPx;
  for(const p of state.points){
    const d2 = dist2(x,y,p.x,p.y);
    if(d2 <= maxD2 && (!best || d2 < best.d2)){
      best = { p, d2 };
    }
  }
  return best ? best.p : null;
}

const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function nextPointName(){
  // A..Z, then A1..Z1, A2.. etc
  const n = state.points.length;
  if(n < 26) return ALPH[n];
  const idx = n % 26;
  const k = Math.floor(n / 26);
  return `${ALPH[idx]}${k}`;
}

function addPoint(x, y){
  const pNear = findNearestPoint(x,y, 10);
  if(pNear) return pNear.id;

  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const name = nextPointName();
  state.points.push({ id, name, x, y });
  return id;
}

function getPoint(id){
  return state.points.find(p => p.id === id);
}

// --- Rendering
function clearCanvas(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground(){
  if(!state.bgImg) return;
  ctx.save();
  ctx.globalAlpha = state.bgOpacity;
  // fit image into canvas preserving aspect
  const img = state.bgImg;
  const cw = canvas.width, ch = canvas.height;
  const ir = img.width / img.height;
  const cr = cw / ch;
  let w,h,x,y;
  if(ir > cr){
    w = cw; h = cw / ir;
    x = 0; y = (ch - h) / 2;
  }else{
    h = ch; w = ch * ir;
    y = 0; x = (cw - w) / 2;
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawGrid(){
  if(!snapGrid.checked) return;
  ctx.save();
  ctx.strokeStyle = "rgba(148, 163, 184, .35)";
  ctx.lineWidth = 1;
  const step = 20;
  for(let x=0;x<=canvas.width;x+=step){
    ctx.beginPath();
    ctx.moveTo(x,0); ctx.lineTo(x,canvas.height);
    ctx.stroke();
  }
  for(let y=0;y<=canvas.height;y+=step){
    ctx.beginPath();
    ctx.moveTo(0,y); ctx.lineTo(canvas.width,y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShapes(){
  // Draw in a consistent style
  const lw = parseFloat(lineWidthInput.value || "0.8");
  ctx.save();
  ctx.lineWidth = Math.max(1, lw*1.2);

  // segments
  for(const s of state.shapes){
    if(s.type === "segment"){
      const a = getPoint(s.a), b = getPoint(s.b);
      if(!a || !b) continue;
      ctx.strokeStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if(s.type === "polygon"){
      const pts = s.points.map(getPoint).filter(Boolean);
      if(pts.length < 3) continue;
      ctx.strokeStyle = "#0f172a";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
    }

    if(s.type === "circle"){
      const c = getPoint(s.center), r = getPoint(s.on);
      if(!c || !r) continue;
      const rad = Math.sqrt(dist2(c.x,c.y,r.x,r.y));
      ctx.strokeStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(c.x, c.y, rad, 0, Math.PI*2);
      ctx.stroke();
    }

    if(s.type === "angle"){
      const A = getPoint(s.a), B = getPoint(s.b), C = getPoint(s.c);
      if(!A || !B || !C) continue;
      // draw an arc at B
      const r = 26;
      const ang1 = Math.atan2(A.y - B.y, A.x - B.x);
      const ang2 = Math.atan2(C.y - B.y, C.x - B.x);
      ctx.strokeStyle = "rgba(37, 99, 235, .9)";
      ctx.lineWidth = Math.max(2, lw*1.6);
      ctx.beginPath();
      ctx.arc(B.x, B.y, r, ang1, ang2, false);
      ctx.stroke();
      // reset
      ctx.lineWidth = Math.max(1, lw*1.2);
    }
  }

  // polygon temp (in-progress)
  if(state.polyTemp && state.polyTemp.pointIds.length){
    const pts = state.polyTemp.pointIds.map(getPoint).filter(Boolean);
    if(pts.length >= 1){
      ctx.strokeStyle = "rgba(37, 99, 235, .55)";
      ctx.setLineDash([6,6]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // selection highlights
  for(const pid of state.picking){
    const p = getPoint(pid);
    if(!p) continue;
    ctx.strokeStyle = "rgba(37, 99, 235, .9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, lw*1.2);
  }

  ctx.restore();
}

function drawPoints(){
  if(!showPoints.checked && !showLabels.checked) return;
  ctx.save();
  ctx.fillStyle = "#0f172a";
  ctx.font = "12px ui-sans-serif, system-ui";
  for(const p of state.points){
    if(showPoints.checked){
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI*2);
      ctx.fill();
    }
    if(showLabels.checked){
      ctx.fillStyle = "#0f172a";
      ctx.fillText(p.name, p.x + 8, p.y - 8);
      ctx.fillStyle = "#0f172a";
    }
  }
  ctx.restore();
}

function render(){
  clearCanvas();
  drawBackground();
  drawGrid();
  drawShapes();
  drawPoints();
}

function syncUI(){
  // polygon finish enabled?
  btnFinishPoly.disabled = !(state.tool === "polygon" && state.polyTemp && state.polyTemp.pointIds.length >= 3);
  updateLatex();
  render();
}

// --- TikZ generation
function fmt(n){
  // Stable decimal formatting
  const x = Math.round(n*1000)/1000;
  // avoid -0
  return (Math.abs(x) < 1e-9) ? "0" : String(x);
}

function canvasToTikz(x, y){
  const W = canvas.width, H = canvas.height;
  const tikzW = parseFloat(tikzWidthInput.value || "10");
  const s = tikzW / W;          // scale px -> tikz units
  const tx = x * s;
  const ty = (H - y) * s;       // invert y
  return { x: tx, y: ty, s };
}

function angleDeg(a){ return a * 180 / Math.PI; }

function updateLatex(){
  const tikzW = parseFloat(tikzWidthInput.value || "10");
  const lineW = parseFloat(lineWidthInput.value || "0.8");

  // Coordinate definitions
  const lines = [];
  lines.push("% Geo2LaTeX Lite (demo) - Zalo: 0377733703");
  lines.push("% Muốn mua bản cải tiến để chuyển đổi hầu như tất cả hình: liên hệ Zalo 0377733703");
  lines.push("\\begin{tikzpicture}[line cap=round,line join=round,>=latex]");
  lines.push(`  \\tikzset{every path/.style={line width=${fmt(lineW)}pt}}`);

  // Define points
  for(const p of state.points){
    const t = canvasToTikz(p.x, p.y);
    lines.push(`  \\coordinate (${sanitizeName(p.name)}) at (${fmt(t.x)},${fmt(t.y)});`);
  }

  // Draw shapes
  for(const s of state.shapes){
    if(s.type === "segment"){
      const a = getPoint(s.a), b = getPoint(s.b);
      if(!a || !b) continue;
      lines.push(`  \\draw (${sanitizeName(a.name)}) -- (${sanitizeName(b.name)});`);
    }

    if(s.type === "polygon"){
      const pts = s.points.map(getPoint).filter(Boolean);
      if(pts.length < 3) continue;
      const path = pts.map(p => `(${sanitizeName(p.name)})`).join(" -- ");
      lines.push(`  \\draw ${path} -- cycle;`);
    }

    if(s.type === "circle"){
      const c = getPoint(s.center), r = getPoint(s.on);
      if(!c || !r) continue;
      const tc = canvasToTikz(c.x, c.y);
      const tr = canvasToTikz(r.x, r.y);
      const rad = Math.hypot(tr.x - tc.x, tr.y - tc.y);
      lines.push(`  \\draw (${sanitizeName(c.name)}) circle[radius=${fmt(rad)}];`);
    }

    if(s.type === "angle"){
      const A = getPoint(s.a), B = getPoint(s.b), C = getPoint(s.c);
      if(!A || !B || !C) continue;

      // Compute arc angles in TikZ coordinate space
      const tA = canvasToTikz(A.x, A.y);
      const tB = canvasToTikz(B.x, B.y);
      const tC = canvasToTikz(C.x, C.y);

      const ang1 = angleDeg(Math.atan2(tA.y - tB.y, tA.x - tB.x));
      const ang2 = angleDeg(Math.atan2(tC.y - tB.y, tC.x - tB.x));

      // normalize to [0,360)
      const a1 = ((ang1 % 360) + 360) % 360;
      const a2 = ((ang2 % 360) + 360) % 360;

      // choose the smaller sweep direction
      let start = a1, end = a2;
      let sweep = (end - start + 360) % 360;
      if(sweep > 180){
        // swap to draw the other direction
        [start, end] = [end, start];
        sweep = (end - start + 360) % 360;
      }

      const radius = 0.5; // tikz units
      const bName = sanitizeName(B.name);
      lines.push(`  \\draw[blue] (${bName}) ++(${fmt(start)}:${fmt(radius)}) arc[start angle=${fmt(start)}, end angle=${fmt(end)}, radius=${fmt(radius)}];`);
    }
  }

  // Draw points and labels (optional)
  if(showPoints.checked || showLabels.checked){
    for(const p of state.points){
      const name = sanitizeName(p.name);
      const parts = [];
      if(showPoints.checked) parts.push("\\fill");
      else parts.push("\\path");
      let node = "";
      if(showLabels.checked){
        node = ` node[above right] {$${escapeLatex(p.name)}$}`;
      }
      lines.push(`  ${parts.join(" ")} (${name}) circle (1.1pt)${node};`);
    }
  }

  lines.push("\\end{tikzpicture}");
  latexOut.value = lines.join("\n");
}

function sanitizeName(name){
  // TikZ node names: remove spaces/specials, keep alnum underscore
  // If user uses weird names, we make a safe variant.
  const safe = String(name).trim().replace(/\s+/g,"").replace(/[^A-Za-z0-9_]/g,"");
  return safe || "P";
}

function escapeLatex(s){
  // For point label inside $...$, escape a few specials.
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/%/g, "\\%")
    .replace(/#/g, "\\#")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

// --- Interaction
function canvasPos(evt){
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
  const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

canvas.addEventListener("mousemove", (e) => {
  const {x,y} = canvasPos(e);
  const p = findNearestPoint(x,y, 12);
  canvas.style.cursor = p ? "pointer" : "crosshair";
});

canvas.addEventListener("click", (e) => {
  const pos = canvasPos(e);
  const x = snap(pos.x), y = snap(pos.y);

  if(state.tool === "point"){
    saveHistory();
    addPoint(x,y);
    syncUI();
    return;
  }

  if(state.tool === "label"){
    const p = findNearestPoint(x,y, 14);
    if(!p){ showHint("Chưa click trúng điểm nào."); return; }
    const newName = prompt("Nhập nhãn mới cho điểm:", p.name);
    if(newName === null) return;
    const trimmed = String(newName).trim();
    if(!trimmed){ showHint("Nhãn trống thì thôi."); return; }
    saveHistory();
    p.name = trimmed;
    syncUI();
    return;
  }

  // For shape tools: pick points
  const pid = addPoint(x,y);
  state.picking.push(pid);

  if(state.tool === "segment"){
    if(state.picking.length === 2){
      saveHistory();
      state.shapes.push({ type:"segment", a: state.picking[0], b: state.picking[1] });
      state.picking = [];
      syncUI();
    }
    return;
  }

  if(state.tool === "circle"){
    if(state.picking.length === 2){
      saveHistory();
      state.shapes.push({ type:"circle", center: state.picking[0], on: state.picking[1] });
      state.picking = [];
      syncUI();
    }
    return;
  }

  if(state.tool === "angle"){
    if(state.picking.length === 3){
      saveHistory();
      state.shapes.push({ type:"angle", a: state.picking[0], b: state.picking[1], c: state.picking[2] });
      state.picking = [];
      syncUI();
    }
    return;
  }

  if(state.tool === "polygon"){
    if(!state.polyTemp) state.polyTemp = { pointIds: [] };
    state.polyTemp.pointIds.push(pid);
    // don't save history every click to keep undo meaningful; user can undo after finishing
    syncUI();
    return;
  }
});

btnFinishPoly.addEventListener("click", () => {
  if(!(state.polyTemp && state.polyTemp.pointIds.length >= 3)) return;
  saveHistory();
  state.shapes.push({ type:"polygon", points: [...state.polyTemp.pointIds] });
  state.polyTemp = null;
  state.picking = [];
  syncUI();
});

btnUndo.addEventListener("click", () => restoreFromHistory());
btnReset.addEventListener("click", () => {
  if(confirm("Xoá toàn bộ điểm và hình?")) resetAll();
});

bgOpacity.addEventListener("input", () => {
  state.bgOpacity = parseFloat(bgOpacity.value);
  bgOpacityVal.textContent = state.bgOpacity.toFixed(2);
  render();
});

bgFile.addEventListener("change", async () => {
  const file = bgFile.files && bgFile.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.bgImg = img;
    URL.revokeObjectURL(url);
    render();
  };
  img.src = url;
});

btnClearBg.addEventListener("click", () => {
  state.bgImg = null;
  bgFile.value = "";
  render();
});

showPoints.addEventListener("change", syncUI);
showLabels.addEventListener("change", syncUI);
snapGrid.addEventListener("change", syncUI);
tikzWidthInput.addEventListener("input", syncUI);
lineWidthInput.addEventListener("input", syncUI);

modeSelect.addEventListener("change", () => {
  if(modeSelect.value !== "flat"){
    showHint("Chế độ này thuộc bản nâng cấp. Bản Lite chỉ hỗ trợ hình phẳng đơn giản. Liên hệ Zalo 0377733703.");
    modeSelect.value = "flat";
  }else{
    showHint("Đang ở chế độ Hình phẳng (Lite).");
  }
});

btnSelectAll.addEventListener("click", () => {
  latexOut.focus();
  latexOut.select();
});

btnPretty.addEventListener("click", () => {
  // minimal pretty: trim trailing spaces and collapse double blank lines
  const s = latexOut.value
    .split("\n")
    .map(l => l.replace(/\s+$/,""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  latexOut.value = s;
});

btnCopy.addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText(latexOut.value);
    showHint("Đã copy LaTeX vào clipboard.");
  }catch{
    // fallback
    latexOut.focus(); latexOut.select();
    document.execCommand("copy");
    showHint("Đã copy (fallback).");
  }
});

btnDownload.addEventListener("click", () => {
  const blob = new Blob([latexOut.value], { type: "text/x-tex" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "geo2latex_output.tex";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
});

// Tool buttons
document.querySelectorAll(".tool").forEach(btn => {
  btn.addEventListener("click", () => {
    // PRO tools are locked in Lite
    if(btn.dataset.locked === "1"){
      showHint("Tính năng này thuộc bản nâng cấp. Muốn dùng: liên hệ Zalo 0377733703.");
      return;
    }
    document.querySelectorAll(".tool").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    setTool(btn.dataset.tool);
  });
});

// Initial
bgOpacityVal.textContent = state.bgOpacity.toFixed(2);
updateHintForTool();
syncUI();
