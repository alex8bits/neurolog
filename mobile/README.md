# Seizure Mobile (Android)

> Expo-клиент «График приступов». Android-only. Серверный API: `/api/v1` (Sanctum + refresh).
>
> **Статус: Этап 5 — смок на физическом устройстве пройден.** Сборка debug-APK командой `expo run:android --device`, смок-чеклист 8/8 против живого LAN-API; фиксы по итогам смока: react-native сведён к бандлимой expo версии 0.86.3, штамп alias теперь ставит `Intent.ACTION_VIEW`, после quick-записи роут сбрасывается до выхода, пресеты фильтра сворачивают панель «Произвольный период». См. [`mobile/PLAN.md`](./PLAN.md).

## Quickstart

```powershell
cd mobile
nvm use            # читает .nvmrc (Node 22)
npm install
npm run lint:check
npm run types:check
npm run format:check
npm run test
npx expo start
```

После `npx expo start` в терминале появится QR-код. Сканировать в **Expo Go** на Android-устройстве. Приложение откроется на экране входа; после регистрации или логина — список приступов (время показывается в поясе устройства). Над списком — чипы фильтра периода: «Сегодня», «7 дней» (по умолчанию, как и в веб-версии), «30 дней», «Всё время», «Произвольный период» (диапазон дат). Новая запись — кнопка «+»: по умолчанию «сейчас» (фиксируется текущее время), переключатель «Точное время» — запись задним числом через пикеры даты/времени (не дальше 5 минут в будущее); удаление — долгое нажатие по записи с подтверждением; выход — «Настройки» → «Выйти». Рестарт не спрашивает логин повторно.

## Локальные URL

API-база НЕ хардкодится — берётся из `EXPO_PUBLIC_API_BASE_URL` в `mobile/.env` (образец — [`.env.example`](./.env.example)); дефолт в [`src/config/env.ts`](./src/config/env.ts) — URL Android-эмулятора.

| Среда                                        | URL                                  |
| -------------------------------------------- | ------------------------------------ |
| Android-эмулятор (OpenServer на host-машине) | `http://10.0.2.2:8000/api/v1`        |
| Физический Android в той же Wi-Fi сети       | `http://<IP-OpenServer>:8000/api/v1` |
| Продуктив (`seizure.godnocode.ru`)           | `https://seizure.godnocode.ru/api/v1`|

`<IP-OpenServer>` — IP машины, на которой запущен Laravel (`php artisan serve` или OpenServer). Узнать через `ipconfig` (Windows) или `ifconfig` (Linux/macOS) — обычно `192.168.x.x`.

> ⚠️ Смена `mobile/.env` требует рестарта `expo start` — Metro инлайнит значения `EXPO_PUBLIC_*` при сборке бандла, горячая перезагрузка новое значение не подхватит.

> ⚠️ При ручных проверках логина/регистрации помните про общий лимит **5 запросов/мин на register+login** (по email+IP, `app/Providers/FortifyServiceProvider.php`): шестая попытка вернёт 429.

> ⚠️ **`localhost` в коде НЕ использовать** (см. [`PLAN.md` §3](./PLAN.md)). Даже в `extra` `app.json` — только конкретный IP эмулятора или устройства.

## Сборка

```powershell
# Локальная сборка APK
npx expo prebuild --platform android
cd android
.\gradlew assembleRelease
# APK появится в android/app/build/outputs/apk/release/

# EAS Cloud Build (рекомендуется)
npm install -g eas-cli
eas login
eas build --profile development --platform android   # dev-client с activity-alias
eas build --profile preview --platform android       # APK для раздачи
eas build --profile production --platform android    # AAB для Play Console
```

