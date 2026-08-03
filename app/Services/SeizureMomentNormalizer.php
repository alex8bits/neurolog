<?php

namespace App\Services;

use Carbon\CarbonImmutable;

/**
 * Single point of truth for turning a submitted moment into an UTC instant.
 *
 * Both the write path (`SeizureWriter`) and the validation path
 * (`SeizureValidationRules`) go through this class, so the "is it in the
 * future?" check is applied to exactly the value that would be persisted.
 */
class SeizureMomentNormalizer
{
    /**
     * Normalize the submitted moment to an UTC instant.
     *
     * An empty input means "now". An input carrying an explicit offset (`Z`,
     * `+03:00`, `+0300`) is trusted as is. A naive input is interpreted in the
     * given timezone.
     *
     * The input must already be a parseable date and the timezone a valid IANA
     * name — otherwise `CarbonImmutable::parse()` throws.
     */
    public function normalize(?string $input, string $timezone = 'UTC'): CarbonImmutable
    {
        if ($input === null || trim($input) === '') {
            return CarbonImmutable::now('UTC');
        }

        $input = trim($input);

        if ($this->hasExplicitOffset($input)) {
            return CarbonImmutable::parse($input)->setTimezone('UTC');
        }

        return CarbonImmutable::parse($input, $timezone)->setTimezone('UTC');
    }

    /**
     * Determine whether the input string carries an explicit UTC offset.
     */
    public function hasExplicitOffset(string $input): bool
    {
        return preg_match('/(Z|[+-]\d{2}:?\d{2})$/i', trim($input)) === 1;
    }
}
