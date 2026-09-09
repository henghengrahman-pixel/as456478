const clean = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const xmlEscape = (v) => String(v ?? '').replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
const stripHtmlish = (v) => clean(v, 5000)
  .replace(/\[\[image:[^\]]+\]\]/g, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const safeDate = (v) => {
  const d = new Date(v || '');
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};
const slugPart = (v) => encodeURIComponent(clean(v, 300));

export function siteBase(req) {
  const configured = clean(process.env.SITE_URL || '', 500).replace(/\/+$/, '');
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host') || 'localhost';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function absoluteUrl(base, value, fallback = '/favicon.svg') {
  const raw = clean(value || fallback, 1500);
  try { return new URL(raw, base + '/').href; }
  catch { return new URL(fallback, base + '/').href; }
}

function normalizedPath(req) {
  let p = clean(req.path || '/', 1500) || '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (p !== '/') p = p.replace(/\/+$/, '');
  return p;
}

function findArticle(pathname, db) {
  if (!pathname.startsWith('/article/')) return null;
  let slug = pathname.slice('/article/'.length);
  try { slug = decodeURIComponent(slug); } catch {}
  return (db.articles || []).find(x => String(x.slug || x.id) === slug && x.status === 'published') || null;
}

function pairSlug(a, b) {
  const norm = s => clean(s, 160).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${norm(a)}-vs-${norm(b)}`;
}

function findMatch(pathname, db) {
  if (!pathname.startsWith('/match/') && !pathname.startsWith('/detail/')) return null;
  let key = pathname.split('/').slice(2).join('/');
  try { key = decodeURIComponent(key); } catch {}
  const rows = (db.streams || []).filter(Boolean);
  return rows.find(x => String(x.id || '') === key || String(x.fixtureId || '') === key || pairSlug(x.homeName, x.awayName) === key) || null;
}

function findHighlight(pathname, db) {
  if (!pathname.startsWith('/highlight/')) return null;
  let key = pathname.slice('/highlight/'.length);
  try { key = decodeURIComponent(key); } catch {}
  return (db.highlights || []).find(x => String(x.slug || x.id) === key && x.active !== false) || null;
}

function pageConfig(pathname, settings, db) {
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const tagline = clean(settings.tagline || 'Prediksi Bola Hari Ini, Parlay & Taruhan Bola', 120);
  const generic = {
    title: `${site} | ${tagline}`,
    description: `${site} menghadirkan prediksi bola hari ini, informasi parlay, live score, jadwal pertandingan, klasemen dan berita sepak bola terbaru.`,
    type: 'website',
    index: true,
    schemaType: 'WebPage'
  };
  if (pathname === '/') return { ...generic, schemaType: 'WebPage' };
  if (pathname === '/livescore') return { ...generic, title: `Live Score Bola Hari Ini & Jadwal Pertandingan | ${site}`, description: `Pantau live score bola hari ini, jadwal, hasil pertandingan dan informasi sepak bola terbaru bersama ${site}.`, schemaType: 'CollectionPage' };
  if (pathname === '/prediksi') return { ...generic, title: `Prediksi Bola Hari Ini, Parlay & Analisis Pertandingan | ${site}`, description: `Prediksi bola hari ini, informasi parlay, jadwal dan analisis pertandingan sepak bola terbaru di ${site}.`, schemaType: 'CollectionPage' };
  if (pathname === '/odds') return { ...generic, title: `Odds Pertandingan Sepak Bola Realtime | ${site}`, description: `Lihat odds pertandingan sepak bola realtime, 1X2, handicap dan over under yang tersedia di ${site}.`, schemaType: 'CollectionPage' };
  if (pathname.startsWith('/prediksi/')) return { ...generic, title: `Prediksi Pertandingan Bola Hari Ini | ${site}`, description: `Prediksi dan informasi pertandingan sepak bola terbaru di ${site}.`, type: 'article', schemaType: 'WebPage' };
  if (pathname === '/klasemen') return { ...generic, title: `Klasemen Sepak Bola Terbaru Hari Ini | ${site}`, description: `Klasemen liga sepak bola terbaru, posisi tim dan informasi kompetisi terkini di ${site}.`, schemaType: 'CollectionPage' };
  if (pathname === '/berita') return { ...generic, title: `Berita Bola Terbaru Hari Ini Indonesia | ${site}`, description: `Berita bola terbaru hari ini, informasi pertandingan, liga dan sepak bola terkini di ${site}.`, schemaType: 'CollectionPage' };
  if (pathname === '/highlights') return { ...generic, title: `Highlight Bola & Cuplikan Pertandingan Terbaru | ${site}`, description: `Tonton highlight bola dan cuplikan pertandingan sepak bola terbaru di ${site}.`, schemaType: 'CollectionPage' };

  const article = findArticle(pathname, db);
  if (pathname.startsWith('/article/')) {
    if (article) return {
      ...generic,
      title: `${clean(article.title, 180)} | ${site}`,
      description: clean(article.excerpt || stripHtmlish(article.content), 220) || generic.description,
      image: article.image || article.cover || '',
      type: 'article',
      schemaType: 'NewsArticle',
      article,
      index: true
    };
    return { ...generic, title: `Artikel | ${site}`, type: 'article', index: false };
  }

  const match = findMatch(pathname, db);
  if (pathname.startsWith('/match/') || pathname.startsWith('/detail/')) {
    if (match) {
      const home = clean(match.homeName || 'Tim Tuan Rumah', 120), away = clean(match.awayName || 'Tim Tamu', 120);
      return { ...generic, title: `${home} vs ${away} - Jadwal, Skor & Informasi | ${site}`, description: `${home} vs ${away}: jadwal, live score dan informasi pertandingan sepak bola di ${site}.`, type: 'website', schemaType: 'SportsEvent', match };
    }
    return { ...generic, title: `Detail Pertandingan Bola | ${site}`, description: `Detail pertandingan sepak bola, skor, statistik dan informasi pertandingan di ${site}.`, schemaType: 'WebPage' };
  }

  const highlight = findHighlight(pathname, db);
  if (pathname.startsWith('/highlight/')) {
    return { ...generic, title: `${clean(highlight?.title || 'Highlight Pertandingan', 180)} | ${site}`, description: `Highlight dan cuplikan pertandingan sepak bola terbaru di ${site}.`, image: highlight?.image || '', type: 'video.other', schemaType: highlight ? 'VideoObject' : 'WebPage', highlight };
  }

  if (pathname.startsWith('/widget/score/')) return { ...generic, index: false };
  if (['/login','/register','/profile','/admin','/health'].includes(pathname)) return { ...generic, index: false };
  return { ...generic, index: false };
}

function breadcrumb(base, site, pathname, currentName) {
  const list = [{ '@type':'ListItem', position:1, name:site, item:`${base}/` }];
  const parentMap = [
    ['/article/', 'Berita', '/berita'],
    ['/prediksi/', 'Prediksi', '/prediksi'],
    ['/highlight/', 'Highlight', '/highlights'],
    ['/match/', 'Live Score', '/livescore'],
    ['/detail/', 'Live Score', '/livescore']
  ];
  const parent = parentMap.find(([prefix]) => pathname.startsWith(prefix));
  if (parent) list.push({ '@type':'ListItem', position:2, name:parent[1], item:`${base}${parent[2]}` });
  if (pathname !== '/') list.push({ '@type':'ListItem', position:list.length + 1, name:currentName, item:`${base}${pathname}` });
  if (list.length < 2) return null;
  return { '@type':'BreadcrumbList', itemListElement:list };
}

export function buildSeo(req, settings, db, statusCode = 200) {
  const base = siteBase(req);
  const pathname = normalizedPath(req);
  const cfg = pageConfig(pathname, settings, db);
  const canonical = `${base}${pathname === '/' ? '/' : pathname}`;
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const logo = absoluteUrl(base, settings.logo || '/omtogel-logo.svg');
  const image = absoluteUrl(base, cfg.image || settings.logo || '/omtogel-logo.svg');
  const noindex = statusCode >= 400 || cfg.index === false;
  const robots = noindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const graph = [];

  graph.push({ '@type':'Organization', '@id':`${base}/#organization`, name:site, url:`${base}/`, logo:{ '@type':'ImageObject', '@id':`${base}/#logo`, url:logo, contentUrl:logo }, image:{ '@id':`${base}/#logo` } });
  graph.push({ '@type':'WebSite', '@id':`${base}/#website`, url:`${base}/`, name:site, publisher:{ '@id':`${base}/#organization` }, inLanguage:'id-ID' });

  if (!noindex) {
    const webPage = {
      '@type': cfg.schemaType === 'CollectionPage' ? 'CollectionPage' : 'WebPage',
      '@id':`${canonical}#webpage`,
      url:canonical,
      name:cfg.title,
      description:cfg.description,
      inLanguage:'id-ID',
      isPartOf:{ '@id':`${base}/#website` },
      about:{ '@id':`${base}/#organization` },
      primaryImageOfPage:{ '@type':'ImageObject', url:image }
    };
    graph.push(webPage);

    if (cfg.article) {
      const a = cfg.article;
      const published = safeDate(a.publishedAt || a.createdAt);
      const modified = safeDate(a.updatedAt || a.publishedAt || a.createdAt);
      graph.push({
        '@type':'NewsArticle', '@id':`${canonical}#article`, mainEntityOfPage:{ '@id':`${canonical}#webpage` },
        headline:clean(a.title, 220), description:cfg.description, image:[image],
        ...(published ? { datePublished:published } : {}), ...(modified ? { dateModified:modified } : {}),
        author:{ '@type':'Organization', name:clean(a.author || site, 120), url:`${base}/` },
        publisher:{ '@id':`${base}/#organization` }, inLanguage:'id-ID', isAccessibleForFree:true
      });
    }

    if (cfg.match) {
      const m = cfg.match, start = safeDate(m.kickoff || m.date || m.startTime);
      graph.push({
        '@type':'SportsEvent', '@id':`${canonical}#event`, name:`${clean(m.homeName,120)} vs ${clean(m.awayName,120)}`,
        url:canonical, ...(start ? { startDate:start } : {}),
        eventStatus:'https://schema.org/EventScheduled',
        sport:'Sepak Bola',
        homeTeam:{ '@type':'SportsTeam', name:clean(m.homeName,120) },
        awayTeam:{ '@type':'SportsTeam', name:clean(m.awayName,120) },
        organizer:{ '@id':`${base}/#organization` }
      });
    }

    if (cfg.highlight) {
      const h = cfg.highlight, uploadDate = safeDate(h.date || h.createdAt || h.updatedAt);
      graph.push({
        '@type':'VideoObject', '@id':`${canonical}#video`, name:clean(h.title || cfg.title,180), description:cfg.description,
        thumbnailUrl:[image], ...(uploadDate ? { uploadDate } : {}), url:canonical,
        ...(h.url ? { contentUrl:absoluteUrl(base,h.url,'/highlights') } : {}), inLanguage:'id-ID'
      });
    }

    const bc = breadcrumb(base, site, pathname, cfg.article?.title || (cfg.match ? `${clean(cfg.match.homeName,80)} vs ${clean(cfg.match.awayName,80)}` : cfg.title));
    if (bc) graph.push(bc);
  }

  const jsonLd = JSON.stringify({ '@context':'https://schema.org', '@graph':graph }).replace(/</g, '\\u003c');
  return {
    ...cfg, canonical, image, logo, robots, noindex, jsonLd,
    locale:'id_ID', language:'id-ID', siteName:site,
    publishedTime: cfg.article ? safeDate(cfg.article.publishedAt || cfg.article.createdAt) : '',
    modifiedTime: cfg.article ? safeDate(cfg.article.updatedAt || cfg.article.publishedAt || cfg.article.createdAt) : ''
  };
}