> ⚠️ Профиль `development` объявляет `developmentClient: true` и предполагает установленный `expo-dev-client` — этого пакета сейчас нет в зависимостях, команда в таком виде не сработает. Для смока на устройстве (Этап 5) используется локальная debug-сборка — см. [«Смок на физическом устройстве (Этап 5)»](#смок-на-физическом-устройстве-этап-5).

> ⚠️ Release-сборки (`assembleRelease`, профили `preview`/`production`) по **HTTP**-адресу API не достучатся: cleartext разрешён только в debug-вариантах (Expo Go и debug-prebuild). Прод — только HTTPS; адрес для отладки на устройстве ставьте через `mobile/.env` (см. [«Локальные URL»](#локальные-url)).

**Прод-сборки смотрят на сервер** `https://seizure.godnocode.ru`: профили `preview` и `production` в [`eas.json`](./eas.json) несут `EXPO_PUBLIC_API_BASE_URL` в своём `env` — облако EAS подставит его при сборке автоматически. Для **локальной** release-сборки под прод задайте переменную в команде (Metro инлайнит её при сборке бандла — до запуска, не после):

```bash
EXPO_PUBLIC_API_BASE_URL=https://seizure.godnocode.ru/api/v1 npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

### Публикация APK на сайт (раздача через сайт)

Скрипт [`scripts/publish-apk.sh`](./scripts/publish-apk.sh) кладёт собранный APK в `public/downloads/seizure.apk` и пишет рядом `app-release.json` с версией. После этого:

- ссылка `http://<IP-или-домен>:<порт>/downloads/seizure.apk` — **постоянная**: nginx отдаёт файл напрямую, имя не меняется между релизами, замена атомарная (параллельная загрузка не получит недописанный файл);
- в левом сайдбаре сайта появляется пункт «Скачать приложение» с номером версии — он читает `app-release.json`, поэтому до первой публикации пункта нет, а «мёртвых» ссылок не бывает.

```bash
# из mobile/ (Git Bash)
./scripts/publish-apk.sh                                  # release-APK (только для HTTPS-API!)
./scripts/publish-apk.sh android/app/build/outputs/apk/debug/app-debug.apk   # debug-APK для LAN/HTTP
```

Пока API доступен только по HTTP из локальной сети, публикуйте **debug**-вариант (release не работает с cleartext — см. предупреждение выше). Перед публикацией полезно поднять `expo.android.versionCode` в `app.json` и перегенерировать `android/` (`npx expo prebuild --platform android`): Android не ставит APK с versionCode ниже уже установленного, а совпадающий — нельзя отличить на телефоне (скрипт предупредит).

`public/downloads/` в `.gitignore`: APK и мета — артефакты сборки, не исходники.

### Иконки приложения

Ассеты `assets/images/{icon,adaptive-icon,splash-icon}.png` генерируются скриптом [`scripts/generate-icons.mjs`](./scripts/generate-icons.mjs) из SVG-описаний — править PNG руками не нужно, меняйте глиф в скрипте и перегенерируйте:

```bash
npm i --no-save sharp        # зависимость только для генератора
node scripts/generate-icons.mjs preview   # сетка вариантов в out/preview/
node scripts/generate-icons.mjs final A   # записать ассеты варианта A в assets/images/
```

Дизайн: белый EEG-спайк с красным маркером на пике (вариант A). Цвета связаны с конфигурацией: фон журнальной адаптивной иконки — `#283593` (`app.json` → `android.adaptiveIcon.backgroundColor`), фон иконки «Приступ» — `#C62828` (проп `iconBackgroundColor` плагина activity-alias). Обе иконки используют один foreground — `adaptive-icon.png`, различие только фоном; он же подключён как `monochromeImage` для тематических иконок Android 13+.

После смены ассетов пересоздайте нативные ресурсы, иначе в лаунчере останутся старые: `npx expo prebuild --platform android` и пересборка.

### Локальная проверка двух иконок (Этап 3)

```powershell
npx expo prebuild --platform android   # применит plugins/activity-alias: alias в манифесте, иконки, патч MainActivity
npx expo run:android                   # соберёт и поставит debug-вариант
```

После установки в лаунчере две иконки: «График приступов» (журнал) и «Приступ» (быстрая запись `/quick`). Это debug-сборка — cleartext HTTP разрешён, поэтому проверку этапа 3 можно вести против локального API из `mobile/.env`, без HTTPS.

> Иконка «Приступ» — тот же foreground, что у журнальной, но на красном фоне `#C62828` (задаётся пропсом `iconBackgroundColor` в `app.json` при подключении плагина). Legacy-иконки `ic_launcher_quick` для API < 26 совпадают с журнальной — различие видно только на Android 8+ (adaptive icon).

## Смок на физическом устройстве (Этап 5)

Чек-лист приёмки — Этап 5 в [`PLAN.md` §2](./PLAN.md). Runbook ниже: навести debug-сборку на живой LAN-API, поставить её на устройство и детерминированно триггерить сценарии чек-листа. HTTP к LAN-IP допустим, потому что используется debug-вариант (об ограничении release-сборок — предупреждение в разделе «Сборка» выше).

### Предусловия

- Телефон и машина с API в одном сегменте сети (общий Wi-Fi/роутер).
- Входящее правило Windows Firewall на порт API — из админ-консоли (альтернатива — тот же порт через GUI):

```powershell
netsh advfirewall firewall add rule name="Seizure API" dir=in action=allow protocol=TCP localport=<порт>
```

- На устройстве включена отладка по USB; телефон подключён кабелем и виден в `adb devices`.
- Metro должен работать весь смок: debug-вариант грузит JS-бандл с него. Отдельный `npx expo start` не нужен — Metro стартует командой сборки ниже; остановка Metro или отключение USB во время смока ломают приложение.

### Настройка API-базы

1. Узнать IPv4 машины с API: `ipconfig` (обычно `192.168.x.x`).
2. Взять фактический порт, на котором API принимает входящие (в примерах репо — 8000).
3. Создать `mobile/.env` из [`.env.example`](./.env.example) с базой для устройства (файл локальный, не коммитится):

```
EXPO_PUBLIC_API_BASE_URL=http://<IP>:<порт>/api/v1
```

Симптом забытого `.env`: запросы уходят на дефолт `10.0.2.2` из [`src/config/env.ts`](./src/config/env.ts) (адрес эмулятора) и на устройстве падают сетевые ошибки. О рестарте Metro после смены `.env` — предупреждение в [«Локальные URL»](#локальные-url).

### Проверка связности до сборки

С браузера телефона открыть `http://<IP>:<порт>/up` — это health-роут Laravel в корне, НЕ под `api/v1` (`bootstrap/app.php`). Должен прийти ответ 200; если страница не открывается — чинить сеть/firewall до сборки.

### Сборка и установка

Из `mobile/`:

```powershell
npx expo run:android --device
```

Команда использует существующий `mobile/android/` (патчи второй иконки уже применены, отдельный `prebuild` не нужен), собирает debug-вариант и ставит его на подключённое устройство. После установки в лаунчере две иконки — «График приступов» и «Приступ» (см. [«Локальная проверка двух иконок (Этап 3)»](#локальная-проверка-двух-иконок-этап-3)); deep-link быстрого входа проверяется adb-командами из раздела «Ограничение Expo Go» ниже.

### Триггеры тестовых сценариев

Ожидаемое поведение по каждому пункту — в чек-листе Этапа 5 ([`PLAN.md` §2](./PLAN.md)).

**401 → refresh → повтор запроса.** Удалить на сервере access-токены (Sanctum PAT) смок-пользователя, refresh-токен не трогать — следующий защищённый запрос вернёт 401, пройдёт единственный refresh и повтор с новой парой:

```powershell
php artisan tinker
>>> App\Models\User::where('email', '<email-смок-пользователя>')->first()->tokens()->delete();
```

`POST /logout` для этого сценария НЕ подходит — он отзывает всё, включая refresh-токены (`revokeAllTokens()` в `app/Services/TokenService.php`).

**404 при удалении.** Soft-delete записи на сервере, затем удалить её же в UI — ожидание 404 «не найдено» без падения списка:

```powershell
php artisan tinker
>>> App\Models\Seizure::find(<id>)->delete();
```

**Kill процесса во время запроса.** В момент «Загрузка…»/«Записываем…» выполнить:

```powershell
adb shell am force-stop com.alex8bits.seizure
```

Следующий запуск обязан прийти к рабочему состоянию (в худшем случае — повторный логин).

Повторные логины в смоке упираются в общий лимит 5 запросов/мин на register+login — это штатное поведение, а не провал сценария (предупреждение — в [«Локальные URL»](#локальные-url)).

## ⚠️ Ограничение Expo Go

В Expo Go **`activity-alias` (вторая иконка «Приступ» в лаунчере) НЕ работает** — это известное ограничение. Для проверки самой иконки (Этап 3) нужен dev или preview build через EAS / `expo run:android` (см. [«Локальная проверка двух иконок»](#локальная-проверка-двух-иконок-этап-3)).

Противоположный случай — `@react-native-community/datetimepicker` (пикеры даты/времени в записи задним числом, Этап 4): это нативный модуль, но в Expo Go он работает из коробки. А вот debug/dev-сборки, собранные до Этапа 4, нужно пересобрать — локально (`npx expo prebuild --platform android` + `npx expo run:android`) или через EAS (`eas build --profile development --platform android`) — иначе импорт модуля упадёт.

Быстрый поток `/quick` можно прогнать и без нативной сборки — открыть экран deep-link'ом. В Expo Go (запущен `npx expo start`, проект открыт на устройстве/эмуляторе):

```powershell
# exp://-адрес — тот, что печатает expo start; /--/ отделяет маршрут
npx uri-scheme open "exp://<IP-из-expo-start>:8080/--/quick" --android
```

В установленной debug/dev-сборке (scheme `seizure` зарегистрирован) — короче:

```powershell
npx uri-scheme open seizure://quick --android
# или напрямую:
adb shell am start -W -a android.intent.action.VIEW -d "seizure://quick" com.alex8bits.seizure
```

Подробнее — [`PLAN.md` §3](./PLAN.md) и [`MOBILE.md` §4](../../MOBILE.md).

## Сквозные правила

- Без `localhost` в клиентском коде.
- Только HTTPS в проде; cleartext — только для debug-сборок (через config plugin, см. [`PLAN.md` §3](./PLAN.md)).
- Refresh — одна очередь, без параллельных вызовов (Этап 1).
- React Context + reducer, без zustand/redux до явной потребности.
- Бизнес-логика — в `src/api/`, `src/utils/`, не в компонентах.
- Тесты — только там, где ловят реальный регресс (refresh-очередь, парсер времени, http-обёртка). UI-тесты не пишем.

Полный список — [`PLAN.md` §3](./PLAN.md).

## Где что

```
mobile/
├── PLAN.md           # 5-этапный план
├── README.md         # этот файл
├── package.json      # Expo SDK 57
├── app.json          # Expo manifest
├── eas.json          # EAS build profiles
├── tsconfig.json     # extends expo/tsconfig.base
├── eslint.config.js  # flat config (eslint-config-expo + house style)
├── .prettierrc       # 4 ключа
├── vitest.config.ts  # unit-тесты из __tests__/
├── .env.example      # образец EXPO_PUBLIC_API_BASE_URL
├── scripts/
│   ├── publish-apk.sh     # публикация APK в public/downloads (раздача с сайта)
│   └── generate-icons.mjs # генерация иконок (SVG → PNG, нужен sharp)
├── app/              # expo-router (file-based)
│   ├── _layout.tsx   # root Stack + AuthProvider + роутинг-гард (returnTo)
│   ├── (auth)/       # login.tsx / register.tsx (форвард returnTo)
│   ├── quick.tsx     # быстрый вход: маршрут /quick (иконка «Приступ»)
│   └── (journal)/    # _layout.tsx (Stack группы), index.tsx (список
│                     # с фильтром периода, маршрут «/»), new.tsx
│                     # (создание: «сейчас» или точное время),
│                     # settings.tsx (профиль: имя/email/пояс,
│                     # удаление аккаунта, выход)
├── plugins/
│   └── activity-alias/  # config plugin второй иконки: plugin.ts +
│                        # android/AndroidManifest.xml.fragment
├── src/
│   ├── api/          # client.ts (refresh-очередь), auth.ts,
│   │                 # seizures.ts (list/create/delete), types.ts
│   ├── auth/         # tokens.ts (SecureStore), AuthContext.tsx,
│   │                 # returnTo.ts (белый список возврата после логина)
│   ├── config/       # env.ts, timezone.ts
│   └── utils/        # errors.ts, time.ts (парсер/форматтер UTC-ISO,
│                     # Y-m-d/наивные строки/HH:MM, округление до минуты,
│                     # проверка будущего), period.ts (пресеты фильтра
│                     # периода → from/to)
├── assets/           # иконки
└── __tests__/        # полный список тестов:
                       # activity-alias-plugin.test.ts, api-client.test.ts,
                       # period.test.ts, refresh-queue.test.ts,
                       # return-to.test.ts, seizures.test.ts, time.test.ts
```

## Связанные документы

- [`mobile/PLAN.md`](./PLAN.md) — 5 этапов, scope, критерии приёмки.
- [`MOBILE.md`](../../MOBILE.md) — концепт: зачем нужен мобильный клиент, контракт API, сквозные правила.
- [`CLAUDE.md`](../../CLAUDE.md) — общие правила репо (минимальный набор тестов, форматирование).
