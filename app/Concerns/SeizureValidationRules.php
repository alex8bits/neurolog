<?php

namespace App\Concerns;

use App\Models\User;
use App\Services\SeizureMomentNormalizer;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;

trait SeizureValidationRules
{
    use ResolvesUserTimezone;

    /**
     * The tolerance granted to a drifting client clock.
     */
    private const FUTURE_TOLERANCE_MINUTES = 5;

    /**
     * Get the request input value for the given key.
     *
     * @param  string|null  $key
     * @param  mixed  $default
     * @return mixed
     */
    abstract public function input($key = null, $default = null);

    /**
     * Get the user making the request.
     *
     * @param  string|null  $guard
     * @return mixed
     */
    abstract public function user($guard = null);

    /**
     * Get the validation rules used to validate seizure payloads.
     *
     * @return array<string, array<int, ValidationRule|array<mixed>|string>>
     */
    protected function seizureRules(): array
    {
        return [
            'occurred_at' => $this->occurredAtRules(),
            'comment' => $this->commentRules(),
            'timezone' => $this->timezoneRules(),
        ];
    }

    /**
     * Get the validation rules used to validate the moment of a seizure.
     *
     * The "not in the future" bound cannot live here: a naive moment only gets
     * its meaning once the `timezone` field of the same request is applied, and
     * declarative rules would parse it in `config('app.timezone')` instead.
     * It is enforced by {@see self::validateOccurredAtIsNotInFuture()}.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function occurredAtRules(): array
    {
        return ['nullable', 'string', 'date'];
    }

    /**
     * Get the validation rules used to validate a seizure comment.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function commentRules(): array
    {
        return ['nullable', 'string', 'max:2000'];
    }

    /**
     * Get the validation rules used to validate the timezone of the payload.
     *
     * @return array<int, ValidationRule|array<mixed>|string>
     */
    protected function timezoneRules(): array
    {
        return ['nullable', 'string', 'timezone'];
    }

    /**
     * Reject a moment that lies in the future once normalized to UTC.
     *
     * The normalization is the very same one the writer performs, so a naive
     * moment paired with `timezone` (the normal mobile payload) is judged in
     * that timezone rather than in the application default.
     */
    protected function validateOccurredAtIsNotInFuture(Validator $validator): void
    {
        // Nothing to compare against while the shape of the input is unknown.
        if ($validator->errors()->hasAny(['occurred_at', 'timezone'])) {
            return;
        }

        $input = $this->input('occurred_at');

        if (! is_string($input) || trim($input) === '') {
            return;
        }

        $requestedTimezone = $this->input('timezone');

        $moment = $this->momentNormalizer()->normalize(
            $input,
            $this->resolveTimezone(
                is_string($requestedTimezone) ? $requestedTimezone : null,
                $this->seizureOwner(),
            ),
        );

        $limit = CarbonImmutable::now('UTC')->addMinutes(self::FUTURE_TOLERANCE_MINUTES);

        if ($moment->greaterThan($limit)) {
            $validator->errors()->add(
                'occurred_at',
                'The occurred at field must not be a date in the future.',
            );
        }
    }

    /**
     * Get the owner the payload is validated for, when one is authenticated.
     */
    private function seizureOwner(): ?User
    {
        $user = $this->user();

        return $user instanceof User ? $user : null;
    }

    /**
     * Resolve the shared moment normalizer.
     */
    private function momentNormalizer(): SeizureMomentNormalizer
    {
        return app(SeizureMomentNormalizer::class);
    }
}
