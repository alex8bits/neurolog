# Seizure Mobile (Android)

> Expo-клиент «График приступов». Android-only. Серверный API: `/api/v1` (Sanctum + refresh).
>
> **Статус: Этап 3 — быстрый вход.** Аутентификация (логин/регистрация, токены в SecureStore, единая refresh-очередь) + журнал: список, создание «сейчас», удаление, настройки. Новое в этапе: вторая иконка лаунчера «Приступ» (config plugin `activity-alias`) и быстрый экран `/quick` — тап → `POST /seizures` → приложение закрылось; без сессии — короткий логин с возвратом обратно в `/quick`. См. [`mobile/PLAN.md`](./PLAN.md).

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

После `npx expo start` в терминале появится QR-код. Сканировать в **Expo Go** на Android-устройстве. Приложение откроется на экране входа; после регистрации или логина — список приступов (время показывается в поясе устройства). Новая запись — кнопка «+» (фиксируется текущее время); удаление — долгое нажатие по записи с подтверждением; выход — «Настройки» → «Выйти». Рестарт не спрашивает логин повторно.

## Локальные URL

API-база НЕ хардкодится — берётся из `EXPO_PUBLIC_API_BASE_URL` в `mobile/.env` (образец — [`.env.example`](./.env.example)); дефолт в [`src/config/env.ts`](./src/config/env.ts) — URL Android-эмулятора.

| Среда                                        | URL                                  |
| -------------------------------------------- | ------------------------------------ |
| Android-эмулятор (OpenServer на host-машине) | `http://10.0.2.2:8000/api/v1`        |
| Физический Android в той же Wi-Fi сети       | `http://<IP-OpenServer>:8000/api/v1` |

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

> ⚠️ Release-сборки (`assembleRelease`, профили `preview`/`production`) по **HTTP**-адресу API не достучатся: cleartext разрешён только в debug-вариантах (Expo Go и debug-prebuild). Прод — только HTTPS; адрес для отладки на устройстве ставьте через `mobile/.env` (см. [«Локальные URL»](#локальные-url)).

### Локальная проверка двух иконок (Этап 3)

```powershell
npx expo prebuild --platform android   # применит plugins/activity-alias: alias в манифесте, иконки, патч MainActivity
npx expo run:android                   # соберёт и поставит debug-вариант
```

После установки в лаунчере две иконки: «График приступов» (журнал) и «Приступ» (быстрая запись `/quick`). Это debug-сборка — cleartext HTTP разрешён, поэтому проверку этапа 3 можно вести против локального API из `mobile/.env`, без HTTPS.

> Иконка «Приступ» — тот же foreground, что у журнальной, но на красном фоне `#C62828` (задаётся пропсом `iconBackgroundColor` в `app.json` при подключении плагина). Legacy-иконки `ic_launcher_quick` для API < 26 совпадают с журнальной — различие видно только на Android 8+ (adaptive icon).

## ⚠️ Ограничение Expo Go

В Expo Go **`activity-alias` (вторая иконка «Приступ» в лаунчере) НЕ работает** — это известное ограничение. Для проверки самой иконки (Этап 3) нужен dev или preview build через EAS / `expo run:android` (см. [«Локальная проверка двух иконок»](#локальная-проверка-двух-иконок-этап-3)).

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
├── app/              # expo-router (file-based)
│   ├── _layout.tsx   # root Stack + AuthProvider + роутинг-гард (returnTo)
│   ├── (auth)/       # login.tsx / register.tsx (форвард returnTo)
│   ├── quick.tsx     # быстрый вход: маршрут /quick (иконка «Приступ»)
│   └── (journal)/    # _layout.tsx (Stack группы), index.tsx (список,
│                     # маршрут «/»), new.tsx (создание «сейчас»),
│                     # settings.tsx (email/выход)
├── plugins/
│   └── activity-alias/  # config plugin второй иконки: plugin.ts +
│                        # android/AndroidManifest.xml.fragment
├── src/
│   ├── api/          # client.ts (refresh-очередь), auth.ts,
│   │                 # seizures.ts (list/create/delete), types.ts
│   ├── auth/         # tokens.ts (SecureStore), AuthContext.tsx
│   ├── config/       # env.ts, timezone.ts
│   └── utils/        # errors.ts, time.ts (парсер/форматтер UTC-ISO)
├── assets/           # иконки
└── __tests__/        # api-client.test.ts, refresh-queue.test.ts, time.test.ts
```

## Связанные документы

- [`mobile/PLAN.md`](./PLAN.md) — 5 этапов, scope, критерии приёмки.
- [`MOBILE.md`](../../MOBILE.md) — концепт: зачем нужен мобильный клиент, контракт API, сквозные правила.
- [`CLAUDE.md`](../../CLAUDE.md) — общие правила репо (минимальный набор тестов, форматирование).
