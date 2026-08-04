<?php

namespace Tests\Unit\Support;

use App\Support\JournalFilename;
use PHPUnit\Framework\TestCase;

/**
 * The DOCX filename is the only piece of localized user-facing text the
 * export pipeline produces on its own (the rest comes from a template), so
 * it's worth pinning the three distinct shapes the controller will hit.
 */
class JournalFilenameTest extends TestCase
{
    public function test_filename_with_period(): void
    {
        $this->assertSame(
            'Журнал_приступов_10.05.2026_12.05.2026.docx',
            JournalFilename::for('2026-05-10', '2026-05-12'),
        );
    }

    public function test_filename_without_period(): void
    {
        $this->assertSame(
            'Журнал_приступов_полный.docx',
            JournalFilename::for(null, null),
        );
    }

    public function test_filename_for_single_day(): void
    {
        $this->assertSame(
            'Журнал_приступов_10.05.2026.docx',
            JournalFilename::for('2026-05-10', '2026-05-10'),
        );
    }
}
