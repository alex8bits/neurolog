# Seizure Mobile (Android)

> Expo-клиент «График приступов». Android-only. Серверный API: `/api/v1` (Sanctum + refresh).
>
> **Статус: Этап 0 — каркас.** Экраны, HTTP-клиент, токены — Этап 1+. См. [`mobile/PLAN.md`](./PLAN.md).

## Quickstart

```powershell
cd mobile
nvm use            # читает .nvmrc (Node 22)
npm install
npm run lint:check
npm run types:check
npm run format:check
npx expo start
```

После `npx expo start` в терминале появится QR-код. Сканировать в **Expo Go** на Android-устройстве. На экране должно появиться «График приступов — каркас (Этап 0)».

## Локальные URL

API-база НЕ хардкодится — берётся из `app.json` extras + platform-conditional default.

| Среда                                        | URL                                  |
| -------------------------------------------- | ------------------------------------ |
| Android-эмулятор (OpenServer на host-машине) | `http://10.0.2.2:8000/api/v1`        |
| Физический Android в той же Wi-Fi сети       | `http://<IP-OpenServer>:8000/api/v1` |

`<IP-OpenServer>` — IP машины, на которой запущен Laravel (`php artisan serve` или OpenServer). Узнать через `ipconfig` (Windows) или `ifconfig` (Linux/macOS) — обычно `192.168.x.x`.

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

## ⚠️ Ограничение Expo Go

В Expo Go **`activity-alias` (вторая иконка «Приступ» в лаунчере) НЕ работает** — это известное ограничение. Для проверки второй иконки (Этап 3) нужен dev или preview build через EAS / `expo run:android`.

Подробнее — [`PLAN.md` §3](./PLAN.md) и [`MOBILE.md` §4](../../MOBILE.md).

## Сквозные правила

- Без `localhost` в клиентском коде.
- Только HTTPS в проде; cleartext — только для debug-сборок (через config plugin, Этап 1+).
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
├── app/              # expo-router (file-based)
│   ├── _layout.tsx   # root Stack
│   └── index.tsx     # placeholder home
├── assets/           # иконки
└── plugins/          # config plugins (Этап 3+)
```

## Связанные документы

- [`mobile/PLAN.md`](./PLAN.md) — 5 этапов, scope, критерии приёмки.
- [`MOBILE.md`](../../MOBILE.md) — концепт: зачем нужен мобильный клиент, контракт API, сквозные правила.
- [`CLAUDE.md`](../../CLAUDE.md) — общие правила репо (минимальный набор тестов, форматирование).
