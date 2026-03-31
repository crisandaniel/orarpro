export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard/', '/api/'],
    },
    sitemap: 'https://www.orarpro.ro/sitemap.xml',
  }
}