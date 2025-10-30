import postcss from "rollup-plugin-postcss";
import postcssUrl from "postcss-url";
import postcssImport from "postcss-import";
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
      inject: false,
      extract: 'styles.css',
      minimize: true,
      plugins: [
        postcssImport(),
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
        const cssPath = "dist/styles.css";
        const templatePath = "src/index.html";
        const outputPath = "dist/jil-viewer.html";
        
        if (!fs.existsSync(tempJsPath) || !fs.existsSync(cssPath)) {
          throw new Error(`Fichiers temporaires manquants`);
        }
        
        const jsCode = fs.readFileSync(tempJsPath, "utf-8");
        const cssCode = fs.readFileSync(cssPath, "utf-8");
        const template = fs.readFileSync(templatePath, "utf-8");
        
        let finalHtml = template;
        
        if (finalHtml.includes('</head>')) {
          finalHtml = finalHtml.replace('</head>', `<style>${cssCode}</style>\n</head>`);
        } else if (finalHtml.includes('<body>')) {
          finalHtml = finalHtml.replace('<body>', `<style>${cssCode}</style>\n<body>`);
        } else {
          finalHtml = `<style>${cssCode}</style>\n${finalHtml}`;
        }
        
        if (finalHtml.includes('</body>')) {
          finalHtml = finalHtml.replace('</body>', `<script>${jsCode}</script>\n</body>`);
        } else {
          finalHtml = finalHtml + `\n<script>${jsCode}</script>`;
        }
        
        const minifiedHtml = minifyHtml(finalHtml);
        fs.writeFileSync(outputPath, minifiedHtml);
        console.log(`${outputPath} créé avec CSS dans <head> et JS inline`);
        
        // nettoyage
        try {
          fs.unlinkSync(tempJsPath);
          fs.unlinkSync(cssPath);
        } catch (e) {
          console.warn('Impossible de supprimer les temporaires:', e.message);
        }
      }
    }
  ]
};
