#!/bin/sh
# Поднять версию, собрать release-APK и опубликовать его на сервере.
#
# 0.0.16 / versionCode 16 становится 0.0.17 / 17: patch и versionCode
# растут на 1. Новая версия пишется в app.json до сборки (её берёт
# prebuild); если сборка или загрузка упали, app.json возвращается к
# прежней версии.
#
# Использование (из mobile/ или по пути к скрипту, в Git Bash):
#   ./build-release.sh
#
# Адрес API — EXPO_PUBLIC_API_BASE_URL из mobile/.env.production (только
# https://). Он передаётся сборке явно, а после сборки проверяется, что
# именно он попал в бандл, — dev-адрес из mobile/.env в релиз не уйдёт.
#
# Подпись: release подписывается debug.keystore, который prebuild
# берёт из шаблона Expo, — один и тот же ключ на всех машинах. Сменить
# ключ значит сломать обновление поверх у всех пользователей, поэтому
# отпечаток сертификата APK сверяется с RELEASE_CERT_SHA256 (по умолчанию —
# ключ, которым подписаны все опубликованные версии).
#
# Нужны node, npx, unzip, ssh/scp и JDK (JAVA_HOME). Если ANDROID_HOME не
# задан, берётся sdk.dir из android/local.properties. Загрузка — через
# ssh-алиас RELEASE_SSH (по умолчанию sweb) в RELEASE_DIR (по умолчанию
# public/downloads прод-копии): сначала APK, затем app-release.json,
# прежние файлы остаются рядом как *.prev.

set -eu

cd "$(CDPATH= cd -- "$(dirname "$0")" && pwd)"

expected_cert=${RELEASE_CERT_SHA256:-fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c}
release_ssh=${RELEASE_SSH:-sweb}
release_dir=${RELEASE_DIR:-/srv/www/seizure/public/downloads}
apk_local=android/app/build/outputs/apk/release/app-release.apk

for tool in node npx unzip ssh scp curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Не найден $tool — добавьте его в PATH." >&2
    exit 1
  fi
done

if [ -z "${JAVA_HOME:-}" ]; then
  echo "JAVA_HOME не задан — нужен JDK 17 для Gradle и apksigner." >&2
  exit 1
fi

# --- адрес API -------------------------------------------------------------

url=$(
  sed -n 's/^EXPO_PUBLIC_API_BASE_URL=//p' .env.production 2>/dev/null | head -n 1 | tr -d '\r' || true
)
url=$(printf '%s' "$url" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e "s/^'//" -e 's/"$//' -e "s/'$//")
url=${url%/}

case "$url" in
  https://*) ;;
  '')
    echo "В mobile/.env.production нет EXPO_PUBLIC_API_BASE_URL." >&2
    exit 1
    ;;
  *)
    echo "Release-адрес API должен начинаться с https:// (сейчас: $url)." >&2
    exit 1
    ;;
esac

origin=$(printf '%s' "$url" | sed -E 's|^(https://[^/]+).*|\1|')

# --- Android SDK -----------------------------------------------------------

if [ -z "${ANDROID_HOME:-}" ]; then
  sdk_dir=$(
    sed -n 's/^sdk\.dir=//p' android/local.properties 2>/dev/null | head -n 1 | tr -d '\r' || true
  )
  # local.properties экранирует обратные слеши и двоеточие: E\:\\Utils → E:/Utils
  sdk_dir=$(printf '%s\n' "$sdk_dir" | sed -e 's|\\\\|/|g' -e 's|\\:|:|g')
  if [ -z "$sdk_dir" ]; then
    echo "ANDROID_HOME не задан, и в android/local.properties нет sdk.dir." >&2
    exit 1
  fi
  export ANDROID_HOME="$sdk_dir"
  export ANDROID_SDK_ROOT="$sdk_dir"
fi

