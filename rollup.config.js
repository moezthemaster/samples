import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";
import terser from "@rollup/plugin-terser";
import fs from "fs";


const libs = [
  fs.readFileSync("src/lib/html2canvas.min.js", "utf-8"),
  fs.readFileSync("src/lib/jspdf.umd.min.js", "utf-8")
].join("\n");

function minifyHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

export default {
  input: "src/assets/js/script.js",
  output: {
    file: "dist/bundle-temp.js",
    format: "iife",
    name: "App",
  },
  plugins: [
    {
      name: "prepend-libs",
      renderChunk(code) {
        return libs + "\n" + code;
      }
    },
    postcss({
      inject: true,
      minimize: true,
      plugins: [
        postcssUrl({
          url: "inline",
          maxSize: 0
        })
      ]
    }),
    terser(),
    {
      name: "html-inliner",
      writeBundle() {
        const tempJsPath = "dist/bundle-temp.js";
        const templatePath = "src/index.html";
        const outputPath = "dist/jil-viewer.html";
        
        if (!fs.existsSync(tempJsPath)) {
          throw new Error(`Fichier JS temporaire manquant: ${tempJsPath}`);
        }
        if (!fs.existsSync(templatePath)) {
          throw new Error(`Template HTML manquant: ${templatePath}`);
        }
        
        const jsCode = fs.readFileSync(tempJsPath, "utf-8");
        const template = fs.readFileSync(templatePath, "utf-8");
        
        let finalHtml;
        if (template.includes('</body>')) {
          finalHtml = template.replace('</body>', `<script>${jsCode}</script>\n</body>`);
        } else {
          finalHtml = template + `\n<script>${jsCode}</script>`;
        }
        
        const minifiedHtml = minifyHtml(finalHtml);
        
        fs.writeFileSync(outputPath, minifiedHtml);
        console.log(`${outputPath} créé avec JS inline (minifié)`);
        
        try {
          fs.unlinkSync(tempJsPath);
          console.log(`${tempJsPath} supprimé`);
        } catch (e) {
          console.warn(`Impossible de supprimer ${tempJsPath}:`, e.message);
        }
      }
    }
  ]
};