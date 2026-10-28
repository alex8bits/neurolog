/**
 * Файловое хранилище автономного режима: JSON-файлы в Paths.document.
 * Запись атомарная — сначала `<name>.tmp`, затем move поверх `<name>`
 * (File.move с overwrite из expo-file-system ~57).
 */

import { File, Paths } from 'expo-file-system';

export const JOURNAL_CACHE_FILE = 'journal-cache.json';
export const OUTBOX_FILE = 'outbox.json';

const fileFor = (name: string) => new File(Paths.document, name);

const tmpName = (name: string) => `${name}.tmp`;

/** Есть ли файл (или недописанная атомарная замена его) на диске. */
export function fileExists(name: string): boolean {
    return fileFor(name).exists || fileFor(tmpName(name)).exists;
}

async function parseFile<T>(file: File): Promise<T | null> {
    try {
        return JSON.parse(await file.text()) as T;
    } catch {
        return null;
    }
}

/**
 * Содержимое JSON-файла; нет файла или он не парсится → null. Если основного
 * файла нет, а tmp есть — процесс умер между удалением старого и переносом
 * нового (move с overwrite на Android удаляет цель перед переносом): tmp к
 * этому моменту дописан полностью, читаем его.
 */
export async function readJson<T>(name: string): Promise<T | null> {
    const file = fileFor(name);

    if (file.exists) {
        return parseFile<T>(file);
    }

    const tmp = fileFor(tmpName(name));

    return tmp.exists ? parseFile<T>(tmp) : null;
}

/**
 * Атомарная запись: tmp целиком, затем перенос поверх основного файла.
 * Осиротевший tmp (основной файл уже удалён move-ом, процесс умер до
 * переноса) — единственная хорошая копия: если он читается, сначала
 * продвигаем его в основной файл и только потом пишем новый tmp.
 */
export async function writeJsonAtomic(
    name: string,
    data: unknown,
): Promise<void> {
    const main = fileFor(name);
    const tmp = fileFor(tmpName(name));

    if (!main.exists && tmp.exists && (await parseFile(tmp)) !== null) {
        await tmp.move(main, { overwrite: true });
    }

    const next = fileFor(tmpName(name));

    next.write(JSON.stringify(data));

    await next.move(fileFor(name), { overwrite: true });
}

/** Удаляет файл и его возможный tmp; отсутствие файла — не ошибка. */
export function removeFile(name: string): void {
    for (const file of [fileFor(name), fileFor(tmpName(name))]) {
        if (file.exists) {
            file.delete();
        }
    }
}

/** Копия файла (или его tmp) `<name>.<suffix>-<timestamp>`. */
async function backupAs(name: string, suffix: string): Promise<void> {
    const source = fileFor(name).exists
        ? fileFor(name)
        : fileFor(tmpName(name));

    if (!source.exists) {
        return;
    }

    await source.copy(fileFor(`${name}.${suffix}-${Date.now()}`), {
        overwrite: true,
    });
}

/**
 * Копия нечитаемого файла `<name>.corrupt-<timestamp>` для диагностики —
 * очередь с неотправленными данными молча не перезаписываем.
 */
export function backupCorrupt(name: string): Promise<void> {
    return backupAs(name, 'corrupt');
}

/**
 * Копия файла другого владельца `<name>.foreign-<timestamp>` — непустую
 * очередь (например, после сбоя переименования владельца при смене
 * email) перед удалением не теряем.
 */
export function backupForeign(name: string): Promise<void> {
    return backupAs(name, 'foreign');
}