apksigner_jar=$(ls -d "$ANDROID_HOME"/build-tools/*/lib/apksigner.jar 2>/dev/null | sort -V | tail -n 1 || true)
if [ -z "$apksigner_jar" ]; then
  echo "apksigner.jar не найден в $ANDROID_HOME/build-tools." >&2
  exit 1
fi

# --- версия ----------------------------------------------------------------

old_version=$(node -p 'require("./app.json").expo.version')
old_code=$(node -p 'require("./app.json").expo.android.versionCode')

if ! printf '%s' "$old_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "expo.version в app.json не вида X.Y.Z: $old_version" >&2
  exit 1
fi
if ! printf '%s' "$old_code" | grep -Eq '^[0-9]+$'; then
  echo "expo.android.versionCode в app.json не число: $old_code" >&2
  exit 1
fi

major=$(printf '%s' "$old_version" | cut -d. -f1)
minor=$(printf '%s' "$old_version" | cut -d. -f2)
patch=$(printf '%s' "$old_version" | cut -d. -f3)
new_version="${major}.${minor}.$((patch + 1))"
new_code=$((old_code + 1))

echo "Версия ${old_version} (${old_code}) -> ${new_version} (${new_code})"
echo "API: ${url}"

app_json_backup=$(mktemp)
meta_local=$(mktemp)
cp app.json "$app_json_backup"
published=0

cleanup() {
  if [ "$published" -ne 1 ]; then
    cp "$app_json_backup" app.json
    echo "app.json возвращён к версии ${old_version}." >&2
  fi
  rm -f "$app_json_backup" "$meta_local"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Точечная замена двух значений: форматирование app.json (prettier) не
# трогается; результат перечитывается как JSON и сверяется.
node -e '
  const fs = require("fs");
  const [file, oldVersion, oldCode, version, code] = process.argv.slice(1);
  let text = fs.readFileSync(file, "utf8");
  const replaceOnce = (from, to) => {
    if (text.split(from).length !== 2) {
      throw new Error("app.json: ожидалось ровно одно вхождение " + from);
    }
    text = text.replace(from, to);
  };
  replaceOnce(`"version": "${oldVersion}"`, `"version": "${version}"`);
  replaceOnce(`"versionCode": ${oldCode}`, `"versionCode": ${code}`);
  const expo = JSON.parse(text).expo;
  if (expo.version !== version || expo.android.versionCode !== Number(code)) {
    throw new Error("app.json: версия не обновилась");
  }
  fs.writeFileSync(file, text);
' app.json "$old_version" "$old_code" "$new_version" "$new_code"

# --- сборка ----------------------------------------------------------------

# prebuild переносит версию (и прочую нативную конфигурацию) из app.json в
# android/. --no-clean — правка существующей папки: без него prebuild
# пересоздаёт android/ (теряется local.properties и кэш сборки).
# EXPO_NO_GIT_STATUS — без вопроса о незакоммиченных файлах.
EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform android --no-install --no-clean

if ! grep -Eq "versionCode[[:space:]]+${new_code}([[:space:]]|\$)" android/app/build.gradle; then
  echo "prebuild не записал versionCode ${new_code} в android/app/build.gradle." >&2
  exit 1
fi

rm -f "$apk_local"

# NODE_ENV=production — Expo читает .env.production; адрес задан и явно,
# переменная окружения процесса сильнее любого .env-файла.
(
  cd android
  NODE_ENV=production EXPO_PUBLIC_API_BASE_URL="$url" ./gradlew assembleRelease
)

if [ ! -f "$apk_local" ]; then
  echo "APK не собран: $apk_local" >&2
  exit 1
fi

# --- проверки APK ----------------------------------------------------------

if ! unzip -p "$apk_local" assets/index.android.bundle | grep -aqF "$url"; then
  echo "В бандле APK нет адреса ${url} — сборка взяла другой EXPO_PUBLIC_API_BASE_URL." >&2
  exit 1
fi

cert=$(
  "$JAVA_HOME/bin/java" -jar "$apksigner_jar" verify --print-certs "$apk_local" |
    sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1 | tr -d '\r'
)
if [ "$cert" != "$expected_cert" ]; then
  echo "APK подписан другим ключом: ${cert:-не удалось прочитать}." >&2
  echo "Ожидался ${expected_cert} — установленные приложения не обновятся поверх." >&2
  exit 1
fi

# --- публикация ------------------------------------------------------------

node -e '
  const fs = require("fs"), crypto = require("crypto");
  const [apk, out, version, code] = process.argv.slice(1);
  const buf = fs.readFileSync(apk);
  const meta = {
    version,
    versionCode: Number(code),
    sizeBytes: buf.length,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    publishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(out, JSON.stringify(meta, null, 4) + "\n");
' "$apk_local" "$meta_local" "$new_version" "$new_code"

ssh_opts="-o ConnectTimeout=10 -o BatchMode=yes"

echo "Публикация ${new_version} в ${release_ssh}:${release_dir}"
# shellcheck disable=SC2086
ssh $ssh_opts "$release_ssh" "mkdir -p '$release_dir'"
# shellcheck disable=SC2086
scp $ssh_opts "$apk_local" "$release_ssh:$release_dir/seizure.apk.upload"
# shellcheck disable=SC2086
scp $ssh_opts "$meta_local" "$release_ssh:$release_dir/app-release.json.upload"

# Сначала APK, потом мета: сбой посередине не объявит версию, файла которой
# ещё нет. Прежние файлы остаются как *.prev для отката.
# shellcheck disable=SC2086
ssh $ssh_opts "$release_ssh" "
set -eu
dir='$release_dir'
owner=\$(stat -c '%u:%g' \"\$dir\")
chown \"\$owner\" \"\$dir/seizure.apk.upload\" \"\$dir/app-release.json.upload\"
chmod 644 \"\$dir/seizure.apk.upload\" \"\$dir/app-release.json.upload\"
if [ -f \"\$dir/seizure.apk\" ]; then cp -p \"\$dir/seizure.apk\" \"\$dir/seizure.apk.prev\"; fi
if [ -f \"\$dir/app-release.json\" ]; then cp -p \"\$dir/app-release.json\" \"\$dir/app-release.json.prev\"; fi
mv \"\$dir/seizure.apk.upload\" \"\$dir/seizure.apk\"
mv \"\$dir/app-release.json.upload\" \"\$dir/app-release.json\"
"

published=1

live=$(curl -fsS -H 'Cache-Control: no-cache' "${origin}/downloads/app-release.json?t=$(date +%s)" || true)
if printf '%s' "$live" | grep -q "\"version\": \"${new_version}\""; then
  echo "Сайт отдаёт ${new_version}: ${origin}/downloads/app-release.json"
else
  echo "Внимание: ${origin}/downloads/app-release.json пока не показывает ${new_version}." >&2
fi

echo "APK: $apk_local"
echo "Скачать: ${origin}/downloads/seizure.apk"
echo "Не забудьте закоммитить app.json (версия ${new_version})."
