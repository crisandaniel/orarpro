// useDebounce — delays executing a callback until after `delay` ms of inactivity.
// Usage: const debouncedSave = useDebounce((data) => apiUpdate(...), 1500)
// Used by: ResourcesClient, EmployeeList, any inline-edit table.

import { useRef, useCallback } from 'react'

export function useDebounce<T extends (...args: any[]) => void>(
  fn: T,
  delay = 1500
): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay]) as T
}