import type { Express } from 'express'
import { type Server, createServer } from 'http'
import { Router } from 'express'
import { bot } from './bot'
import { storage } from './storage'
import 'dotenv/config'
import { askHealthAI } from './openai'

export const tgRouter = Router()

const MAX_DIALOG_HISTORY = 50

tgRouter.post(
  `/webhook/${process.env.TELEGRAM_BOT_TOKEN}`,
  async (req, res) => {
    const update = req.body

    // === 1. Callback query ===
    if (update.callback_query) {
      const callback = update.callback_query
      const chatId = callback.message?.chat.id
      const telegramId = callback.from.id
      const data = callback.data

      if (!chatId) return res.sendStatus(200)

      if (data === 'gender_male') {
        await storage.updateUserContextField(telegramId, 'gender', 'Мужской')
        await bot.sendMessage(chatId, 'Укажите ваш рост в см:', {
          reply_markup: { force_reply: true },
        })
        return res.sendStatus(200)
      } else if (data === 'gender_female') {
        await storage.updateUserContextField(telegramId, 'gender', 'Женский')
        await bot.sendMessage(chatId, 'Укажите ваш рост в см:', {
          reply_markup: { force_reply: true },
        })
        return res.sendStatus(200)
      }

      if (data === 'profile') {
        const user = await storage.getUserByTelegramId(telegramId)
        const ctx = await storage.getUserContext(telegramId)

        if (!user || !(await storage.isProfileComplete(telegramId))) {
          // Если профиль не заполнен, продолжаем флоу регистрации
          await bot.sendMessage(
            chatId,
            'Для начала работы нужно заполнить профиль. Как вас зовут?',
            {
              reply_markup: { force_reply: true },
            }
          )
          return res.sendStatus(200)
        }

        // Если профиль заполнен, выводим данные
        const profileText =
          `👤 Ваш профиль:\n\n` +
          `Имя: ${ctx.name}\n` +
          `Возраст: ${ctx.age}\n` +
          `Пол: ${ctx.gender}\n` +
          `Рост: ${ctx.height}\n` +
          `Вес: ${ctx.weight}`

        await bot.sendMessage(chatId, profileText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Удалить профиль', callback_data: 'delete_profile' }],
            ],
          },
        })
        return res.sendStatus(200)
      }

      // --- Удаление профиля ---
      if (data === 'delete_profile') {
        await storage.deleteUserByTelegramId(telegramId)
        // Создаем новую пустую запись
        await storage.createUser({
          telegramId,
          username: callback.from.username,
          firstName: callback.from.first_name,
          context: {},
        })
        await bot.sendMessage(
          chatId,
          'Профиль удален. Давайте создадим его заново!\nКак вас зовут?',
          {
            reply_markup: { force_reply: true },
          }
        )
        return res.sendStatus(200)
      }

      return res.sendStatus(200)
    }

    // === 2. Сообщения ===
    const message = update.message
    if (!message) return res.sendStatus(200)

    const chatId = message.chat.id
    const text = message.text?.trim()
    const telegramId = message.from.id

    let user = await storage.getUserByTelegramId(telegramId)

    if (!user) {
      await storage.createUser({
        telegramId,
        username: message.from.username,
        firstName: message.from.first_name,
        context: {},
      })
      await bot.sendMessage(
        chatId,
        'Для начала работы нужно заполнить профиль. Как вас зовут?',
        { reply_markup: { force_reply: true } }
      )
      return res.sendStatus(200)
    }

    const ctx = await storage.getUserContext(telegramId)
    const profileComplete = await storage.isProfileComplete(telegramId)

    // === Flow заполнения профиля ===
    if (!profileComplete) {
      if (!ctx.name) {
        await storage.updateUserContextField(telegramId, 'name', text)
        await bot.sendMessage(chatId, `Приятно познакомиться, ${text}!`)
        await bot.sendMessage(chatId, 'Сколько вам лет?', {
          reply_markup: { force_reply: true },
        })
        return res.sendStatus(200)
      }
      if (!ctx.age) {
        await storage.updateUserContextField(telegramId, 'age', text)
        await bot.sendMessage(chatId, 'Укажите ваш пол:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Мужской', callback_data: 'gender_male' }],
              [{ text: 'Женский', callback_data: 'gender_female' }],
            ],
          },
        })
        return res.sendStatus(200)
      }
      if (!ctx.height) {
        await storage.updateUserContextField(telegramId, 'height', text)
        await bot.sendMessage(chatId, 'Укажите ваш вес в кг:', {
          reply_markup: { force_reply: true },
        })
        return res.sendStatus(200)
      }
      if (!ctx.weight) {
        await storage.updateUserContextField(telegramId, 'weight', text)
        await bot.sendMessage(chatId, 'Профиль заполнен! ✅')
        return res.sendStatus(200)
      }
    }

    // === Главное меню ===
    if (text === '/start') {
      await bot.sendMessage(chatId, 'Вы уже зарегистрированы!', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Мой профиль', callback_data: 'profile' },
            ],
          ],
        },
      })
      return res.sendStatus(200)
    }

    // --- Проверка контекста и ограничение длины ---
    const dialogHistory = ctx.dialogHistory || []
    if (dialogHistory.length >= MAX_DIALOG_HISTORY) {
      // сбрасываем историю
      await storage.updateUserContextField(telegramId, 'dialogHistory', [])
      await bot.sendMessage(
        chatId,
        '⚠️ Контекст сообщений достиг лимита и был сброшен.'
      )
    }

    // --- Все сообщения шлем в AI ---
    if (text && profileComplete) {
      const aiResponse = await askHealthAI(telegramId, text)
      await bot.sendMessage(chatId, aiResponse, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Мой профиль', callback_data: 'profile' },
            ],
          ],
        },
      })
      return res.sendStatus(200)
    }

    res.sendStatus(200)
  }
)

export async function registerRoutes(app: Express): Promise<Server> {
  app.use('/tg', tgRouter)
  return createServer(app)
}
