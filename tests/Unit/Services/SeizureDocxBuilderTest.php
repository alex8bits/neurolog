<?php

namespace Tests\Unit\Services;

use App\Models\Medication;
use App\Models\Seizure;
use App\Models\User;
use App\Services\MedicationQuery;
use App\Services\SeizureDocxBuilder;
use App\Services\SeizureQuery;
use App\Support\SeizurePeriodReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use Tests\TestCase;
use ZipArchive;

class SeizureDocxBuilderTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_returns_phpword_for_a_simple_report(): void
    {
        $owner = User::factory()->create(['timezone' => 'Europe/Moscow']);
        // «&» и «<» в тексте не должны ломать document.xml.
        Medication::factory()->for($owner)->between('2026-05-01', null)->create(['name' => 'Депакин & Хроно']);
        Seizure::factory()->for($owner)->occurredAt('2026-05-10 09:00:00')->create(['comment' => 'a < b']);

        $report = new SeizurePeriodReport(
            owner: $owner,
            from: '2026-05-10',
            to: '2026-05-10',
            query: app(SeizureQuery::class),
            medications: app(MedicationQuery::class),
        );

        $phpWord = app(SeizureDocxBuilder::class)->build($report);

        $this->assertInstanceOf(PhpWord::class, $phpWord);

        $file = (string) tempnam(sys_get_temp_dir(), 'docx-test-');
        IOFactory::createWriter($phpWord, 'Word2007')->save($file);
        $zip = new ZipArchive;
        $zip->open($file);
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();
        @unlink($file);

        $this->assertStringContainsString('Депакин &amp; Хроно', $xml);
        $this->assertNotFalse(@simplexml_load_string($xml));
    }
}
