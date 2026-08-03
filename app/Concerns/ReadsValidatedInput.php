<?php

namespace App\Concerns;

trait ReadsValidatedInput
{
    /**
     * Get the validated data from the request.
     *
     * @param  string|null  $key
     * @param  mixed  $default
     * @return mixed
     */
    abstract public function validated($key = null, $default = null);

    /**
     * Get a validated string input, treating empty strings as absent.
     */
    protected function filledString(string $key): ?string
    {
        /** @var mixed $value */
        $value = $this->validated($key);

        if (! is_string($value) || $value === '') {
            return null;
        }

        return $value;
    }
}
