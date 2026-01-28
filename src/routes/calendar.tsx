import { createFileRoute } from '@tanstack/react-router'
import { CalendarPage } from '@/pages/calendar'

export const Route = createFileRoute('/calendar')({
  component: CalendarPage,
})

