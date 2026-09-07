const clean = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const xmlEscape = (v) => String(v ?? '').replace(/[<>&'\"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
const stripHtmlish = (v) => clean(v, 5000).replace(/\[\[image:[^\]]+\]\]/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const iso = (v) => { try { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); } catch { return ''; } };

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

function normalizedPath(req) {
  let p = req.path || '/';
  try { p = decodeURI(p); } catch {}
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

function pageConfig(pathname, settings, db) {
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const tagline = clean(settings.tagline || 'Prediksi Bola Hari Ini, Parlay & Taruhan Bola', 140);
  const generic = {
    title: `${site} - ${tagline}`,
    description: `${site} menyajikan prediksi bola hari ini, live score, jadwal dan hasil pertandingan, klasemen, berita sepak bola serta informasi parlay dalam Bahasa Indonesia.`,
    type: 'website',
    schemaType: 'WebPage',
    index: true
  };
  if (pathname === '/') return { ...generic, schemaType:'WebPage' };
  if (pathname === '/livescore') return { ...generic, title:`Live Score Bola Hari Ini & Jadwal Pertandingan | ${site}`, description:`Live score bola hari ini di ${site}: pantau skor langsung, jadwal pertandingan, hasil pertandingan dan informasi sepak bola terbaru.`, schemaType:'CollectionPage' };
  if (pathname === '/prediksi') return { ...generic, title:`Prediksi Bola Hari Ini, Parlay & Pertandingan | ${site}`, description:`Prediksi bola hari ini di ${site} dengan jadwal pertandingan, performa tim, statistik dan informasi parlay sepak bola terbaru.`, schemaType:'CollectionPage' };
  if (pathname.startsWith('/prediksi/')) return { ...generic, title:`Prediksi Pertandingan Bola Hari Ini | ${site}`, description:`Prediksi dan informasi pertandingan sepak bola hari ini di ${site}, lengkap dengan statistik dan performa tim.`, schemaType:'WebPage' };
  if (pathname === '/klasemen') return { ...generic, title:`Klasemen Sepak Bola Terbaru & Liga Dunia | ${site}`, description:`Klasemen sepak bola terbaru di ${site}, termasuk informasi posisi tim dan kompetisi liga sepak bola populer.`, schemaType:'CollectionPage' };
  if (pathname === '/berita') return { ...generic, title:`Berita Bola Hari Ini & Sepak Bola Terbaru | ${site}`, description:`Berita bola hari ini dan informasi sepak bola terbaru di ${site}, mencakup pertandingan, liga, tim dan perkembangan sepak bola.`, schemaType:'CollectionPage' };
  if (pathname === '/highlights') return { ...generic, title:`Highlight Bola & Cuplikan Pertandingan Terbaru | ${site}`, description:`Highlight bola dan cuplikan pertandingan sepak bola terbaru di ${site}.`, schemaType:'CollectionPage' };
  if (pathname.startsWith('/article/')) {
    const slug = decodeURIComponent(pathname.slice('/article/'.length));
    const a = (db.articles || []).find(x => String(x.slug || x.id) === slug && x.status === 'published');
    if (a) return {
      ...generic,
      title: `${clean(a.title, 180)} | ${site}`,
      description: clean(a.excerpt || stripHtmlish(a.content), 220) || generic.description,
      image: a.image || '',
      type: 'article',
      schemaType: 'NewsArticle',
      article: a,
      index: true
    };
    return { ...generic, title:`Artikel | ${site}`, type:'article', schemaType:'WebPage', index:false };
  }
  if (pathname.startsWith('/highlight/')) return { ...generic, title:`Highlight Pertandingan Bola | ${site}`, type:'video.other', schemaType:'VideoObject' };
  if (pathname.startsWith('/match/') || pathname.startsWith('/detail/')) return { ...generic, title:`Detail Pertandingan Bola | ${site}`, description:`Detail pertandingan sepak bola di ${site}: skor, statistik dan informasi pertandingan.`, schemaType:'WebPage' };
  if (pathname.startsWith('/widget/score/')) return { ...generic, index:false };
  if (['/login','/register','/profile','/admin','/health'].includes(pathname)) return { ...generic, index:false };
  return { ...generic, index:false };
}

function breadcrumbFor(base, pathname, cfg, site) {
  if (pathname === '/') return null;
  const names = {
    '/livescore':'Live Score', '/prediksi':'Prediksi Bola', '/klasemen':'Klasemen', '/berita':'Berita Bola', '/highlights':'Highlight'
  };
  const items = [{ '@type':'ListItem', position:1, name:site, item:`${base}/` }];
  let parent = '';
  if (pathname.startsWith('/article/')) parent = '/berita';
  else if (pathname.startsWith('/prediksi/')) parent = '/prediksi';
  else if (pathname.startsWith('/highlight/')) parent = '/highlights';
  else if (pathname.startsWith('/match/') || pathname.startsWith('/detail/')) parent = '/livescore';
  if (parent) items.push({ '@type':'ListItem', position:2, name:names[parent] || parent.slice(1), item:`${base}${parent}` });
  items.push({ '@type':'ListItem', position:items.length + 1, name:clean(cfg.article?.title || names[pathname] || cfg.title.split('|')[0], 150), item:`${base}${pathname}` });
  return { '@type':'BreadcrumbList', '@id':`${base}${pathname}#breadcrumb`, itemListElement:items };
}

export function buildSeo(req, settings, db, statusCode = 200) {
  const base = siteBase(req);
  const pathname = normalizedPath(req);
  const cfg = pageConfig(pathname, settings, db);
  const canonical = `${base}${pathname === '/' ? '/' : pathname}`;
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const image = absoluteUrl(base, cfg.image || settings.logo || '/omtogel-logo.svg');
  const noindex = statusCode >= 400 || cfg.index === false;
  const robots = noindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const graph = [];
  const orgId = `${base}/#organization`, websiteId = `${base}/#website`, pageId = `${canonical}#webpage`;

  graph.push({
    '@type':'Organization', '@id':orgId, name:site, url:`${base}/`,
    logo:{ '@type':'ImageObject', '@id':`${base}/#logo`, url:absoluteUrl(base, settings.logo || '/omtogel-logo.svg') }
  });
  graph.push({
    '@type':'WebSite', '@id':websiteId, url:`${base}/`, name:site, inLanguage:'id-ID', publisher:{'@id':orgId}
  });

  if (!noindex) {
    if (cfg.article) {
      const a = cfg.article;
      const published = iso(a.publishedAt || a.createdAt);
      const modified = iso(a.updatedAt || a.publishedAt || a.createdAt);
      const article = {
        '@type':'NewsArticle', '@id':`${canonical}#article`, mainEntityOfPage:{'@id':pageId},
        headline:clean(a.title, 220), description:cfg.description, image:[image], inLanguage:'id-ID',
        isAccessibleForFree:true, publisher:{'@id':orgId}
      };
      if (published) article.datePublished = published;
      if (modified) article.dateModified = modified;
      const author = clean(a.author || '', 120);
      article.author = author ? {'@type':'Person',name:author} : {'@id':orgId};
      graph.push(article);
      graph.push({
        '@type':'WebPage', '@id':pageId, url:canonical, name:cfg.title, description:cfg.description,
        inLanguage:'id-ID', isPartOf:{'@id':websiteId}, primaryImageOfPage:{'@type':'ImageObject',url:image}, mainEntity:{'@id':`${canonical}#article`}
      });
    } else {
      graph.push({
        '@type':cfg.schemaType || 'WebPage', '@id':pageId, url:canonical, name:cfg.title, description:cfg.description,
        inLanguage:'id-ID', isPartOf:{'@id':websiteId}, about:{'@type':'Thing',name:'Sepak bola'}
      });
    }
    const breadcrumb = breadcrumbFor(base, pathname, cfg, site);
    if (breadcrumb) graph.push(breadcrumb);
  }

  const jsonLd = graph.length ? JSON.stringify({ '@context':'https://schema.org', '@graph':graph }).replace(/</g, '\\u003c') : '';
  return {
    ...cfg, canonical, image, robots, noindex, jsonLd,
    locale:'id_ID', htmlLang:'id-ID', contentLanguage:'id-ID', siteName:site,
    sitemapUrl:`${base}/sitemap.xml`, newsSitemapUrl:`${base}/sitemap-news.xml`
  };
}

export function sitemapXml(req, settings, db) {
  const base = siteBase(req);
  const rows = [
    ['/', '1.0', 'daily'], ['/livescore', '0.9', 'hourly'], ['/prediksi', '0.9', 'daily'],
    ['/klasemen', '0.8', 'daily'], ['/berita', '0.9', 'daily'], ['/highlights', '0.8', 'daily']
  ].map(([path, priority, changefreq]) => ({ loc:`${base}${path}`, priority, changefreq }));
  for (const a of (db.articles || []).filter(x => x.status === 'published')) {
    const slug = clean(a.slug || a.id, 300);
    if (!slug) continue;
    rows.push({
      loc:`${base}/article/${encodeURIComponent(slug)}`,
      lastmod:iso(a.updatedAt || a.publishedAt || a.createdAt),
      priority:'0.8', changefreq:'weekly', image:a.image ? absoluteUrl(base, a.image, '/omtogel-logo.svg') : ''
    });
  }
  const body = rows.map(x => {
    const lines = [`  <url>`, `    <loc>${xmlEscape(x.loc)}</loc>`];
    if (x.lastmod) lines.push(`    <lastmod>${xmlEscape(x.lastmod)}</lastmod>`);
    lines.push(`    <changefreq>${x.changefreq}</changefreq>`, `    <priority>${x.priority}</priority>`);
    if (x.image) lines.push(`    <image:image><image:loc>${xmlEscape(x.image)}</image:loc></image:image>`);
    lines.push(`  </url>`);
    return lines.join('\n');
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}

export function newsSitemapXml(req, settings, db) {
  const base = siteBase(req);
  const site = clean(settings.siteName || 'OMTOGEL', 80);
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const rows = (db.articles || []).filter(a => {
    if (a.status !== 'published') return false;
    const d = new Date(a.publishedAt || a.createdAt || 0).getTime();
    return Number.isFinite(d) && d >= cutoff;
  }).slice(0, 1000);
  const body = rows.map(a => {
    const slug = clean(a.slug || a.id, 300), published = iso(a.publishedAt || a.createdAt);
    if (!slug || !published) return '';
    return `  <url>\n    <loc>${xmlEscape(`${base}/article/${encodeURIComponent(slug)}`)}</loc>\n    <news:news>\n      <news:publication><news:name>${xmlEscape(site)}</news:name><news:language>id</news:language></news:publication>\n      <news:publication_date>${xmlEscape(published)}</news:publication_date>\n      <news:title>${xmlEscape(clean(a.title, 220))}</news:title>\n    </news:news>\n  </url>`;
  }).filter(Boolean).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(req) {
  const base = siteBase(req);
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /login\nDisallow: /register\nDisallow: /profile\nDisallow: /widget/score/\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Googlebot-Image\nAllow: /\n\nSitemap: ${base}/sitemap.xml\nSitemap: ${base}/sitemap-news.xml\n`;
}
