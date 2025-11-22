import { db, users } from './db'
import { insertUserSchema, updateContextSchema } from '@shared/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

export interface IUserStorage {
  getUserByTelegramId(telegramId: number): Promise<any | undefined>
  createUser(user: z.infer<typeof insertUserSchema>): Promise<any>
  updateUserContext(
    telegramId: number,
    context: Record<string, any>
  ): Promise<any>
}

export class PostgresStorage implements IUserStorage {
  async getUserByTelegramId(telegramId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1)
    return user
  }

  async createUser(user: z.infer<typeof insertUserSchema>) {
    const [created] = await db.insert(users).values(user).returning()
    return created
  }

  async updateUserContext(telegramId: number, context: Record<string, any>) {
    const [updated] = await db
      .update(users)
      .set({ context })
      .where(eq(users.telegramId, telegramId))
      .returning()
    return updated
  }

  async getUserContext(telegramId: number) {
    const user = await this.getUserByTelegramId(telegramId)
    return user?.context || {}
  }

  async updateUserContextField(telegramId: number, field: string, value: any) {
    const user = await this.getUserByTelegramId(telegramId)
    const newContext = { ...user?.context, [field]: value }
    const [updated] = await db
      .update(users)
      .set({ context: newContext })
      .where(eq(users.telegramId, telegramId))
      .returning()
    return updated
  }

  async isProfileComplete(telegramId: number) {
    const user = await this.getUserByTelegramId(telegramId)
    if (!user) return false
    const ctx = user.context || {}
    const requiredFields = ['name', 'age', 'gender', 'height', 'weight']
    return requiredFields.every((f) => ctx[f])
  }

  async appendUserDialog(
    telegramId: number,
    message: { role: 'user' | 'assistant'; text: string }
  ) {
    const ctx = await this.getUserContext(telegramId)
    const dialogHistory = ctx.dialogHistory || []
    dialogHistory.push(message)

    // Ограничиваем историю, чтобы не перегружать промпт
    const MAX_HISTORY = 50
    if (dialogHistory.length > MAX_HISTORY) {
      dialogHistory.splice(0, dialogHistory.length - MAX_HISTORY)
    }

    await this.updateUserContextField(
      telegramId,
      'dialogHistory',
      dialogHistory
    )
  }

  async deleteUserByTelegramId(telegramId: number): Promise<void> {
    await db.delete(users).where(eq(users.telegramId, telegramId))
  }
}

export const storage = new PostgresStorage()
