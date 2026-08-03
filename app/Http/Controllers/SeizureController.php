<?php

namespace App\Http\Controllers;

use App\Http\Requests\Seizures\IndexJournalRequest;
use App\Http\Requests\Seizures\UpdateSeizureRequest;
use App\Http\Resources\SeizureRowResource;
use App\Services\SeizureQuery;
use App\Services\SeizureWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Web-side journal: list, edit, soft delete one's own seizures.
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
     * Soft delete one of the authenticated user's seizures.
     */
    public function destroy(Request $request, string $seizure): RedirectResponse
    {
        $this->writer->delete($request->user(), $seizure);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Запись удалена.']);

        return back();
    }
}
