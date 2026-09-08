<?php

namespace App\Services;

use App\Http\Resources\SeizureRowResource;
use App\Support\SeizurePeriodReport;
use PhpOffice\PhpWord\PhpWord;

/**
 * Builds the DOCX body for a {@see SeizurePeriodReport}. Format rules live
 * in concept.md §8 and in the docblock of {@see SeizureRowResource}
 * (the web table and the document must use the same date/time formats).
 *
 * Returns a configured PhpWord; callers decide where to serialize it
 * (temp file for download, php://memory for mail attachment).
 */
class SeizureDocxBuilder
{
    /** MIME-тип генерируемого документа (Word 2007 OOXML) — единая точка
     *  для контроллеров скачивания, Mailable и тестов. */
    public const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private const FONT = 'Courier New';

    private const SIZE_BODY = 11;

    private const SIZE_HEADER = 12;

    public function build(SeizurePeriodReport $report): PhpWord
    {
        $phpWord = new PhpWord;
        $phpWord->setDefaultFontName(self::FONT);
        $phpWord->setDefaultFontSize(self::SIZE_BODY);

        // Стили
        $phpWord->addFontStyle('day-header', [
            'name' => self::FONT,
            'size' => self::SIZE_HEADER,
            'bold' => true,
        ]);
        $phpWord->addParagraphStyle('day-block', [
            'spacing' => ['before' => 0, 'after' => 120],  // ~6pt после блока
        ]);

        $section = $phpWord->addSection([
            'marginTop' => 1200, 'marginBottom' => 1200,
            'marginLeft' => 1200, 'marginRight' => 1200,
        ]);

        foreach ($report->days as $dayIndex => $day) {
            if ($dayIndex > 0) {
                $section->addTextBreak(1);   // пустая строка между днями (требование §8)
            }
            $section->addText($day->date, 'day-header', 'day-block');
            foreach ($day->entries as $entry) {
                $line = $entry['time'].($entry['comment'] ? ' '.$entry['comment'] : '');
                $section->addText($line, null, 'day-block');
            }
        }

        // Пустой отчёт — одна строка-пояснение
        if ($report->days === []) {
            $section->addText(
                'За выбранный период приступов нет.',
                ['italic' => true, 'color' => '666666'],
            );
        }

        return $phpWord;
    }
}
