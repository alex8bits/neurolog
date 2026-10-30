<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Controllers\SeizureController;
use App\Http\Requests\Api\V1\EmailDoctorRequest;
use App\Http\Requests\Api\V1\IndexSeizureRequest;
use App\Mail\JournalReport;
use App\Services\MedicationQuery;
use App\Services\SeizureDocxBuilder;
use App\Services\SeizureQuery;
use App\Support\JournalFilename;
use App\Support\SeizurePeriodReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use PhpOffice\PhpWord\IOFactory;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Mobile journal export: download the period as DOCX and email it — to the
 * owner or an arbitrary recipient. Mirrors the export actions of the web
 * {@see SeizureController} but answers without
 * Inertia: a binary file download and JSON `{message}` payloads.
 *
 * The server chain (SeizurePeriodReport → SeizureDocxBuilder →
 * JournalFilename → JournalReport) is shared with the web, so both clients
 * produce identical documents and emails. Unlike the web, the report
 * timezone comes from the request: the mobile client interprets the period
 * in the device's timezone, and the export must show the same days as the
 * list screen.
 */
class JournalExportController extends Controller
{
    public function __construct(
        private readonly SeizureQuery $query,
        private readonly SeizureDocxBuilder $docxBuilder,
        private readonly MedicationQuery $medications,
    ) {}

    /**
     * GET /api/v1/seizures/export.docx?from&to&timezone — download the
     * period as a DOCX file.
     *
     * PhpWord's `Word2007::save()` only accepts a real filename (it rewrites
     * `php://…` URIs into a temp file under the hood), so the document is
     * materialised to a tempnam() and handed to `response()->download()`.
     * The file is small (tens of KB) and a shutdown hook unlinks it once the
     * response has been sent.
     */
    public function download(IndexSeizureRequest $request): BinaryFileResponse
    {
        $report = new SeizurePeriodReport(
            owner: $request->user(),
            from: $request->fromInput(),
            to: $request->toInput(),
            query: $this->query,
            medications: $this->medications,
            timezone: $request->timezoneInput(),
        );

        $filename = JournalFilename::for($report->from, $report->to);
        $phpWord = $this->docxBuilder->build($report);

        $tmp = tempnam(sys_get_temp_dir(), 'journal-api-');
        IOFactory::createWriter($phpWord, 'Word2007')->save($tmp);
        register_shutdown_function(static fn () => @unlink($tmp));

        return response()->download($tmp, $filename, [
            'Content-Type' => SeizureDocxBuilder::DOCX_MIME,
        ]);
    }

    /**
     * POST /api/v1/seizures/email-self?from&to&timezone — email the period
     * DOCX to the owner. The request body is empty; the recipient is always
     * the authenticated user's own address.
     */
    public function emailSelf(IndexSeizureRequest $request): JsonResponse
    {
        $user = $request->user();
        $report = new SeizurePeriodReport(
            owner: $user,
            from: $request->fromInput(),
            to: $request->toInput(),
            query: $this->query,
            medications: $this->medications,
            timezone: $request->timezoneInput(),
        );

        Mail::send(new JournalReport(
            owner: $user,
            report: $report,
            recipientEmail: $user->email,
            recipientName: $user->name,
        ));

        return response()->json(['message' => "Отправлено на {$user->email}."]);
    }

    /**
     * POST /api/v1/seizures/email-doctor?from&to&timezone — email the period
     * DOCX to an arbitrary recipient with optional subject / body overrides.
     *
     * `from` / `to` / `timezone` arrive as query parameters and are
     * validated by {@see EmailDoctorRequest::validatedPeriod()} — the query
     * bag is validated separately from the body fields because the query
     * `to` (a date bound) shares its key with the body `to` (the recipient
     * address). An unvalidated bound would make
     * `SeizureQuery::forPeriod()` throw instead of producing a validation
     * error.
     *
     * The body is stripped of tags before being passed to the Mailable: the
     * markdown template renders the value as plain text, and user-supplied
     * HTML/Markdown could otherwise inject markup.
     */
    public function emailDoctor(EmailDoctorRequest $request): JsonResponse
    {
        $user = $request->user();

        $period = $request->validatedPeriod();

        $report = new SeizurePeriodReport(
            owner: $user,
            from: $period['from'],
            to: $period['to'],
            query: $this->query,
            medications: $this->medications,
            timezone: $period['timezone'],
        );

        $bodyInput = $request->bodyInput();
        $body = $bodyInput !== null ? strip_tags($bodyInput) : null;

        $to = (string) $request->toInput();

        Mail::send(new JournalReport(
            owner: $user,
            report: $report,
            recipientEmail: $to,
            recipientName: null,
            subject: $request->subjectInput(),
            body: $body,
        ));

        return response()->json(['message' => "Отправлено на {$to}."]);
    }
}
