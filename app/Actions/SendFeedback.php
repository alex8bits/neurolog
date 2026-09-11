<?php

namespace App\Actions;

use App\Mail\FeedbackMessage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Deliver a feedback form submission to the project owner's inbox
 * (config('feedback.address')). An anonymous submission carries the
 * message text only — name and email are nulled before the mailable is
 * even built, so they never leave the server request.
 */
class SendFeedback
{
    /**
     * @param  array<string, mixed>  $data  validated() of the feedback form
     */
    public function __invoke(array $data, string $source): void
    {
        $address = (string) config('feedback.address');

        if ($address === '') {
            // Не настроено окружение — честный отказ с полем message:
            // веб покажет у текстового поля, мобайл — в подсветке поля.
            throw ValidationException::withMessages([
                'message' => 'Обратная связь временно недоступна, попробуйте позже.',
            ]);
        }

        $anonymous = (bool) ($data['anonymous'] ?? false);

        Mail::to($address)->send(new FeedbackMessage(
            messageText: (string) ($data['message'] ?? ''),
            name: $anonymous ? null : (string) ($data['name'] ?? ''),
            email: $anonymous ? null : (string) ($data['email'] ?? ''),
            source: $source,
        ));
    }
}
