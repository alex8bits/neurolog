import { describe, expect, it } from 'vitest';

import { patchMainActivity } from '../plugins/activity-alias/plugin';

/**
 * Упрощённый kotlin-шаблон MainActivity до патча (по фактическому
 * android/app/src/main/java/com/alex8bits/seizure/MainActivity.kt,
 * сгенерированному prebuild): onCreate с super.onCreate(null),
 * без onNewIntent/stampQuickIntent.
 */
const TEMPLATE = `package com.alex8bits.seizure

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return DefaultReactActivityDelegate(this, mainComponentName)
  }
}
`;

/** Число вхождений подстроки — для проверки отсутствия дубликатов. */
function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

describe('patchMainActivity', () => {
    it('happy path: stampQuickIntent первой строкой onCreate, onNewIntent-override и импорты на месте', () => {
        const patched = patchMainActivity(TEMPLATE);

        expect(patched).toMatch(
            /override fun onCreate\(savedInstanceState: Bundle\?\) \{\n {4}stampQuickIntent\(intent\)\n {4}\/\/ Set the theme/,
        );
        expect(patched).toContain(
            '  override fun onNewIntent(intent: Intent) {',
        );
        expect(patched).toContain(
            '  private fun stampQuickIntent(intent: Intent?) {',
        );
        expect(patched).toContain('intent.action = Intent.ACTION_VIEW');
        expect(patched).toContain('intent.data = Uri.parse("seizure://quick")');
        expect(patched).toContain('import android.content.Intent');
        expect(patched).toContain('import android.net.Uri');
    });

    it('stamp: лаунчерный intent (ACTION_MAIN) превращается в VIEW-deep-link — action ставится до data', () => {
        const patched = patchMainActivity(TEMPLATE);

        // Гвард прежний: только alias-компонент и только без существующего data.
        expect(patched).toContain(
            'if (component.className == "$packageName.QuickEntryAlias" && intent.data == null) {',
        );
        // Оба якоря обязаны существовать: без гвардов -1 делал бы сравнение
        // порядка ложно-зелёным (например, -1 < 0 при пропавшей первой строке).
        const actionIndex = patched.indexOf(
            'intent.action = Intent.ACTION_VIEW',
        );
        const dataIndex = patched.indexOf(
            'intent.data = Uri.parse("seizure://quick")',
        );
        expect(actionIndex).toBeGreaterThanOrEqual(0);
        expect(dataIndex).toBeGreaterThanOrEqual(0);
        expect(actionIndex).toBeLessThan(dataIndex);
    });

    it('happy path: импорты вставлены в алфавитном порядке блока', () => {
        const patched = patchMainActivity(TEMPLATE);

        expect(patched.indexOf('import android.content.Intent')).toBeLessThan(
            patched.indexOf('import android.os.Build'),
        );
        expect(patched.indexOf('import android.net.Uri')).toBeLessThan(
            patched.indexOf('import android.os.Build'),
        );
    });

    it('happy path: super.onCreate(null) шаблона не заменяется на super.onCreate(savedInstanceState)', () => {
        const patched = patchMainActivity(TEMPLATE);

        expect(patched).toContain('super.onCreate(null)');
        expect(patched).not.toContain('super.onCreate(savedInstanceState)');
    });

    it('идемпотентность: повторный патч не меняет файл и не дублирует методы/импорты', () => {
        const once = patchMainActivity(TEMPLATE);
        const twice = patchMainActivity(once);

        expect(twice).toBe(once);
        expect(count(twice, 'stampQuickIntent')).toBe(3);
        expect(count(twice, 'override fun onNewIntent')).toBe(1);
        expect(count(twice, 'override fun onCreate')).toBe(1);
        expect(count(twice, 'import android.content.Intent')).toBe(1);
        expect(count(twice, 'import android.net.Uri')).toBe(1);
    });

    it('fail-fast: нет якоря class MainActivity — ошибка', () => {
        const broken = TEMPLATE.replace(
            'class MainActivity : ReactActivity() {',
            'class OtherActivity : ReactActivity() {',
        );

        expect(() => patchMainActivity(broken)).toThrow(
            /class MainActivity : ReactActivity\(\) \{.*отсутствует/,
        );
    });

    it('fail-fast: нет onCreate — ошибка, а не генерация нового override', () => {
        const broken = TEMPLATE.replace(
            /  override fun onCreate\(savedInstanceState: Bundle\?\) \{[\s\S]*?\n  \}\n/,
            '',
        );

        expect(broken).not.toContain('onCreate');
        expect(() => patchMainActivity(broken)).toThrow(
            /onCreate.*Шаблон без onCreate не поддерживается/,
        );
    });
});
