<?php

namespace Tests\Unit\Services;

use App\Models\User;
use App\Services\SeizureDocxBuilder;
use App\Services\SeizureQuery;
use App\Support\SeizurePeriodReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpWord\PhpWord;
use Tests\TestCase;

class SeizureDocxBuilderTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_returns_phpword_for_a_simple_report(): void
    {
        $owner = User::factory()->create(['timezone' => 'Europe/Moscow']);

        $report = new SeizurePeriodReport(
            owner: $owner,
            from: '2026-05-10',
            to: '2026-05-10',
            query: app(SeizureQuery::class),
        );

        // В этом тестовом сценарии seizures не создаются (SmokeTest), проверяется
        // только что build() не бросает и возвращает PhpWord.
        $phpWord = app(SeizureDocxBuilder::class)->build($report);

        $this->assertInstanceOf(PhpWord::class, $phpWord);
    }
}
