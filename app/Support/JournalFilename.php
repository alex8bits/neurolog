<?php

namespace App\Support;

/**
 * Builds the localized filename for a DOCX export. Pure function — no
 * dependencies, easy to unit-test.
 *
 * Rules:
 *   - both bounds:  'Журнал_приступов_дд.мм.гггг_дд.мм.гггг.docx'
 *   - one bound:    'Журнал_приступов_с_дд.мм.гггг.docx' / '…_по_…'
 *   - equal bounds: 'Журнал_приступов_дд.мм.гггг.docx'
 *   - no bounds:    'Журнал_приступов_полный.docx'
 *
 * `$from` and `$to` arrive as `Y-m-d` (already validated by the request layer).
 */
final class JournalFilename
{
    public static function for(?string $from, ?string $to): string
    {
        $base = 'Журнал_приступов';

        $stamp = static function (string $ymd): string {
            [$y, $m, $d] = explode('-', $ymd);

            return "{$d}.{$m}.{$y}";
        };

        $hasFrom = $from !== null;
        $hasTo = $to !== null;

        if (! $hasFrom && ! $hasTo) {
            $tail = 'полный';
        } elseif ($hasFrom && ! $hasTo) {
            $tail = 'с_'.$stamp($from);
        } elseif (! $hasFrom) {
            $tail = 'по_'.$stamp($to);
        } elseif ($from === $to) {
            $tail = $stamp($from);
        } else {
            $tail = $stamp($from).'_'.$stamp($to);
        }

        return "{$base}_{$tail}.docx";
    }
}
