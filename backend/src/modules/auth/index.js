import { Router } from 'express'

import {
  googleCallbackHandler,
  googleStartHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  providersHandler,
  registerHandler,
} from './controller.js'
import { requireAuth } from './middleware.js'

/**
 * Authentication routes.
 *
 * `/me` is guarded; register, login and logout are the public entry points
 * that establish or clear a session. The Google pair is a redirect-based
 * conversation the API drives on the server, so no OAuth credential is ever
 * present in the browser.
 *
 * None of this touches the admin API, which keeps its own shared-token guard.
 */
export const authRouter = Router()

authRouter.post('/register', registerHandler)
authRouter.post('/login', loginHandler)
authRouter.post('/logout', logoutHandler)
authRouter.get('/me', requireAuth, meHandler)

/**
 * Which sign-in methods this server actually offers.
 *
 * A provider is only listed once it is really configured, so the frontend can
 * hide a button that would go nowhere instead of showing something that fails.
 * The response carries provider *ids* only — no client id, no secret, nothing
 * that is not already visible in the network tab.
 */
authRouter.get('/providers', providersHandler)

authRouter.get('/google', googleStartHandler)
authRouter.get('/google/callback', googleCallbackHandler)
