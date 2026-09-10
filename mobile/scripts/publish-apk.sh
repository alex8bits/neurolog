#!/usr/bin/env bash
# Публикация свежесобранного APK в public/downloads/.
#
# Файл всегда кладётся под одним именем (seizure.apk), поэтому ссылка
# /downloads/seizure.apk на сайте стабильна между релизами: nginx отдаёт
# её напрямую, минуя PHP. Рядом пишется app-release.json — по нему сайдбар
# показывает пункт «Скачать приложение» с номером версии (нет файла — нет
# пункта, мёртвых ссылок не бывает).
#
# Использование (из каталога mobile или откуда угодно):
#   ./scripts/publish-apk.sh                        # возьмёт стандартный app-release.apk
#   ./scripts/publish-apk.sh путь/до/app-debug.apk  # или явно указать APK
#
# Перед сборкой релиза стоит поднять expo.android.versionCode в app.json —
# Android не даст установить APK с versionCode ниже уже установленного.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_JSON="$REPO_ROOT/mobile/app.json"
DEFAULT_APK="$REPO_ROOT/mobile/android/app/build/outputs/apk/release/app-release.apk"
APK="${1:-$DEFAULT_APK}"

DEST_DIR="$REPO_ROOT/public/downloads"
DEST_APK="$DEST_DIR/seizure.apk"
DEST_META="$DEST_DIR/app-release.json"

command -v node >/dev/null 2>&1 || {
    echo "Ошибка: нужен node (читаю app.json и считаю sha256)." >&2
    exit 1
}

[ -f "$APP_JSON" ] || { echo "Ошибка: не найден $APP_JSON" >&2; exit 1; }
[ -f "$APK" ] || {
    echo "Ошибка: не найден APK: $APK" >&2
    echo "Сначала соберите: cd mobile && npx expo prebuild -p android && cd android && ./gradlew assembleRelease" >&2
    exit 1
}

mkdir -p "$DEST_DIR"

# Предупреждение о повторном versionCode: установится поверх, но отличить
# сборки на телефоне будет нельзя.
if [ -f "$DEST_META" ]; then
    node -e '
        const fs = require("fs");
        const app = require(process.argv[1]).expo;
        const prev = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
        if (prev.versionCode === (app.android?.versionCode ?? 1)) {
            console.error("Внимание: versionCode не менялся (" + prev.versionCode + "). Android обновит APK поверх, но поднять expo.android.versionCode в app.json полезно для различия сборок.");
        }
    ' "$APP_JSON" "$DEST_META" || true
fi

# Копируем через .tmp + mv: заменяем файл атомарно, параллельная загрузка
# не может получить наполовину записанный APK.
cp "$APK" "$DEST_APK.tmp"
mv -f "$DEST_APK.tmp" "$DEST_APK"

node -e '
    const fs = require("fs"), crypto = require("crypto");
    const app = require(process.argv[1]).expo;
    const apkPath = process.argv[2], metaPath = process.argv[3];
    const buf = fs.readFileSync(apkPath);
    const meta = {
        version: app.version,
        versionCode: app.android?.versionCode ?? 1,
        sizeBytes: buf.length,
        sha256: crypto.createHash("sha256").update(buf).digest("hex"),
        publishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 4) + "\n");
    console.log("Опубликовано: seizure.apk v" + meta.version + " (versionCode " + meta.versionCode + ", " + (buf.length / 1024 / 1024).toFixed(1) + " МБ)");
' "$APP_JSON" "$DEST_APK" "$DEST_META.tmp"

mv -f "$DEST_META.tmp" "$DEST_META"

echo "Ссылка для скачивания: <адрес сайта>/downloads/seizure.apk"
echo "Пункт «Скачать приложение» в сайдбаре появится сам (читает app-release.json)."
