<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexMedicationNameRequest;
use App\Http\Requests\Api\V1\StoreMedicationNameRequest;
use App\Http\Requests\Api\V1\UpdateMedicationNameRequest;
use App\Http\Resources\Api\V1\MedicationNameResource;
use App\Services\MedicationNameQuery;
use App\Services\MedicationNameWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class MedicationNameController extends Controller
{
    public function __construct(
        private readonly MedicationNameWriter $writer,
        private readonly MedicationNameQuery $query,
    ) {}

    /**
     * List the authenticated user's dictionary (no pagination), optionally filtered by `q`.
     */
    public function index(IndexMedicationNameRequest $request): AnonymousResourceCollection
    {
        return MedicationNameResource::collection($this->query->allForUser($request->user(), $request->q()));
    }

    /**
     * Add an entry to the authenticated user's dictionary.
     */
    public function store(StoreMedicationNameRequest $request): JsonResponse
    {
        $entry = $this->writer->create($request->user(), $request->nameInput());

        return MedicationNameResource::make($entry)->response()->setStatusCode(201);
    }

    /**
     * Rename one of the authenticated user's entries.
     *
     * Owner resolution lives on `App\Services\MedicationNameWriter::rename()`.
     */
    public function update(UpdateMedicationNameRequest $request, string $medicationName): JsonResponse
    {
        $entry = $this->writer->rename($request->user(), $medicationName, $request->nameInput());

        return MedicationNameResource::make($entry)->response();
    }

    /**
     * Delete one of the authenticated user's entries unless it is in use.
     *
     * Owner resolution lives on `App\Services\MedicationNameWriter::delete()`.
     */
    public function destroy(Request $request, string $medicationName): Response
    {
        $this->writer->delete($request->user(), $medicationName);

        return response()->noContent();
    }
}
