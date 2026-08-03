<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexSeizureRequest;
use App\Http\Requests\Api\V1\StoreSeizureRequest;
use App\Http\Resources\Api\V1\SeizureResource;
use App\Services\SeizureQuery;
use App\Services\SeizureWriter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class SeizureController extends Controller
{
    public function __construct(
        private readonly SeizureWriter $writer,
        private readonly SeizureQuery $query,
    ) {}

    /**
     * Record a seizure for the authenticated user.
     */
    public function store(StoreSeizureRequest $request): JsonResponse
    {
        $seizure = $this->writer->record(
            $request->user(),
            $request->occurredAtInput(),
            $request->commentInput(),
            $request->timezoneInput(),
        );

        return SeizureResource::make($seizure)->response()->setStatusCode(201);
    }

    /**
     * List the authenticated user's seizures for the requested period.
     */
    public function index(IndexSeizureRequest $request): AnonymousResourceCollection
    {
        $paginator = $this->query->paginateForPeriod(
            $request->user(),
            $request->fromInput(),
            $request->toInput(),
            $request->timezoneInput(),
            $request->perPage(),
        );

        return SeizureResource::collection($paginator);
    }

    /**
     * Soft delete one of the authenticated user's seizures.
     *
     * Owner resolution and the rationale for the `string` parameter live on
     * `App\Services\SeizureWriter::delete()`.
     */
    public function destroy(Request $request, string $seizure): Response
    {
        $this->writer->delete($request->user(), $seizure);

        return response()->noContent();
    }
}
