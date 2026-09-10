/**
 * Чистое ядро решения «предлагать ли обновление»: численное сравнение
 * триплетов X.Y.Z и предикат показа промпта с учётом сохранённого отказа.
 * Сравниваем строку `version`, а не versionCode: рантайм-источника у
 * versionCode нет, а оба поля публикуются из одного app.json одним
 * скриптом (mobile/scripts/publish-apk.sh:60-74). Формат версии проекта
 * строго «X.Y.Z» (mobile/app.json:6), битая/нечисловая версия трактуется
 * как «не новее» — fail-closed, промпт не показываем.
 * Платформо-независимый модуль — без импортов React/RN (как period.ts).
 */

/** Строгий триплет «цифры.цифры.цифры» — без prerelease-тегов и сборок. */
const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** Численный триплет [major, minor, patch]; всё вне формата — null. */
function parseVersion(value: string): [number, number, number] | null {
    const match = VERSION_RE.exec(value);

    if (!match) {
        return null;
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * candidate строго больше installed по компонентам; любая из сторон
 * не парсится — false (fail-closed: «0.0.10» > «0.0.9» строкой не
 * сравнить, битая версия промпта не даёт).
 */
export function isNewerVersion(candidate: string, installed: string): boolean {
    const candidateParts = parseVersion(candidate);
    const installedParts = parseVersion(installed);

    if (!candidateParts || !installedParts) {
        return false;
    }

    const [candidateMajor, candidateMinor, candidatePatch] = candidateParts;
    const [installedMajor, installedMinor, installedPatch] = installedParts;

    if (candidateMajor !== installedMajor) {
        return candidateMajor > installedMajor;
    }

    if (candidateMinor !== installedMinor) {
        return candidateMinor > installedMinor;
    }

    return candidatePatch > installedPatch;
}

/**
 * Показывать ли промпт обновления: мета валидна и новее установленной,
 * установленная валидна, и на эту версию меты нет сохранённого отказа.
 * Любой null/''/битый компонент — false (в Expo Go nativeApplicationVersion —
 * версия самого Expo Go, промпт там не нужен — покрывается правилом
 * валидности установленной версии).
 */
export function shouldPromptForUpdate(input: {
    metaVersion: string | null;
    installedVersion: string | null;
    dismissedVersion: string | null;
}): boolean {
    const { metaVersion, installedVersion, dismissedVersion } = input;

    if (!installedVersion || !parseVersion(installedVersion)) {
        return false;
    }

    if (!metaVersion || !parseVersion(metaVersion)) {
        return false;
    }

    if (!isNewerVersion(metaVersion, installedVersion)) {
        return false;
    }

    if (metaVersion === dismissedVersion) {
        return false;
    }

    return true;
}
