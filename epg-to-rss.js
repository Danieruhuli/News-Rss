const fetch = require('node-fetch');
const fs = require('fs');
const { parseStringPromise } = require('xml2js');
const { Builder } = require('xml2js');
const path = require('path');

const EPG_URL = 'https://www.open-epg.com/generate/qzWgTkEjFi.xml';
const OUTPUT = path.join('docs', 'Rss', 'TokyoJoshiPro.xml');

(async () => {
  try {
    console.log('📥 Descargando EPG...');
    const response = await fetch(EPG_URL);
    let xml = await response.text();

    // 🔹 Limpiar caracteres invisibles y problemáticos
    xml = xml.replace(/\u3000/g, ''); // elimina espacio japonés de ancho completo
    xml = xml.replace(/\r?\n|\r/g, ''); // elimina saltos de línea extra

    console.log('📑 Parseando XML...');
    const result = await parseStringPromise(xml);

    const programmes = result.tv.programme || [];
    console.log(`🔎 Total de programas en EPG: ${programmes.length}`);

    // Filtrar solo los programas que contengan "東京女子プロレス" en el título
    const filtered = programmes.filter(p => {
      const title = p.title?.[0] || '';
      return title.includes('東京女子プロレス');
    });

    console.log(`✅ Programas filtrados: ${filtered.length}`);

    // Limitar a máximo 30 items
    const limited = filtered.slice(0, 30);

    const items = limited.map(p => {
      const title = p.title?.[0] || 'Sin título';
      const desc = p.desc?.[0] || 'Sin descripción';
      const channel = p.$.channel || 'Desconocido';

      // Parsear fecha de inicio y convertir a formato RSS (UTC)
      const start = p.$.start?.slice(0, 14); // YYYYMMDDHHMMSS
      let pubDate = '';
      let jstString = '';
      if (start) {
        const year = start.slice(0, 4);
        const month = start.slice(4, 6);
        const day = start.slice(6, 8);
        const hour = start.slice(8, 10);
        const minute = start.slice(10, 12);
        const second = start.slice(12, 14);
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
        pubDate = date.toUTCString(); // esto sigue en UTC para el campo <pubDate>
        // 🔹 Convertir a hora de Japón (+9)
        const jstDate = new Date(date.getTime() + 0 * 60 * 60 * 1000);
        jstString = jstDate.toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        });
      }

      return {
        title: title,
        link: 'https://tvguide.myjcom.jp/', // no hay link directo, ponemos placeholder
        guid: title + start,
        pubDate: pubDate,
        description: `⏰ ${jstString} (JST)  | 📺 Canal: ${channel}\n\n${desc}`,
      };
    });

    // Construir RSS
    const rssObj = {
      rss: {
        $: { version: '2.0' },
        channel: [
          {
            title: 'Tokyo Joshi Pro EPG Feed',
            link: 'https://tvguide.myjcom.jp/',
            description: 'Programas de 東京女子プロレス',
            language: 'ja',
            item: items.map(it => ({
              title: it.title,
              link: it.link,
              guid: it.guid,
              pubDate: it.pubDate,
              description: it.description,
            })),
          },
        ],
      },
    };

    const builder = new Builder({ headless: true });
    const rssXml = builder.buildObject(rssObj);

    // Crear carpeta docs/Rss si no existe
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

    fs.writeFileSync(OUTPUT, rssXml, 'utf8');
    console.log(`🎉 RSS generado en: ${OUTPUT}`);
  } catch (err) {
    console.error('❌ Error:', err);
  }
})();
