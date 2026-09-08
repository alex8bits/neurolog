<?php

namespace App\Http\Controllers;

use App\Http\Requests\Seizures\EmailDoctorRequest;
use App\Http\Requests\Seizures\IndexJournalRequest;
use App\Http\Requests\Seizures\StoreSeizureRequest;
use App\Http\Requests\Seizures\UpdateSeizureRequest;
use App\Http\Resources\SeizureRowResource;
use App\Mail\JournalReport;
use App\Services\SeizureDocxBuilder;
use App\Services\SeizureQuery;
use App\Services\SeizureWriter;
use App\Support\JournalFilename;
use App\Support\SeizurePeriodReport;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpWord\IOFactory;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Web-side journal: list, edit, soft delete one's own seizures, plus the
 * slice-4 export/print/email actions.
 *
 * The `{seizure}` route parameter is a `string` (with `whereNumber('seizure')`
 * in `routes/web.php`) for the same reason as in the API controller: a
 * digits-only value larger than `PHP_INT_MAX` must not become a `TypeError`
 * (500) on its way in.
 */
class SeizureController extends Controller
{
    /**
     * The page size of the journal table. Fixed: clients cannot ask for more
     * or fewer rows.
     */
    private const PER_PAGE = 50;

    public function __construct(
        private readonly SeizureQuery $query,
        private readonly SeizureWriter $writer,
        private readonly SeizureDocxBuilder $docxBuilder,
    ) {}

    /**
     * Show the journal page for the authenticated user, filtered by period.
     */
    public function index(IndexJournalRequest $request): Response
    {
        $paginator = $this->query->paginateForPeriod(
            $request->user(),
            $request->fromInput(),
            $request->toInput(),
            null,
            self::PER_PAGE,
        )->withQueryString();

        return Inertia::render('Journal', [
            'seizures' => SeizureRowResource::collection($paginator),
            'filters' => [
                'from' => $request->fromInput(),
                'to' => $request->toInput(),
            ],
        ]);
    }

    /**
     * Update one of the authenticated user's seizures.
     */
    public function update(UpdateSeizureRequest $request, string $seizure): RedirectResponse
    {
        $this->writer->update(
            $request->user(),
            $seizure,
            $request->occurredAtInput(),
            $request->commentInput(),
        );

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запись обновлена.']);

        return back();
    }

    /**
     * Create a new seizure for the authenticated user.
     *
     * The absence of `occurred_at` falls through to `SeizureMomentNormalizer::normalize()`,
     * which substitutes `now('UTC')` (concept.md §3.2, research 2026-08-04 §3).
     */
    public function store(StoreSeizureRequest $request): RedirectResponse
    {
        $this->writer->record(
            $request->user(),
            $request->occurredAtInput(),
            $request->commentInput(),
        );

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Запись добавлена.',
        ]);

        return back();
    }

    /**
     * Soft delete one of the authenticated user's seizures.
     */
    public function destroy(Request $request, string $seizure): RedirectResponse
    {
        $this->writer->delete($request->user(), $seizure);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запись удалена.']);

        return back();
    }

    /**
     * GET /seizures/export.docx?from&to — download the period as a DOCX file.
     *
     * PhpWord's `Word2007::save()` only accepts a real filename (it rewrites
     * `php://…` URIs into a temp file under the hood), so we materialise the
     * document to a tempnam() and hand that path to `response()->download()`.
     * The file is small (tens of KB) and we register a shutdown hook to
     * unlink it once the response has been sent.
     */
    public function download(IndexJournalRequest $request): BinaryFileResponse
    {
        $user = $request->user();
        $report = new SeizurePeriodReport(
            owner: $user,
            from: $request->fromInput(),
            to: $request->toInput(),
            query: $this->query,
        );

        $filename = JournalFilename::for($report->from, $report->to);
        $phpWord = $this->docxBuilder->build($report);

        $tmp = tempnam(sys_get_temp_dir(), 'journal-');
        IOFactory::createWriter($phpWord, 'Word2007')->save($tmp);
        register_shutdown_function(static fn () => @unlink($tmp));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Файл сохранён.']);

        return response()->download($tmp, $filename, [
            'Content-Type' => SeizureDocxBuilder::DOCX_MIME,
        ]);
    }

    /**
     * GET /journal/print?from&to — printable HTML version of the period.
     *
     * This is the first non-Inertia view in the controller: the page is meant
     * to be opened in a new tab and printed, not navigated through the SPA.
     */
    public function print(IndexJournalRequest $request): View
    {
        $report = new SeizurePeriodReport(
            owner: $request->user(),
            from: $request->fromInput(),
            to: $request->toInput(),
            query: $this->query,
        );

        return view('journal.print', ['report' => $report]);
    }

    /**
     * POST /seizures/email-self — email the period DOCX to the owner.
     */
    public function emailSelf(IndexJournalRequest $request): RedirectResponse
    {
        $user = $request->user();
        $report = new SeizurePeriodReport(
            owner: $user,
            from: $request->fromInput(),
            to: $request->toInput(),
            query: $this->query,
        );

        Mail::send(new JournalReport(
            owner: $user,
            report: $report,
            recipientEmail: $user->email,
            recipientName: $user->name,
        ));

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Отправлено на {$user->email}.",
        ]);

        return back();
    }

    /**
     * POST /seizures/email-doctor — email the period DOCX to an arbitrary
     * recipient with optional subject / body overrides.
     *
     * `from` / `to` arrive as query parameters on the action URL and are
     * validated by {@see EmailDoctorRequest::validatedPeriod()} — the query
     * bag is validated separately from the body fields because the query
     * `to` (a date bound) shares its key with the body `to` (the recipient
     * address). The action URL is always constructed by the SPA from an
     * already-validated pair, but an unvalidated bound would make
     * `SeizureQuery::forPeriod()` throw instead of producing a validation
     * error.
     *
     * The body is stripped of tags before being passed to the Mailable: the
     * markdown template renders the value as plain text, and user-supplied
     * HTML/Markdown could otherwise inject markup.
     */
    public function emailDoctor(EmailDoctorRequest $request): RedirectResponse
    {
        $user = $request->user();

        $period = $request->validatedPeriod();

        $report = new SeizurePeriodReport(
            owner: $user,
            from: $period['from'],
            to: $period['to'],
            query: $this->query,
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

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => "Отправлено на {$to}.",
        ]);

        return back();
    }
}