function pageRows(req, settings, db) {
  const base = siteBase(req);
  const now = new Date().toISOString();
  const rows = [
    ['/', '1.0', 'daily'], ['/livescore', '0.9', 'hourly'], ['/odds', '0.9', 'hourly'], ['/prediksi', '0.9', 'daily'],
    ['/klasemen', '0.8', 'daily'], ['/berita', '0.9', 'daily'], ['/highlights', '0.8', 'daily']
  ].map(([path, priority, changefreq]) => ({ loc:`${base}${path}`, lastmod:now, priority, changefreq }));
  for (const a of (db.articles || []).filter(x => x.status === 'published')) {
    const slug = clean(a.slug || a.id, 300); if (!slug) continue;
    rows.push({ loc:`${base}/article/${slugPart(slug)}`, lastmod:safeDate(a.updatedAt || a.publishedAt || a.createdAt) || now, priority:'0.8', changefreq:'weekly' });
  }
  return rows;
}

export function sitemapXml(req, settings, db) {
  const rows = pageRows(req, settings, db);
  const body = rows.map(x => `  <url>\n    <loc>${xmlEscape(x.loc)}</loc>\n    <lastmod>${xmlEscape(x.lastmod)}</lastmod>\n    <changefreq>${x.changefreq}</changefreq>\n    <priority>${x.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function newsSitemapXml(req, settings, db) {
  const base = siteBase(req), site = clean(settings.siteName || 'OMTOGEL', 80), cutoff = Date.now() - 2 * 86400000;
  const items = (db.articles || []).filter(a => {
    if (a.status !== 'published') return false;
    const d = new Date(a.publishedAt || a.createdAt || '');
    return !Number.isNaN(d.getTime()) && d.getTime() >= cutoff && d.getTime() <= Date.now() + 300000;
  }).slice(0, 1000);
  const body = items.map(a => {
    const slug = clean(a.slug || a.id,300), d = safeDate(a.publishedAt || a.createdAt), title = clean(a.title,220);
    if (!slug || !d || !title) return '';
    return `  <url>\n    <loc>${xmlEscape(`${base}/article/${slugPart(slug)}`)}</loc>\n    <news:news>\n      <news:publication><news:name>${xmlEscape(site)}</news:name><news:language>id</news:language></news:publication>\n      <news:publication_date>${xmlEscape(d)}</news:publication_date>\n      <news:title>${xmlEscape(title)}</news:title>\n    </news:news>\n  </url>`;
  }).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>\n`;
}

export function imageSitemapXml(req, settings, db) {
  const base = siteBase(req), rows = [];
  const push = (loc, img, title='') => {
    if (!img) return;
    rows.push({ loc, img:absoluteUrl(base,img,'/omtogel-logo.svg'), title:clean(title,220) });
  };
  push(`${base}/`, settings.logo || '/omtogel-logo.svg', settings.siteName || 'OMTOGEL');
  for (const a of (db.articles || []).filter(x => x.status === 'published')) {
    const slug=clean(a.slug||a.id,300), img=a.image||a.cover;
    if (slug && img) push(`${base}/article/${slugPart(slug)}`, img, a.title);
  }
  const body = rows.map(x => `  <url>\n    <loc>${xmlEscape(x.loc)}</loc>\n    <image:image>\n      <image:loc>${xmlEscape(x.img)}</image:loc>${x.title?`\n      <image:title>${xmlEscape(x.title)}</image:title>`:''}\n    </image:image>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}

export function robotsTxt(req) {
  const base = siteBase(req);
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /api/\n\nUser-agent: Googlebot-Image\nAllow: /\n\nSitemap: ${base}/sitemap.xml\nSitemap: ${base}/sitemap-news.xml\nSitemap: ${base}/sitemap-images.xml\n`;
}
