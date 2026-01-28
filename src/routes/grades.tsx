import { createFileRoute } from '@tanstack/react-router'
import { GradesPage } from '@/pages/grades'

export const Route = createFileRoute('/grades')({
  component: GradesPage,
})

