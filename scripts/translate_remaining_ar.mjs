import fs from 'fs';

async function main() {
  const p = JSON.parse(fs.readFileSync('data/subtitles_project.json', 'utf-8'));
  const db = JSON.parse(fs.readFileSync('data/tracks_database.json', 'utf-8'));
  const enTrack = db.find((t) => t.language === 'en') || p;

  console.log(`Starting completion for ${enTrack.lines.length} lines...`);

  // Identify lines that still don't have Arabic characters
  const linesToTranslate = [];
  for (let i = 0; i < p.lines.length; i++) {
    const cur = p.lines[i];
    const isArabic = /[\u0600-\u06FF]/.test(cur.text);
    if (!isArabic) {
      // Use original English text from enTrack
      const orig = enTrack.lines[i] || cur;
      linesToTranslate.push({ index: i, lineNumber: orig.lineNumber, text: orig.text });
    }
  }

  console.log(`Need to translate ${linesToTranslate.length} remaining lines to Arabic.`);

  const BATCH_SIZE = 25;
  for (let i = 0; i < linesToTranslate.length; i += BATCH_SIZE) {
    const chunk = linesToTranslate.slice(i, i + BATCH_SIZE);
    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      attempts++;
      try {
        console.log(`Translating chunk ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(linesToTranslate.length / BATCH_SIZE)} (lines ${chunk[0].lineNumber}..${chunk[chunk.length - 1].lineNumber})...`);
        const res = await fetch('http://localhost:3000/api/translate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: chunk.map((c) => ({ lineNumber: c.lineNumber, text: c.text })),
            sourceLang: 'en',
            targetLang: 'ar',
            targetType: 'Normal',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.translatedLines && Array.isArray(data.translatedLines)) {
            const transMap = new Map(data.translatedLines.map((l) => [l.lineNumber, l.text]));
            for (const item of chunk) {
              const translatedText = transMap.get(item.lineNumber);
              if (translatedText) {
                p.lines[item.index].text = translatedText;
              }
            }
            success = true;
          }
        }
      } catch (err) {
        console.warn(`Attempt ${attempts} error:`, err?.message || err);
      }
      if (!success) {
        await new Promise((r) => setTimeout(r, 1000 * attempts));
      }
    }

    // Save progress after every chunk
    fs.writeFileSync('data/subtitles_project.json', JSON.stringify(p, null, 2), 'utf-8');
    console.log(`Saved progress: ${chunk[chunk.length - 1].lineNumber} lines done.`);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Also save the completed Arabic track into tracks_database.json!
  const arTrack = {
    id: 'beauty_and_the_beast_(1991)_feature film_theatrical release_standard_ar_normal',
    medium: 'Movie',
    title: 'Beauty and the Beast (1991)',
    season: 'Feature Film',
    episode: 'Theatrical Release',
    variant: 'Standard',
    language: 'ar',
    trackType: 'Normal',
    isPrimary: false,
    lines: p.lines,
    lastSavedAt: Date.now(),
    sourceFileName: 'Beauty and the Beast (1991).ar.srt',
  };

  const existingIdx = db.findIndex((t) => t.id === arTrack.id || (t.title.includes('Beauty') && t.language === 'ar' && t.trackType === 'Normal'));
  if (existingIdx >= 0) {
    db[existingIdx] = arTrack;
  } else {
    db.unshift(arTrack);
  }
  fs.writeFileSync('data/tracks_database.json', JSON.stringify(db, null, 2), 'utf-8');

  const finalArCount = p.lines.filter((l) => /[\u0600-\u06FF]/.test(l.text)).length;
  console.log(`FINISHED! All ${p.lines.length} lines processed. Arabic character count: ${finalArCount}/${p.lines.length}.`);
}

main().catch(console.error);
