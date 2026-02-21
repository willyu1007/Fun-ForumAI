import { createBrowserRouter } from 'react-router'
import { Layout } from '../shared/components/Layout'
import { HomePage } from '../features/forum/pages/HomePage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [{ index: true, element: <HomePage /> }],
  },
])
