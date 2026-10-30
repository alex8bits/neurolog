<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexMedicationRequest;
use App\Http\Requests\Api\V1\StoreMedicationRequest;
use App\Http\Requests\Api\V1\UpdateMedicationRequest;
use App\Http\Resources\Api\V1\MedicationResource;
use App\Services\MedicationQuery;
use App\Services\MedicationWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class MedicationController extends Controller
{
    public function __construct(
        private readonly MedicationWriter $writer,
        private readonly MedicationQuery $query,
    ) {}

    /**
     * List the authenticated user's medications, filtered and paginated.
     *
     * "Today" is computed once by the same method `paginateForUser()` uses and
     * handed to the resource, so the status badges agree with the status
     * filter and the list order.
     */
    public function index(IndexMedicationRequest $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $timezone = $request->timezoneInput();

        $request->attributes->set(MedicationResource::TODAY_ATTRIBUTE, $this->query->todayFor($user, $timezone));

        return MedicationResource::collection($this->query->paginateForUser(
            $user,
            $request->filters(),
            $timezone,
            $request->perPage(),
        ));
    }

    /**
     * Create a medication for the authenticated user.
     */
    public function store(StoreMedicationRequest $request): JsonResponse
    {
        $user = $request->user();

        $medication = $this->writer->create($user, $request->medicationInput());

        $request->attributes->set(MedicationResource::TODAY_ATTRIBUTE, $this->query->todayFor($user, null));

        return MedicationResource::make($medication)->response()->setStatusCode(201);
    }

    /**
     * Replace one of the authenticated user's medications (PUT semantics).
     *
     * Owner resolution and the rationale for the `string` parameter live on
     * `App\Services\MedicationWriter::update()`.
     */
    public function update(UpdateMedicationRequest $request, string $medication): JsonResponse
    {
        $user = $request->user();

        $updated = $this->writer->update($user, $medication, $request->medicationInput());

        $request->attributes->set(MedicationResource::TODAY_ATTRIBUTE, $this->query->todayFor($user, null));

        return MedicationResource::make($updated)->response();
    }

    /**
     * Soft delete one of the authenticated user's medications.
     *
     * Owner resolution lives on `App\Services\MedicationWriter::delete()`.
     */
    public function destroy(Request $request, string $medication): Response
    {
        $this->writer->delete($request->user(), $medication);

        return response()->noContent();
    }
}
