export type GradeCourse = {
  id: string
  stdCode: string
  courseName: string
  credit: number
  gp: number
  score: number
  scoreText: string
  testCategory: string | null
  semesterYear: string
  semesterCode: string
  semesterName: string
  sort: unknown
  project: number
}

export type SemesterGrade = {
  semester: string
  gradeList: GradeCourse[]
}

export type GradesData = {
  totalCredit: number
  gpa: string
  ga: string
  totalScore: number
  semesterGradeList: SemesterGrade[]
}

export type GradesRaw = {
  success: boolean
  code: number
  msg: string
  data?: GradesData | null
}

const GRADES_KEY = 'ksu:grades:project1'

export type CachedGrades = { fetchedAt: number; data: GradesData }

export function getCachedGrades(): CachedGrades | null {
  const raw = localStorage.getItem(GRADES_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CachedGrades
  } catch {
    return null
  }
}

export function setCachedGrades(data: GradesData) {
  const payload: CachedGrades = { fetchedAt: Date.now(), data }
  localStorage.setItem(GRADES_KEY, JSON.stringify(payload))
}

export function clearCachedGrades() {
  localStorage.removeItem(GRADES_KEY)
}

