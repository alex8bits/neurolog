<?php

namespace Tests\Unit\Actions\Fortify\CreateNewUser;

use App\Actions\Fortify\CreateNewUser;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Direct unit tests for the private `resolveSubmittedTimezone()` seam on
 * {@see CreateNewUser}. The method is reached through reflection, so the
 * test stays free of the database, of `User::create()` and of any Fortify
 * plumbing.
 */
class ResolveSubmittedTimezoneTest extends TestCase
{
    /**
     * @return array<string, array{string, string}>
     */
    public static function validTimezones(): array
    {
        return [
            'plain IANA zone' => ['Europe/Moscow', 'Europe/Moscow'],
            'zone padded with whitespace' => ['  Asia/Novosibirsk  ', 'Asia/Novosibirsk'],
        ];
    }

    #[DataProvider('validTimezones')]
    public function test_a_non_empty_string_timezone_is_trimmed_and_returned(string $input, string $expected): void
    {
        $this->assertSame($expected, $this->resolve($input));
    }

    /**
     * @return array<string, array{mixed}>
     */
    public static function falsyOrNonStringInputs(): array
    {
        return [
            'null' => [null],
            'empty string' => [''],
            'whitespace only' => ['   '],
            'integer' => [42],
            'array' => [['Europe/Moscow']],
        ];
    }

    #[DataProvider('falsyOrNonStringInputs')]
    public function test_empty_null_or_non_string_input_falls_back_to_utc(mixed $input): void
    {
        $this->assertSame('UTC', $this->resolve($input));
    }

    private function resolve(mixed $input): string
    {
        $method = new ReflectionMethod(CreateNewUser::class, 'resolveSubmittedTimezone');
        $method->setAccessible(true);

        return $method->invoke(new CreateNewUser, $input);
    }
}
