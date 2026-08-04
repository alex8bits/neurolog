<?php

namespace App\Mail;

use App\Models\User;
use App\Services\SeizureDocxBuilder;
use App\Support\JournalFilename;
use App\Support\SeizurePeriodReport;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use PhpOffice\PhpWord\IOFactory;

/**
 * The journal export sent to the user (themselves or a doctor). The DOCX
 * body is built once in the constructor and re-used by attachments(); the
 * bytes are small (tens of KB) so caching them in memory is cheap.
 *
 * From address: config('mail.from') (SPF/DKIM/DMARC-safe).
 * Reply-To:     $owner->email (so the doctor's reply reaches the user).
 * See concept.md §7.6.
 */
class JournalReport extends Mailable
{
    use Queueable, SerializesModels;

    public ?string $body = null;

    private string $docxBytes;

    private string $filename;

    private ?string $customSubject;

    private SeizureDocxBuilder $docxBuilder;

    public function __construct(
        public User $owner,
        public SeizurePeriodReport $report,
        public string $recipientEmail,
        public ?string $recipientName = null,
        ?string $subject = null,
        ?string $body = null,
        ?SeizureDocxBuilder $docxBuilder = null,
    ) {
        // `$subject` and `$body` are kept on private fields rather than
        // promoted to typed public properties: the parent Mailable already
        // declares an untyped public $subject, and overloading it with a
        // typed property is not allowed by PHP.
        $this->customSubject = $subject;
        $this->body = $body;

        $this->docxBuilder = $docxBuilder ?? app(SeizureDocxBuilder::class);
        $this->filename = JournalFilename::for($report->from, $report->to);

        // Materialise the DOCX once — re-used in attachments().
        //
        // PhpWord's Word2007::save() only accepts a string filename (and
        // silently rewrites a `php://…` URI into a tempnam() under the hood
        // before writing, so streaming back from `php://memory` does not
        // return what was just written). The most predictable path is a
        // real temp file: writer saves to it, we slurp the bytes, then
        // unlink. The file is small (tens of KB) and lives only for the
        // duration of this constructor call.
        $phpWord = $this->docxBuilder->build($report);
        $tmpFile = tempnam(sys_get_temp_dir(), 'journal-report-');
        try {
            IOFactory::createWriter($phpWord, 'Word2007')->save($tmpFile);
            $this->docxBytes = (string) file_get_contents($tmpFile);
        } finally {
            @unlink($tmpFile);
        }
    }

    public function envelope(): Envelope
    {
        $from = config('mail.from');

        return new Envelope(
            from: new Address(
                $from['address'] ?? '',
                $from['name'] ?? null,
            ),
            replyTo: [new Address($this->owner->email, $this->owner->name)],
            to: [new Address($this->recipientEmail, $this->recipientName)],
            subject: $this->customSubject ?? 'Журнал приступов '.$this->report->periodLabel(),
        );
    }

    public function content(): Content
    {
        // `periodLabel()` already includes its own preposition (`за 10.05.2026`,
        // `с X по Y`, `весь журнал`), so the template relies on it and does
        // NOT add `за ` again. M1 fix.
        $defaultBody = sprintf(
            '%s, во вложении — журнал приступов %s (%d записей).',
            $this->recipientName ?? 'Здравствуйте',
            $this->report->periodLabel(),
            $this->report->totalEntries,
        );

        return new Content(
            markdown: 'emails.journal',
            with: [
                'body' => $this->body ?? $defaultBody,
                'attachmentName' => $this->filename,
                'periodLabel' => $this->report->periodLabel(),
                'totalEntries' => $this->report->totalEntries,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [
            Attachment::fromData(
                fn (): string => $this->docxBytes,
                $this->filename,
            )->withMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ];
    }
}
