// Генератор иконок «Графика приступов»: SVG -> PNG через sharp.
//
//   node scripts/generate-icons.mjs preview   — превью вариантов в out/
//   node scripts/generate-icons.mjs final A   — записать ассеты варианта A
//                                                прямо в assets/images/
//
// Зависимость sharp в package.json не входит (нужна только здесь):
//   npm i --no-save sharp
//
// Варианты (viewBox 1024, безопасная зона адаптивной иконки ~180..844 —
// края маскируются лаунчером):
//   A — EEG-линия с резким спайком и красным маркером над пиком (текущий)
//   B — карточка-календарь с графиком-спайком внутри
//
// Цвета согласованы с app.json: фон журнальной адаптивной иконки —
// INDIGO, фон иконки «Приступ» задаёт плагин activity-alias (RED).

import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;

try {
    sharp = (await import('sharp')).default;
} catch {
    console.error('Нужен sharp (в deps не входит): npm i --no-save sharp');
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = path.join(__dirname, '..');

const INDIGO = '#283593';
const RED = '#C62828';
const SIZE = 1024;

const svg = (body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

const strokeProps = (color, width) =>
    `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

// ——— Вариант A: EEG-спайк ————————————————————————————————————————
// Белая жирная линия с одним резким пиком; над пиком — красный маркер
// с белой обводкой, отделённый от линии зазором (на красном фоне
// иконки «Приступ» маркер читается как белое кольцо).
function glyphA(stroke, accent, ring) {
    return `
    <polyline points="150,650 250,650 302,560 354,650 428,650 512,400 596,650 670,650 722,560 774,650 874,650"
        ${strokeProps(stroke, 88)}/>
    <circle cx="512" cy="268" r="48" fill="${accent}" stroke="${ring}" stroke-width="16"/>`;
}

// ——— Вариант B: календарь с графиком ——————————————————————————————
// Белая карточка с пружинами сверху; внутри — симметричная линия
// со спайком цветом фона иконки + красная точка на пике.
function glyphB(card, ink, accent) {
    return `
    <rect x="348" y="226" width="52" height="120" rx="26" fill="${card}"/>
    <rect x="624" y="226" width="52" height="120" rx="26" fill="${card}"/>
    <rect x="232" y="288" width="560" height="470" rx="64" fill="${card}"/>
    <polyline points="322,650 382,650 417,585 452,650 472,650 512,415 552,650 572,650 607,585 642,650 702,650"
        ${strokeProps(ink, 46)}/>
    <circle cx="512" cy="415" r="34" fill="${accent}"/>`;
}

// На цветном фоне (адаптивная иконка журнала/«Приступа») — белые глифы.
// *_body — внутренности без <svg>-обёртки (для встраивания на подложку).
const VARIANTS = {
    A: {
        foregroundBody: () => glyphA('#ffffff', RED, '#ffffff'),
        // Сплэш на белом фоне — цветная версия глифа.
        splashBody: () => glyphA(INDIGO, RED, INDIGO),
    },
    B: {
        foregroundBody: () => glyphB('#ffffff', INDIGO, RED),
        splashBody: () => glyphB(INDIGO, '#ffffff', RED),
    },
};

// Квадрат с фоном и глифом одним SVG (без composite: он не нужен,
// когда фон можно нарисовать прямо в SVG).
const tile = (bg, body) =>
    svg(`<rect width="1024" height="1024" fill="${bg}"/>${body}`);

async function renderPng(svgString, out, size = SIZE) {
    await sharp(Buffer.from(svgString))
        .resize(size, size)
        .png()
        .toFile(out);
}

// Превью: каждый вариант на индиго (журнал) и красном («Приступ»)
// + цветная версия для сплэша на белом + legacy-квадрат, всё в одну сетку.
async function preview(outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const jobs = [];

    for (const [name, v] of Object.entries(VARIANTS)) {
        const tiles = [
            [`${name}_journal`, tile(INDIGO, v.foregroundBody())],
            [`${name}_quick`, tile(RED, v.foregroundBody())],
            [`${name}_legacy`, tile(INDIGO, v.foregroundBody())],
            [`${name}_splash`, tile('#ffffff', v.splashBody())],
        ];

        for (const [file, svgString] of tiles) {
            jobs.push(
                sharp(Buffer.from(svgString))
                    .resize(360, 360)
                    .png()
                    .toFile(path.join(outDir, `${file}.png`)),
            );
        }
    }

    await Promise.all(jobs);

    // Сетка: строки — варианты, столбцы — журнальная адаптивная,
    // «Приступ», legacy-квадрат, сплэш.
    const names = Object.keys(VARIANTS);
    const cols = ['journal', 'quick', 'legacy', 'splash'];
    const tileSize = 360;
    const gap = 24;
    const W = cols.length * tileSize + (cols.length + 1) * gap;
    const H = names.length * tileSize + (names.length + 1) * gap;

    const composites = [];

    for (const [r, n] of names.entries()) {
        for (const [c, col] of cols.entries()) {
            composites.push({
                input: path.join(outDir, `${n}_${col}.png`),
                left: gap + c * (tileSize + gap),
                top: gap + r * (tileSize + gap),
            });
        }
    }

    await sharp({
        create: { width: W, height: H, channels: 4, background: '#e2e8f0' },
    })
        .composite(composites)
        .png()
        .toFile(path.join(outDir, 'preview_grid.png'));

    console.log(`Превью: ${path.join(outDir, 'preview_grid.png')}`);
    console.log('Строки — варианты; столбцы: журнал, «Приступ», legacy-квадрат, сплэш.');
}

// Запись ассетов варианта в assets/images/ (те же имена, что в app.json).
async function finalAssets(variant, outDir) {
    const v = VARIANTS[variant];

    if (!v) {
        throw new Error(`Неизвестный вариант: ${variant}`);
    }

    fs.mkdirSync(outDir, { recursive: true });

    // 1. adaptive-icon.png — foreground-слой: прозрачный фон, глиф в
    //    безопасной зоне; он же — monochrome (тематические иконки).
    await renderPng(
        svg(v.foregroundBody()),
        path.join(outDir, 'adaptive-icon.png'),
    );

    // 2. icon.png — legacy/сторонние площадки: полный квадрат индиго,
    //    RGB без альфы.
    await sharp(Buffer.from(tile(INDIGO, v.foregroundBody())))
        .removeAlpha()
        .png()
        .toFile(path.join(outDir, 'icon.png'));

    // 3. splash-icon.png — цветная версия на прозрачном (сплэш-фон белый).
    await renderPng(
        svg(v.splashBody()),
        path.join(outDir, 'splash-icon.png'),
    );

    console.log(`Ассеты варианта ${variant} → ${outDir}`);
    console.log('Не забудьте: npx expo prebuild --platform android, чтобы пересоздать ресурсы.');
}

const [mode, variant] = process.argv.slice(2);

if (mode === 'preview') {
    await preview(path.join(MOBILE_ROOT, 'out', 'preview'));
} else if (mode === 'final') {
    await finalAssets(variant, path.join(MOBILE_ROOT, 'assets', 'images'));
} else {
    console.error(
        'Использование: node scripts/generate-icons.mjs preview | final <вариант>',
    );
    process.exit(1);
}
