import fs from 'node:fs';
import path from 'node:path';

import { AndroidConfig } from 'expo/config-plugins';
import {
    withAndroidManifest,
    withDangerousMod,
    withMainActivity,
} from 'expo/config-plugins';
import type { ConfigPlugin } from 'expo/config-plugins';

export interface ActivityAliasPluginProps {
    /** Фон второй адаптивной иконки, напр. '#C62828'. */
    iconBackgroundColor: string;
}

/** Имя alias-компонента — маркер входа «Приступ» (см. AndroidManifest.xml.fragment). */
const ALIAS_ANDROID_NAME = '.QuickEntryAlias';

/** Суффикс класса alias в FQCN компонента Intent: "<packageName>.QuickEntryAlias". */
const ALIAS_CLASS_SUFFIX = '.QuickEntryAlias';

/** URL быстрого входа: дальше его разбирает штатный deep-link механизм expo-router. */
const QUICK_ENTRY_URI = 'seizure://quick';

/**
 * Узел activity-alias для <application> манифеста — 1:1 по форме
 * android/AndroidManifest.xml.fragment (формат modResults: атрибуты в $,
 * дети — массивы). Значение label — константа, как scheme.
 */
const ACTIVITY_ALIAS_NODE: AndroidConfig.Manifest.ManifestActivityAlias = {
    $: {
        'android:name': ALIAS_ANDROID_NAME,
        'android:label': 'Приступ',
        'android:icon': '@mipmap/ic_launcher_quick',
        'android:enabled': 'true',
        'android:exported': 'true',
        'android:targetActivity': '.MainActivity',
    },
    'intent-filter': [
        {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [
                { $: { 'android:name': 'android.intent.category.LAUNCHER' } },
            ],
        },
    ],
};

/**
 * Config plugin второй иконки лаунчера «Приступ»: на prebuild добавляет в
 * AndroidManifest.xml activity-alias с собственной иконкой, создаёт ресурсы
 * этой иконки в res/ и патчит MainActivity.kt так, чтобы запуск через alias
 * проставлял Intent'у URL seizure://quick. Все моды идемпотентны.
 */
const withActivityAlias: ConfigPlugin<ActivityAliasPluginProps> = (
    config,
    props,
) => {
    config = withAndroidManifest(config, (config) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
            config.modResults,
        );

        const existing = application['activity-alias'] ?? [];

        if (
            existing.some(
                (alias) => alias?.$?.['android:name'] === ALIAS_ANDROID_NAME,
            )
        ) {
            return config;
        }

        application['activity-alias'] = [...existing, ACTIVITY_ALIAS_NODE];

        return config;
    });

    config = withDangerousMod(config, [
        'android',
        (config) => {
            if (!config.modRequest.introspect) {
                writeIconResources(
                    config.modRequest.platformProjectRoot,
                    props.iconBackgroundColor,
                );
            }

            return config;
        },
    ]);

    config = withMainActivity(config, (config) => {
        if (config.modResults.language !== 'kt') {
            throw new Error(
                'activity-alias: ожидался kotlin-шаблон MainActivity ' +
                    `(получен "${config.modResults.language}")`,
            );
        }

        config.modResults.contents = patchMainActivity(
            config.modResults.contents,
        );

        return config;
    });

    return config;
};

/**
 * Ресурсы второй иконки в android/app/src/main/res/:
 * values/quick_entry_colors.xml — цвет фона; mipmap-anydpi-v26/ic_launcher_quick.xml —
 * adaptive-icon с тем же foreground, что у основной (различие иконок — только фон);
 * при minSdk < 26 — копии legacy-иконки по плотностям (на API 24–25 иконка
 * совпадёт с журнальной: различие фона видно только на 26+).
 */
function writeIconResources(
    platformProjectRoot: string,
    iconBackgroundColor: string,
): void {
    const resRoot = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');

    const colorsXml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<resources>',
        `    <color name="quick_entry_background">${iconBackgroundColor}</color>`,
        '</resources>',
    ].join('\n');

    // Expo генерирует foreground адаптивной иконки из android.adaptiveIcon.foregroundImage.
    assertForegroundResourceExists(resRoot);

    const adaptiveIconXml = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
        '    <background android:drawable="@color/quick_entry_background"/>',
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>',
        '</adaptive-icon>',
    ].join('\n');

    fs.mkdirSync(path.join(resRoot, 'values'), { recursive: true });
    fs.writeFileSync(
        path.join(resRoot, 'values', 'quick_entry_colors.xml'),
        colorsXml,
    );

    const anyDpiV26 = path.join(resRoot, 'mipmap-anydpi-v26');
    fs.mkdirSync(anyDpiV26, { recursive: true });
    fs.writeFileSync(
        path.join(anyDpiV26, 'ic_launcher_quick.xml'),
        adaptiveIconXml,
    );

    if (resolveMinSdkVersion(platformProjectRoot) < 26) {
        copyLegacyLauncherIcons(resRoot);
    }
}

/** Fail-fast: foreground-ресурс адаптивной иконки обязан существовать к этому моменту. */
function assertForegroundResourceExists(resRoot: string): void {
    const densities = listMipmapDensityDirs(resRoot);

    if (densities.length === 0) {
        throw new Error(
            'activity-alias: не найдены каталоги mipmap-*dpi в res/ — ' +
                'иконки Expo ещё не сгенерированы',
        );
    }

    const hasForeground = densities.some((dir) =>
        findResourceFile(path.join(resRoot, dir), 'ic_launcher_foreground'),
    );

    if (!hasForeground) {
        throw new Error(
            'activity-alias: не найден ресурс ic_launcher_foreground ' +
                '(ожидался из android.adaptiveIcon.foregroundImage)',
        );
    }
}

