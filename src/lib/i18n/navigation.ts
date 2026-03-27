// next-intl locale-aware navigation helpers.
// Use these instead of next/navigation when you need locale-prefixed URLs:
//   Link → locale-aware <a> tag
//   redirect() → locale-aware server-side redirect
//   usePathname() → pathname without locale prefix
//   useRouter() → locale-aware router
// Used by: any component needing locale-aware routing.

// n

import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
