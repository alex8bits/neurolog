<?php

namespace Tests\Concerns;

use App\Http\Requests\Api\V1\StoreSeizureRequest;
use Illuminate\Support\Facades\Validator as ValidatorFactory;
use Illuminate\Validation\Validator;

/**
 * Builds a `StoreSeizureRequest` outside of the HTTP pipeline.
 *
 * Unit tests that exercise the request's rules need the very same three steps
 * (instantiate → build the validator → hand it to `withValidator()`); keeping
 * them in one place makes sure both suites judge a payload identically.
 */
trait BuildsStoreSeizureRequests
{
    /**
     * Create an unvalidated request carrying the given payload.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function storeSeizureRequest(array $payload): StoreSeizureRequest
    {
        $request = StoreSeizureRequest::create('/api/v1/seizures', 'POST', $payload);
        $request->setContainer($this->app);

        return $request;
    }

    /**
     * Build the validator the request would run against the given payload.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function storeSeizureValidator(array $payload): Validator
    {
        $request = $this->storeSeizureRequest($payload);

        /** @var Validator $validator */
        $validator = ValidatorFactory::make($payload, $request->rules());

        $request->withValidator($validator);

        return $validator;
    }

    /**
     * Build a request whose payload has passed validation.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function validatedStoreSeizureRequest(array $payload): StoreSeizureRequest
    {
        $request = $this->storeSeizureRequest($payload);

        /** @var Validator $validator */
        $validator = ValidatorFactory::make($payload, $request->rules());

        $request->withValidator($validator);

        $this->assertTrue($validator->passes(), 'The payload was expected to pass validation.');

        $request->setValidator($validator);

        return $request;
    }
}