/** Каталоги плотностей mipmap-*dpi (без mipmap-anydpi-v26). */
function listMipmapDensityDirs(resRoot: string): string[] {
    let entries: string[];

    try {
        entries = fs.readdirSync(resRoot);
    } catch {
        return [];
    }

    return entries.filter((entry) =>
        /^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(entry),
    );
}

/** Существующий файл ресурса по имени: webp (текущие SDK) или png (старые). */
function findResourceFile(dir: string, name: string): string | null {
    for (const ext of ['.webp', '.png']) {
        const candidate = path.join(dir, `${name}${ext}`);

        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

/**
 * minSdkVersion из сгенерированных gradle-файлов. Expo 57 задаёт значение
 * gradle-плагином (в build.gradle числа нет) — тогда возвращаем 0:
 * «неизвестно» трактуем как < 26, лишние фолбэк-копии безвредны.
 */
function resolveMinSdkVersion(platformProjectRoot: string): number {
    const gradleFiles = [
        path.join(platformProjectRoot, 'build.gradle'),
        path.join(platformProjectRoot, 'app', 'build.gradle'),
    ];

    for (const gradleFile of gradleFiles) {
        let contents: string;

        try {
            contents = fs.readFileSync(gradleFile, 'utf8');
        } catch {
            continue;
        }

        const match = contents.match(/minSdkVersion\s*=?\s*(\d+)/);

        if (match) {
            return Number.parseInt(match[1], 10);
        }
    }

    return 0;
}

/** Копия ic_launcher → ic_launcher_quick в каждой плотности (legacy-фолбэк). */
function copyLegacyLauncherIcons(resRoot: string): void {
    for (const densityDir of listMipmapDensityDirs(resRoot)) {
        const source = findResourceFile(
            path.join(resRoot, densityDir),
            'ic_launcher',
        );

        if (source === null) {
            throw new Error(
                `activity-alias: не найдена legacy-иконка в ${densityDir}`,
            );
        }

        fs.copyFileSync(
            source,
            path.join(
                resRoot,
                densityDir,
                `ic_launcher_quick${path.extname(source)}`,
            ),
        );
    }
}

/**
 * Патч MainActivity.kt: onCreate/onNewIntent при запуске через alias
 * превращают лаунчерный intent (ACTION_MAIN + LAUNCHER) в полноценный
 * deep-link: ДО super ставят action = ACTION_VIEW и
 * data = seizure://quick (RN/expo-router на холодном старте трактует
 * intent как deep-link только при ACTION_VIEW) — настоящий deep-link
 * (intent.data != null) не затираем. Идемпотентно: повторно не патчится.
 * Fail-fast: якорь класса и существующий onCreate обязательны — шаблон
 * без onCreate не поддерживается (генерировать свой override ненадёжно:
 * нет гарантий импорта Bundle и семантики super.onCreate у нового шаблона
 * Expo). Экспортируется для тестов.
 */
export function patchMainActivity(source: string): string {
    if (source.includes('stampQuickIntent')) {
        return source;
    }

    const classAnchor = 'class MainActivity : ReactActivity() {';

    if (!source.includes(classAnchor)) {
        throw new Error(
            'activity-alias: якорь патча не найден — ' +
                `"${classAnchor}" отсутствует в MainActivity`,
        );
    }

    const onCreateAnchor =
        'override fun onCreate(savedInstanceState: Bundle?) {';

    if (!source.includes(onCreateAnchor)) {
        throw new Error(
            'activity-alias: якорь патча не найден — ' +
                `"${onCreateAnchor}" отсутствует в MainActivity. ` +
                'Шаблон без onCreate не поддерживается: обновите плагин ' +
                'под новый шаблон Expo',
        );
    }

    let patched = source;

    patched = insertImports(patched, [
        'import android.content.Intent',
        'import android.net.Uri',
    ]);

    patched = patched.replace(
        onCreateAnchor,
        `${onCreateAnchor}\n    stampQuickIntent(intent)`,
    );

    const stampBlock = [
        '  override fun onNewIntent(intent: Intent) {',
        '    stampQuickIntent(intent)',
        '    super.onNewIntent(intent)',
        '  }',
        '',
        '  private fun stampQuickIntent(intent: Intent?) {',
        '    val component = intent?.component ?: return',
        `    if (component.className == "$packageName${ALIAS_CLASS_SUFFIX}" && intent.data == null) {`,
        '      intent.action = Intent.ACTION_VIEW',
        `      intent.data = Uri.parse("${QUICK_ENTRY_URI}")`,
        '    }',
        '  }',
        '',
    ].join('\n');

    patched = patched.replace(classAnchor, `${classAnchor}\n${stampBlock}`);

    return patched;
}

/** Добавляет недостающие импорты, сохраняя алфавитный порядок блока. */
function insertImports(source: string, imports: string[]): string {
    const lines = source.split('\n');
    const existing = new Set(
        lines.filter((line) => line.startsWith('import ')),
    );

    const missing = imports.filter((name) => !existing.has(name));

    if (missing.length === 0) {
        return source;
    }

    let insertAt = lines.findIndex(
        (line) =>
            line.startsWith('import ') && line.slice(7) > missing[0].slice(7),
    );

    if (insertAt === -1) {
        insertAt =
            lines.map((line) => line.startsWith('import ')).lastIndexOf(true) +
            1;

        if (insertAt === 0) {
            throw new Error(
                'activity-alias: блок импортов MainActivity не найден',
            );
        }
    }

    lines.splice(insertAt, 0, ...missing);

    return lines.join('\n');
}

export default withActivityAlias;
