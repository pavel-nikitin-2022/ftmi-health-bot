import express, { type Request, Response, NextFunction } from 'express'
import { registerRoutes } from './routes'
import { setupWebhook } from './setupWebhook'
import 'dotenv/config'

const app = express()

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }));
(async () => {
  const server = await registerRoutes(app)

  // ⬇⬇⬇ добавляем вызов
  await setupWebhook()

  const port = parseInt(process.env.PORT || '8000', 10)
  server.listen({
    port,
    host: '0.0.0.0',
    reusePort: true,
  })
})()
