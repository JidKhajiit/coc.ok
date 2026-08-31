import nodemailer from 'nodemailer'
import type { Env } from '../env.js'

type MailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(env: Env): nodemailer.Transporter | null {
  if (!env.SMTP_HOST) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  }
  return transporter
}

export async function sendMail(env: Env, payload: MailPayload): Promise<void> {
  const transport = getTransporter(env)
  const from = env.SMTP_FROM

  if (!transport) {
    console.log('[email:dev]', {
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    })
    return
  }

  await transport.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })
}

export function verificationEmail(env: Env, email: string, token: string) {
  const url = `${env.APP_URL}/card-trades/verify-email?token=${encodeURIComponent(token)}`
  const subject = 'Подтвердите email — Clash of Critters: Overkill'
  const text = `Подтвердите email, перейдя по ссылке:\n${url}\n\nСсылка действует 48 часов.`
  const html = `<p>Подтвердите email, нажав на кнопку:</p><p><a href="${url}">Подтвердить email</a></p><p>Или скопируйте ссылку:<br>${url}</p>`
  return sendMail(env, { to: email, subject, text, html })
}

export function passwordResetEmail(env: Env, email: string, token: string) {
  const url = `${env.APP_URL}/card-trades/reset-password?token=${encodeURIComponent(token)}`
  const subject = 'Сброс пароля — Clash of Critters: Overkill'
  const text = `Сбросьте пароль, перейдя по ссылке:\n${url}\n\nСсылка действует 2 часа.`
  const html = `<p>Сбросьте пароль, нажав на кнопку:</p><p><a href="${url}">Сбросить пароль</a></p><p>Или скопируйте ссылку:<br>${url}</p>`
  return sendMail(env, { to: email, subject, text, html })
}
