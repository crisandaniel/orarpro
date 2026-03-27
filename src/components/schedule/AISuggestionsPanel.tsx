'use client'

// Sidebar panel showing Claude AI analysis results after schedule generation.
// Displays: warnings (burnout risk, understaffing), info, improvement suggestions.
// Populated only when schedule.ai_suggestions field is non-null.
// Used by: schedules/[id]/page.tsx.



import { AlertTriangle, Info, TrendingUp, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Suggestion {
  type: 'warning' | 'info' | 'improvement'
  title: string
  message: string
  affectedEmployees?: string[]
}

interface AISuggestionsPanelProps {
  suggestions: Suggestion[]
}

export function AISuggestionsPanel({ suggestions }: AISuggestionsPanelProps) {
  const icons = {
    warning: AlertTriangle,
    info: Info,
    improvement: TrendingUp,
  }

  const styles = {
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-900',
      icon: 'text-amber-600',
      title: 'text-amber-900 dark:text-amber-300',
      text: 'text-amber-700 dark:text-amber-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-900',
      icon: 'text-blue-600',
      title: 'text-blue-900 dark:text-blue-300',
      text: 'text-blue-700 dark:text-blue-400',
    },
    improvement: {
      bg: 'bg-green-50 dark:bg-green-950/20',
      border: 'border-green-200 dark:border-green-900',
      icon: 'text-green-600',
      title: 'text-green-900 dark:text-green-300',
      text: 'text-green-700 dark:text-green-400',
    },
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <Bot className="w-4 h-4 text-indigo-600" />
        <h3 className="font-medium text-sm">AI Suggestions</h3>
        <span className="ml-auto text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
          {suggestions.length}
        </span>
      </div>

      <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
        {suggestions.map((s, i) => {
          const Icon = icons[s.type]
          const style = styles[s.type]
          return (
            <div
              key={i}
              className={cn('p-3 rounded-lg border', style.bg, style.border)}
            >
              <div className="flex items-start gap-2">
                <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', style.icon)} />
                <div>
                  <p className={cn('text-xs font-medium', style.title)}>{s.title}</p>
                  <p className={cn('text-xs mt-0.5', style.text)}>{s.message}</p>
                  {s.affectedEmployees && s.affectedEmployees.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.affectedEmployees.map((emp) => (
                        <span key={emp} className="text-[10px] bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-current opacity-70">
                          {emp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
