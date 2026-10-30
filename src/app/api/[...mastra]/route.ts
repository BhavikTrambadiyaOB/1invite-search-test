import { mastra } from '@/mastra'
import { createNextRouteHandler } from '@mastra/next'

export const { GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD } = createNextRouteHandler({
  mastra,
})
