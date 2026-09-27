import { createBrowserRouter } from 'react-router-dom'

import { AboutPage } from '@/pages/AboutPage'
import { ContactPage } from '@/pages/ContactPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RequestTutorPage } from '@/pages/RequestTutorPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/request-tutor', element: <RequestTutorPage /> },
  { path: '/about', element: <AboutPage /> },
  { path: '/contact', element: <ContactPage /> },
  { path: '*', element: <NotFoundPage /> },
])
