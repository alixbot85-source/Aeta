import { WorkspaceFileSystem } from "./workspace-fs.js";

export type ProjectTemplate = "nextjs" | "react" | "vue" | "vite" | "node" | "python" | "fastapi" | "express" | "html";

export const projectTemplates: Array<{ id: ProjectTemplate; name: string; description: string; startCommand: string }> = [
  { id: "nextjs", name: "Next.js", description: "Minimal Next.js app with TypeScript.", startCommand: "npm run dev" },
  { id: "react", name: "React", description: "Vite React TypeScript app.", startCommand: "npm run dev -- --host 0.0.0.0" },
  { id: "vue", name: "Vue", description: "Vite Vue TypeScript app.", startCommand: "npm run dev -- --host 0.0.0.0" },
  { id: "vite", name: "Vite", description: "Vanilla Vite TypeScript app.", startCommand: "npm run dev -- --host 0.0.0.0" },
  { id: "node", name: "Node.js", description: "Node HTTP server.", startCommand: "npm start" },
  { id: "python", name: "Python", description: "Plain Python project.", startCommand: "python main.py" },
  { id: "fastapi", name: "FastAPI", description: "FastAPI service.", startCommand: "uvicorn main:app --host 0.0.0.0 --port 8000" },
  { id: "express", name: "Express", description: "Express TypeScript API.", startCommand: "npm run dev" },
  { id: "html", name: "HTML/CSS/JS", description: "Static browser project.", startCommand: "python -m http.server 8080 --bind 0.0.0.0" }
];

