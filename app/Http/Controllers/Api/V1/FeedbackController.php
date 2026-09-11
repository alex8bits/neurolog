<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\SendFeedback;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\FeedbackRequest;
use Illuminate\Http\JsonResponse;

class FeedbackController extends Controller
{
    public function __construct(
        private readonly SendFeedback $sendFeedback,
    ) {}

    /**
     * Send the feedback letter to the project owner.
     */
    public function store(FeedbackRequest $request): JsonResponse
    {
        ($this->sendFeedback)($request->validated(), 'мобильное приложение');

        return response()->json(['message' => 'Обращение отправлено.']);
    }
}
