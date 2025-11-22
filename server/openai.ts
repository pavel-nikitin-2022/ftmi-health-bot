import OpenAI from 'openai'
import 'dotenv/config'
import { storage } from './storage'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Максимальное количество сообщений из контекста для промпта
const MAX_CONTEXT_MESSAGES = 3

/**
 * Формируем системный промпт для ChatGPT
 * @param userContext объект context пользователя из БД
 */
function buildHealthPrompt(userContext: Record<string, any>) {
  const { name, age, height, weight, dialogHistory } = userContext

  const contextSummary = dialogHistory
    ? dialogHistory
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((msg) => `${msg.role}: ${msg.text}`)
        .join('\n')
    : ''

  const basicInfo = `Имя: ${name || 'не указано'}, Возраст: ${
    age || 'не указан'
  }, Рост: ${height || 'не указан'} см, Вес: ${weight || 'не указан'} кг`

  return `
Ты — персональный помощник по здоровью.
Твоя задача — давать рекомендации и советы по здоровью и самочувствию пользователя.
Если сообщение пользователя не связано с темой здоровья — честно скажи, что не можешь помочь.
Контекст пользователя: ${basicInfo}
Последние сообщения пользователя: ${contextSummary}
Не давай диагнозов и медицинских заключений.
После каждой рекомендации добавляй фразу: "⚠️ Я не являюсь врачом, не несу ответственности и могу ошибаться."
Используй короткий, дружелюбный стиль.
`
}

/**
 * Отправляет текст пользователя в OpenAI и получает ответ
 */
export async function askHealthAI(telegramId: number, userMessage: string) {
  const userContext = await storage.getUserContext(telegramId)

  // Добавляем текущее сообщение в историю (но не сохраняем еще)
  const dialogHistory = userContext.dialogHistory || []
  dialogHistory.push({ role: 'user', text: userMessage })

  const prompt = buildHealthPrompt({ ...userContext, dialogHistory })

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      max_completion_tokens: 8192,
    })

    console.log('OpenAI response:', JSON.stringify(response, null, 2))

    const aiText =
      response.choices[0].message?.content || 'Извините, не могу ответить.'

    // Сохраняем ответ AI в контекст пользователя
    await storage.appendUserDialog(telegramId, {
      role: 'assistant',
      text: aiText,
    })

    return aiText
  } catch (err: any) {
    console.error('OpenAI health assistant error:', err)
    return 'Произошла ошибка при обработке вашего запроса.'
  }
}
