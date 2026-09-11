<?php

namespace App\Concerns;

use Illuminate\Contracts\Validation\ValidationRule;

trait FeedbackValidationRules
{
    /**
     * The rules shared by the web and API feedback forms. An anonymous
     * submission carries no name/email: the fields are nullable in that
     * mode and the send action nulls them out, so nothing but the
     * message ever reaches the mailable.
     *
     * @param  bool  $anonymous  the «anonymous» flag of the request
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    protected function feedbackRules(bool $anonymous): array
    {
        return [
            'anonymous' => ['required', 'boolean'],
            'name' => $anonymous
                ? ['nullable', 'string', 'max:255']
                : ['required', 'string', 'max:255'],
            'email' => $anonymous
                ? ['nullable', 'string', 'max:255']
                : ['required', 'email', 'max:255'],
            'message' => ['required', 'string', 'min:5', 'max:5000'],
        ];
    }
}
