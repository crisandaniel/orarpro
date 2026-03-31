export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'],  // ← trailing slash e mai corect
    },
    sitemap: 'https://www.orarpro.ro/sitemap.xml',
  }
}