export async function scaffoldTemplate(fs: WorkspaceFileSystem, template: ProjectTemplate): Promise<void> {
  await fs.ensureRoot();
  switch (template) {
    case "html":
      await fs.writeFile("README.md", "# HTML Starter\n\nRun with `python -m http.server 8080 --bind 0.0.0.0`.\n");
      await fs.writeFile("index.html", "<!doctype html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><link rel=\"stylesheet\" href=\"styles.css\"><title>Aeta HTML Starter</title></head><body><main><h1>Hello from Aeta</h1><p>Edit <code>index.html</code> to start.</p></main><script src=\"main.js\"></script></body></html>\n");
      await fs.writeFile("styles.css", "body{margin:0;font-family:Inter,system-ui;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh}main{padding:2rem;border:1px solid #334155;border-radius:1rem;background:#111827}\n");
      await fs.writeFile("main.js", "console.log('Aeta HTML starter is running');\n");
      break;
    case "python":
      await fs.writeFile("README.md", "# Python Starter\n\nRun with `python main.py`.\n");
      await fs.writeFile("main.py", "def main():\n    print('Hello from Aeta Python starter')\n\nif __name__ == '__main__':\n    main()\n");
      break;
    case "fastapi":
      await fs.writeFile("README.md", "# FastAPI Starter\n\nInstall dependencies with `pip install -r requirements.txt` and run with `uvicorn main:app --host 0.0.0.0 --port 8000`.\n");
      await fs.writeFile("requirements.txt", "fastapi==0.115.0\nuvicorn[standard]==0.30.6\n");
      await fs.writeFile("main.py", "from fastapi import FastAPI\n\napp = FastAPI(title='Aeta FastAPI Starter')\n\n@app.get('/')\ndef read_root():\n    return {'message': 'Hello from Aeta'}\n");
      break;
    case "node":
      await fs.writeFile("package.json", JSON.stringify({ scripts: { start: "node server.js" }, dependencies: {} }, null, 2) + "\n");
      await fs.writeFile("server.js", "import http from 'node:http';\nconst port = process.env.PORT || 3000;\nhttp.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({message:'Hello from Aeta'}));}).listen(port, '0.0.0.0', () => console.log(`Server listening on ${port}`));\n");
      await fs.writeFile("README.md", "# Node Starter\n\nRun with `npm start`.\n");
      break;
    case "express":
      await fs.writeFile("package.json", JSON.stringify({ type: "module", scripts: { dev: "tsx watch src/index.ts", start: "node dist/index.js", build: "tsc" }, dependencies: { express: "^4.19.2" }, devDependencies: { "@types/express": "^4.17.21", tsx: "^4.19.2", typescript: "^5.6.3" } }, null, 2) + "\n");
      await fs.writeFile("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", outDir: "dist", strict: true, esModuleInterop: true }, include: ["src/**/*.ts"] }, null, 2) + "\n");
      await fs.writeFile("src/index.ts", "import express from 'express';\nconst app = express();\nconst port = Number(process.env.PORT || 3000);\napp.get('/', (_req, res) => res.json({ message: 'Hello from Aeta Express' }));\napp.listen(port, '0.0.0.0', () => console.log(`Listening on ${port}`));\n");
      break;
    case "nextjs":
      await fs.writeFile("package.json", JSON.stringify({ scripts: { dev: "next dev -H 0.0.0.0", build: "next build", start: "next start -H 0.0.0.0" }, dependencies: { next: "^14.2.15", react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { typescript: "^5.6.3", "@types/node": "^22.7.5", "@types/react": "^18.3.11", "@types/react-dom": "^18.3.1" } }, null, 2) + "\n");
      await fs.writeFile("app/page.tsx", "export default function Page(){return <main style={{fontFamily:'system-ui',padding:40}}><h1>Hello from Aeta Next.js</h1></main>}\n");
      await fs.writeFile("app/layout.tsx", "export default function Layout({children}:{children:React.ReactNode}){return <html lang=\"en\"><body>{children}</body></html>}\n");
      await fs.writeFile("tsconfig.json", JSON.stringify({ compilerOptions: { jsx: "preserve", strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", target: "es2022", lib: ["dom", "dom.iterable", "es2022"], allowJs: true, skipLibCheck: true, esModuleInterop: true, allowSyntheticDefaultImports: true, resolveJsonModule: true, isolatedModules: true, incremental: true }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2) + "\n");
      break;
    case "vue":
      await fs.writeFile("package.json", JSON.stringify({ type: "module", scripts: { dev: "vite --host 0.0.0.0", build: "vue-tsc && vite build", preview: "vite preview --host 0.0.0.0" }, dependencies: { "@vitejs/plugin-vue": "^5.1.4", vite: "^5.4.8", vue: "^3.5.10", typescript: "^5.6.3", "vue-tsc": "^2.1.6" }, devDependencies: {} }, null, 2) + "\n");
      await fs.writeFile("index.html", "<div id=\"app\"></div><script type=\"module\" src=\"/src/main.ts\"></script>\n");
      await fs.writeFile("src/main.ts", "import { createApp } from 'vue';\ncreateApp({ template: '<main><h1>Hello from Aeta Vue</h1></main>' }).mount('#app');\n");
      await fs.writeFile("vite.config.ts", "import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\nexport default defineConfig({ plugins: [vue()] });\n");
      break;
    case "vite":
      await fs.writeFile("package.json", JSON.stringify({ type: "module", scripts: { dev: "vite --host 0.0.0.0", build: "tsc && vite build", preview: "vite preview --host 0.0.0.0" }, dependencies: { vite: "^5.4.8", typescript: "^5.6.3" }, devDependencies: {} }, null, 2) + "\n");
      await fs.writeFile("index.html", "<div id=\"app\"></div><script type=\"module\" src=\"/src/main.ts\"></script>\n");
      await fs.writeFile("src/main.ts", "document.querySelector('#app')!.innerHTML = '<main><h1>Hello from Aeta Vite</h1></main>';\n");
      await fs.writeFile("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true }, include: ["src"] }, null, 2) + "\n");
      break;
    case "react":
    default:
      await fs.writeFile("package.json", JSON.stringify({ type: "module", scripts: { dev: "vite --host 0.0.0.0", build: "tsc && vite build", preview: "vite preview --host 0.0.0.0" }, dependencies: { "@vitejs/plugin-react": "^4.3.2", vite: "^5.4.8", react: "^18.3.1", "react-dom": "^18.3.1", typescript: "^5.6.3" }, devDependencies: { "@types/react": "^18.3.11", "@types/react-dom": "^18.3.1" } }, null, 2) + "\n");
      await fs.writeFile("index.html", "<div id=\"root\"></div><script type=\"module\" src=\"/src/App.tsx\"></script>\n");
      await fs.writeFile("src/App.tsx", "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nfunction App(){return <main style={{fontFamily:'system-ui',padding:40}}><h1>Hello from Aeta React</h1></main>}\ncreateRoot(document.getElementById('root')!).render(<App/>);\n");
      await fs.writeFile("tsconfig.json", JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true }, include: ["src"] }, null, 2) + "\n");
  }
}
