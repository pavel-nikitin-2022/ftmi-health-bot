import axios from 'axios'
import 'dotenv/config'

export async function setupWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const baseUrl = process.env.WEBHOOK_BASE_URL

  if (!token) throw new Error('BOT_TOKEN is not set')
  if (!baseUrl) throw new Error('WEBHOOK_BASE_URL is not set')

  const webhookUrl = `${baseUrl}/tg/webhook/${token}`

  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        params: { url: webhookUrl },
      }
    )

    console.log('🔗 Telegram webhook setup:', res.data)
  } catch (err: any) {
    console.error('❌ Failed to set webhook:', err.response?.data || err)
  }
}
