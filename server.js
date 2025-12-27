// Optional static server (Node.js). If you don't want it, just open index.html directly.
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 5173;
const root = __dirname;

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon",
  ".json":"application/json; charset=utf-8",
  ".txt":"text/plain; charset=utf-8"
};

function serveFile(res, filePath){
  fs.readFile(filePath, (err, data) => {
    if(err){
      res.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\])+/, "");
  const target = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(root, target);

  // Prevent directory traversal
  if(!filePath.startsWith(root)){
    res.writeHead(403, { "Content-Type":"text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  serveFile(res, filePath);
});

server.listen(port, () => {
  console.log(`Geo2LaTeX Lite running: http://localhost:${port}`);
});
