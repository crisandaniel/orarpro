// Claude AI schedule analysis — sends compact summary to Anthropic API.
// Builds a prompt with: employee hours distribution, night shift counts, violations.
// Returns JSON array of suggestions (warning/info/improvement) in user's locale.
// Cost: ~$0.003 per analysis. Responds in RO or EN based on locale header.
// Used by: /api/schedules/[id]/generate after assignment generation.

import type { ShiftAssignment, Employee, Constraint, Schedule, ShiftDefinition } from '@/types'

interface AnalysisInput {
  schedule: Schedule
  assignments: ShiftAssignment[]
  employees: Employee[]
  shiftDefinitions: ShiftDefinition[]
  constraints: Constraint[]
  violations: { type: string; employeeName: string; date: string; message: string }[]
  locale: string
}

interface AISuggestion {
  type: 'warning' | 'info' | 'improvement'
  title: string
  message: string
  affectedEmployees?: string[]
  dates?: string[]
}

export async function analyzeScheduleWithAI(
  input: AnalysisInput
): Promise<AISuggestion[]> {
  const { schedule, assignments, employees, shiftDefinitions, constraints, violations, locale } = input

  // Build a compact summary to minimize token usage
  const hoursPerEmployee: Record<string, number> = {}
  employees.forEach((e) => (hoursPerEmployee[e.name] = 0))

  assignments.forEach((a) => {
    const shift = shiftDefinitions.find((s) => s.id === a.shift_definition_id)
    if (!shift) return
    const [sh, sm] = shift.start_time.split(':').map(Number)
    const [eh, em] = shift.end_time.split(':').map(Number)
    let mins = eh * 60 + em - (sh * 60 + sm)
    if (shift.crosses_midnight) mins += 24 * 60
    const emp = employees.find((e) => e.id === a.employee_id)
    if (emp) hoursPerEmployee[emp.name] = (hoursPerEmployee[emp.name] ?? 0) + mins / 60
  })

  const nightShiftsPerEmployee: Record<string, number> = {}
  assignments.forEach((a) => {
    const shift = shiftDefinitions.find((s) => s.id === a.shift_definition_id)
    if (shift?.shift_type === 'night') {
      const emp = employees.find((e) => e.id === a.employee_id)
      if (emp) nightShiftsPerEmployee[emp.name] = (nightShiftsPerEmployee[emp.name] ?? 0) + 1
    }
  })

  const prompt = `You are a scheduling assistant for a workforce management app called OrarPro.
Analyze this schedule and provide practical suggestions.

Schedule: "${schedule.name}"
Period: ${schedule.start_date} to ${schedule.end_date}
Type: ${schedule.type}

Employees (${employees.length}):
${employees.map((e) => `- ${e.name} (${e.experience_level})`).join('\n')}

Hours assigned per employee:
${Object.entries(hoursPerEmployee).map(([name, hours]) => `- ${name}: ${hours.toFixed(1)}h`).join('\n')}

Night shifts per employee:
${Object.entries(nightShiftsPerEmployee).filter(([, n]) => n > 0).map(([name, n]) => `- ${name}: ${n}`).join('\n') || 'None'}

Constraint violations found (${violations.length}):
${violations.slice(0, 10).map((v) => `- ${v.employeeName} on ${v.date}: ${v.message}`).join('\n')}

Active constraints (${constraints.length}):
${constraints.filter((c) => c.is_active).map((c) => `- ${c.type}: ${c.note ?? ''}`).join('\n')}

Respond ONLY with a JSON array of suggestions. Each suggestion has:
- type: "warning" | "info" | "improvement"  
- title: short title (max 8 words)
- message: actionable explanation (max 30 words)
- affectedEmployees: array of employee names (optional)

Respond in ${locale === 'ro' ? 'Romanian' : 'English'}.
Return only the JSON array, no other text.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('AI analysis failed:', response.statusText)
      return []
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''

    // Strip markdown code fences if present
    const clean = text.replace(/```json|```/g, '').trim()
    const suggestions: AISuggestion[] = JSON.parse(clean)

    return Array.isArray(suggestions) ? suggestions : []
  } catch (err) {
    console.error('AI analysis error:', err)
    return []
  }
}
