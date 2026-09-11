<?php

namespace App\Http\Controllers;

use App\Actions\SendFeedback;
use App\Http\Requests\FeedbackRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    public function __construct(
        private readonly SendFeedback $sendFeedback,
    ) {}

    /**
     * Show the feedback form. Name/email prefill client-side from the
     * shared auth.user prop — the page needs no props of its own.
     */
    public function edit(): Response
    {
        return Inertia::render('Feedback');
    }

    /**
     * Send the feedback letter to the project owner.
     */
    public function store(FeedbackRequest $request): RedirectResponse
    {
        ($this->sendFeedback)($request->validated(), 'веб-сайт');

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Обращение отправлено.']);

        return back();
    }
}
