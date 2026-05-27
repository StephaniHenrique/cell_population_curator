import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    {
      name: 'save-json-plugin',
      configureServer(server) {
        // Criamos um "endpoint" interno no servidor de desenvolvimento do Vite
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/save') {
            let body = '';
            
            // Captura os dados enviados pelo React
            req.on('data', chunk => { body += chunk; });
            
            req.on('end', () => {
              try {
                // Caminho absoluto para o seu arquivo de populações
                const filePath = path.resolve(__dirname, 'src/assets/populations.json');
                
                // Sobrescreve o arquivo com o JSON formatado
                fs.writeFileSync(filePath, body, 'utf-8');
                
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ status: 'success' }));
              } catch (error) {
                console.error("Erro ao salvar o arquivo JSON:", error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to write file' }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
})
