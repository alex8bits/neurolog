<?php

namespace App\Http\Controllers;

use App\Http\Requests\Medications\IndexMedicationsRequest;
use App\Http\Requests\Medications\StoreMedicationRequest;
use App\Http\Requests\Medications\UpdateMedicationRequest;
use App\Http\Resources\MedicationRowResource;
use App\Services\MedicationQuery;
use App\Services\MedicationWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Web-side medications: list, create, edit, soft delete one's own records.
 *
 * The `{medication}` route parameter is a `string` (with
 * `whereNumber('medication')` in `routes/web.php`) for the same reason as in
 * `SeizureController`: a digits-only value larger than `PHP_INT_MAX` must not
 * become a `TypeError` (500) on its way in.
 */
class MedicationController extends Controller
{
    /**
     * The page size of the medications list. Fixed: clients cannot ask for
     * more or fewer rows.
     */
    private const PER_PAGE = 20;

    public function __construct(
        private readonly MedicationQuery $query,
        private readonly MedicationWriter $writer,
    ) {}

    /**
     * Show the medications page for the authenticated user, filtered and
     * ordered by relevance in the owner's profile timezone.
     *
     * A page past the end (e.g. after deleting the last row of the last page)
     * redirects to the last existing page instead of rendering an empty list.
     */
    public function index(IndexMedicationsRequest $request): Response|RedirectResponse
    {
        $user = $request->user();
        $filters = $request->filters();

        $paginator = $this->query
            ->paginateForUser($user, $filters, null, self::PER_PAGE)
            ->withQueryString();

        if ($paginator->currentPage() > 1 && $paginator->isEmpty()) {
            return redirect()->to($paginator->url($paginator->lastPage()));
        }

        $request->attributes->set(
            MedicationRowResource::TODAY_ATTRIBUTE,
            $this->query->todayFor($user, null),
        );

        return Inertia::render('Medications', [
            'medications' => MedicationRowResource::collection($paginator),
            'filters' => $filters->toArray(),
        ]);
    }

    /**
     * Create a new medication for the authenticated user.
     */
    public function store(StoreMedicationRequest $request): RedirectResponse
    {
        $this->writer->create($request->user(), $request->medicationInput());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Медикамент добавлен.']);

        return back();
    }

    /**
     * Update one of the authenticated user's medications.
     */
    public function update(UpdateMedicationRequest $request, string $medication): RedirectResponse
    {
        $this->writer->update($request->user(), $medication, $request->medicationInput());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Медикамент обновлён.']);

        return back();
    }

    /**
     * Soft delete one of the authenticated user's medications.
     */
    public function destroy(Request $request, string $medication): RedirectResponse
    {
        $this->writer->delete($request->user(), $medication);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Медикамент удалён.']);

        return back();
    }
}
