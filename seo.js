const clean = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const xmlEscape = (v) => String(v ?? '').replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
const stripHtmlish = (v) => clean(v, 1000).replace(/\[\[image:[^\]]+\]\]/g, ' ').replace(/\s+/g, ' ').trim();

export function siteBase(req) {
  const configured = clean(process.env.SITE_URL || '', 500).replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || 'localhost';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function absoluteUrl(base, value, fallback = '/favicon.svg') {
  const raw = clean(value || fallback, 1500);
  try { return new URL(raw, base + '/').href; } catch { return new URL(fallback, base + '/').href; }
}

function pageConfig(pathname, settings, db) {
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const generic = {
    title: `${site} - ${clean(settings.tagline || 'Sports Center', 120)}`,
    description: 'Live score, streaming, prediksi, klasemen dan berita bola terbaru.',
    type: 'website',
    index: true
  };
  if (pathname === '/') return generic;
  if (pathname === '/livescore') return { ...generic, title: `Live Score Sepak Bola | ${site}`, description: 'Live score sepak bola, jadwal pertandingan dan hasil pertandingan terbaru.', type: 'website' };
  if (pathname === '/prediksi') return { ...generic, title: `Prediksi Sepak Bola | ${site}`, description: 'Prediksi pertandingan sepak bola dengan jadwal dan informasi pertandingan terbaru.', type: 'website' };
  if (pathname.startsWith('/prediksi/')) return { ...generic, title: `Prediksi Pertandingan | ${site}`, description: 'Prediksi dan informasi pertandingan sepak bola.', type: 'article' };
  if (pathname === '/klasemen') return { ...generic, title: `Klasemen Sepak Bola | ${site}`, description: 'Klasemen kompetisi sepak bola dan informasi liga terbaru.', type: 'website' };
  if (pathname === '/berita') return { ...generic, title: `Berita Olahraga | ${site}`, description: 'Berita olahraga dan sepak bola terbaru.', type: 'website' };
  if (pathname === '/highlights') return { ...generic, title: `Highlight Pertandingan | ${site}`, description: 'Highlight dan cuplikan pertandingan sepak bola terbaru.', type: 'website' };
  if (pathname.startsWith('/article/')) {
    const slug = decodeURIComponent(pathname.slice('/article/'.length));
    const a = (db.articles || []).find(x => String(x.slug || x.id) === slug && x.status === 'published');
    if (a) return {
      ...generic,
      title: `${clean(a.title, 180)} | ${site}`,
      description: clean(a.excerpt || stripHtmlish(a.content), 220) || generic.description,
      image: a.image || '',
      type: 'article',
      article: a,
      index: true
    };
    return { ...generic, title: `Artikel | ${site}`, type: 'article', index: false };
  }
  if (pathname.startsWith('/highlight/')) return { ...generic, title: `Highlight Pertandingan | ${site}`, type: 'video.other' };
  if (pathname.startsWith('/match/') || pathname.startsWith('/detail/')) return { ...generic, title: `Detail Pertandingan | ${site}`, description: 'Detail pertandingan sepak bola, skor, statistik dan informasi pertandingan.', type: 'website' };
  if (pathname.startsWith('/widget/score/')) return { ...generic, index: false };
  if (['/login','/register','/profile','/admin','/health'].includes(pathname)) return { ...generic, index: false };
  return { ...generic, index: false };
}

export function buildSeo(req, settings, db, statusCode = 200) {
  const base = siteBase(req);
  const pathname = req.path || '/';
  const cfg = pageConfig(pathname, settings, db);
  const canonical = `${base}${pathname === '/' ? '/' : pathname}`;
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const image = absoluteUrl(base, cfg.image || settings.logo || '/omtogel-logo.svg');
  const noindex = statusCode >= 400 || cfg.index === false;
  const robots = noindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const graph = [];
  if (pathname === '/') {
    graph.push({ '@type':'WebSite', '@id':`${base}/#website`, url:`${base}/`, name:site, inLanguage:'id-ID' });
    graph.push({ '@type':'Organization', '@id':`${base}/#organization`, name:site, url:`${base}/`, logo:{ '@type':'ImageObject', url:image } });
  } else if (cfg.article) {
    const a = cfg.article;
    graph.push({
      '@type':'Article', '@id':`${canonical}#article`, mainEntityOfPage:{'@type':'WebPage','@id':canonical},
      headline:clean(a.title, 220), description:cfg.description, image:[image],
      datePublished:a.publishedAt || a.createdAt || undefined, dateModified:a.updatedAt || a.publishedAt || a.createdAt || undefined,
      author:{'@type':'Person',name:clean(a.author || site, 120)}, publisher:{'@id':`${base}/#organization`}, inLanguage:'id-ID'
    });
    graph.push({ '@type':'Organization', '@id':`${base}/#organization`, name:site, url:`${base}/`, logo:{ '@type':'ImageObject', url:absoluteUrl(base, settings.logo || '/omtogel-logo.svg') } });
  } else if (!noindex) {
    graph.push({ '@type':'WebPage', '@id':`${canonical}#webpage`, url:canonical, name:cfg.title, description:cfg.description, inLanguage:'id-ID', isPartOf:{'@id':`${base}/#website`} });
    graph.push({ '@type':'WebSite', '@id':`${base}/#website`, url:`${base}/`, name:site, inLanguage:'id-ID' });
  }
  const jsonLd = graph.length ? JSON.stringify({ '@context':'https://schema.org', '@graph':graph }).replace(/</g, '\\u003c') : '';
  return { ...cfg, canonical, image, robots, noindex, jsonLd, locale:'id_ID', siteName:site };
}

export function sitemapXml(req, settings, db) {
  const base = siteBase(req);
  const now = new Date().toISOString();
  const rows = [
    ['/', '1.0', 'daily'], ['/livescore', '0.9', 'hourly'], ['/prediksi', '0.9', 'daily'],
    ['/klasemen', '0.8', 'daily'], ['/berita', '0.9', 'daily'], ['/highlights', '0.8', 'daily']
  ].map(([path, priority, changefreq]) => ({ loc:`${base}${path}`, lastmod:now, priority, changefreq }));
  for (const a of (db.articles || []).filter(x => x.status === 'published')) {
    const slug = clean(a.slug || a.id, 300);
    if (!slug) continue;
    rows.push({ loc:`${base}/article/${encodeURIComponent(slug)}`, lastmod:a.updatedAt || a.publishedAt || a.createdAt || now, priority:'0.8', changefreq:'weekly' });
  }
  const body = rows.map(x => `  <url>\n    <loc>${xmlEscape(x.loc)}</loc>\n    <lastmod>${xmlEscape(new Date(x.lastmod).toISOString())}</lastmod>\n    <changefreq>${x.changefreq}</changefreq>\n    <priority>${x.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(req) {
  const base = siteBase(req);
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /login\nDisallow: /register\nDisallow: /profile\nDisallow: /widget/score/\n\nSitemap: ${base}/sitemap.xml\n`;
}
