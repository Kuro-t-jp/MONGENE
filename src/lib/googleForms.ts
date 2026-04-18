import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { Question, GoogleAuthState } from '../types'

export function isTokenValid(auth: GoogleAuthState | null): boolean {
  if (!auth) return false
  return Date.now() < auth.expiresAt - 60_000
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// ── OAuth PKCE flow ───────────────────────────────────────────────────────────

export async function startGoogleAuth(
  clientId: string,
  clientSecret: string
): Promise<GoogleAuthState> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  const port = await invoke<number>('start_oauth_server')
  const redirectUri = `http://127.0.0.1:${port}`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/forms.body')
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  // Register listeners BEFORE opening browser to avoid race condition
  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('認証タイムアウト（5分）')),
      5 * 60 * 1000
    )
    let unCode: UnlistenFn | undefined
    let unError: UnlistenFn | undefined
    const cleanup = () => {
      clearTimeout(timer)
      unCode?.()
      unError?.()
    }

    Promise.all([
      listen<string>('oauth-code',  (e) => { cleanup(); resolve(e.payload) }),
      listen<string>('oauth-error', (e) => { cleanup(); reject(new Error(`Google認証エラー: ${e.payload}`)) }),
    ])
      .then(([a, b]) => {
        unCode = a
        unError = b
        return openUrl(authUrl.toString())
      })
      .catch(reject)
  })

  return exchangeToken(clientId, clientSecret, code, verifier, redirectUri)
}

async function exchangeToken(
  clientId: string,
  clientSecret: string,
  code: string,
  verifier: string,
  redirectUri: string
): Promise<GoogleAuthState> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
  if (clientSecret) body.set('client_secret', clientSecret)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`トークン取得エラー: ${err.error_description ?? err.error}`)
  }
  const data = await res.json()
  return { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
}

// ── Google Forms API ──────────────────────────────────────────────────────────

export async function createGoogleFormFromQuestions(
  accessToken: string,
  title: string,
  questions: Question[]
): Promise<string> {
  // Step 1: Create blank form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ info: { title, documentTitle: title } }),
  })
  if (!createRes.ok) {
    const err = await createRes.json()
    throw new Error(`フォーム作成エラー: ${err.error?.message ?? JSON.stringify(err)}`)
  }
  const form = await createRes.json()
  const formId: string = form.formId

  // Step 2: batchUpdate — enable quiz + add all questions
  const requests: unknown[] = [
    {
      updateSettings: {
        settings: { quizSettings: { isQuiz: true } },
        updateMask: 'quizSettings',
      },
    },
    ...questions.map((q, i) => buildItemRequest(q, i)),
  ]

  const batchRes = await fetch(
    `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  )
  if (!batchRes.ok) {
    const err = await batchRes.json()
    throw new Error(`問題追加エラー: ${err.error?.message ?? JSON.stringify(err)}`)
  }

  return form.responderUri ?? `https://docs.google.com/forms/d/${formId}/viewform`
}

function buildItemRequest(q: Question, index: number): unknown {
  const isChoice =
    q.type === 'multiple_choice_4' ||
    q.type === 'multiple_choice_5' ||
    q.type === 'true_false'

  if (isChoice) {
    let options: { value: string }[]
    let correctValue: string

    if (q.type === 'true_false') {
      options = [{ value: '正' }, { value: '誤' }]
      correctValue = q.correctAnswer
    } else {
      options = (q.choices ?? []).map((c) => ({ value: `${c.label}. ${c.text}` }))
      const found = q.choices?.find((c) => c.label === q.correctAnswer)
      correctValue = found ? `${found.label}. ${found.text}` : q.correctAnswer
    }

    return {
      createItem: {
        item: {
          title: q.content,
          questionItem: {
            question: {
              required: true,
              choiceQuestion: { type: 'RADIO', options, shuffle: false },
              grading: {
                pointValue: 1,
                correctAnswers: { answers: [{ value: correctValue }] },
                ...(q.explanation
                  ? { generalFeedback: { text: `解説: ${q.explanation}` } }
                  : {}),
              },
            },
          },
        },
        location: { index },
      },
    }
  }

  // Text questions (fill_blank / short_answer / calculation / essay)
  return {
    createItem: {
      item: {
        title: q.content,
        description: `正解: ${q.correctAnswer}${q.explanation ? `\n解説: ${q.explanation}` : ''}`,
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: q.type === 'essay' },
          },
        },
      },
      location: { index },
    },
  }
}
