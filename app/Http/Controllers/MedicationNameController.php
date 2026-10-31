<?php

namespace App\Http\Controllers;

use App\Http\Requests\MedicationNames\StoreMedicationNameRequest;
use App\Http\Requests\MedicationNames\UpdateMedicationNameRequest;
use App\Http\Resources\MedicationNameRowResource;
use App\Services\MedicationNameQuery;
use App\Services\MedicationNameWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Web-side personal medication dictionary: list, add, rename, delete one's own entries.
 *
 * The `{medicationName}` route parameter is a `string` (with
 * `whereNumber('medicationName')` in `routes/web.php`) for the same reason as
 * in `MedicationController`: a digits-only value larger than `PHP_INT_MAX`
 * must not become a `TypeError` (500) on its way in.
 */
class MedicationNameController extends Controller
{
    public function __construct(
        private readonly MedicationNameQuery $query,
        private readonly MedicationNameWriter $writer,
    ) {}

    /**
     * Show the authenticated user's dictionary.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('MedicationNames', [
            'medicationNames' => MedicationNameRowResource::collection(
                $this->query->allForUser($request->user()),
            )->resolve(),
        ]);
    }

    /**
     * Add an entry to the authenticated user's dictionary.
     */
    public function store(StoreMedicationNameRequest $request): RedirectResponse
    {
        $this->writer->create($request->user(), $request->nameInput());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Лекарство добавлено в справочник.']);

        return back();
    }

    /**
     * Rename one of the authenticated user's entries.
     */
    public function update(UpdateMedicationNameRequest $request, string $medicationName): RedirectResponse
    {
        $this->writer->rename($request->user(), $medicationName, $request->nameInput());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Название обновлено.']);

        return back();
    }

    /**
     * Delete one of the authenticated user's entries (refused while it is in use).
     */
    public function destroy(Request $request, string $medicationName): RedirectResponse
    {
        $this->writer->delete($request->user(), $medicationName);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Лекарство удалено из справочника.']);

        return back();
    }
}
