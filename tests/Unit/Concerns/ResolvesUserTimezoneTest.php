<?php

namespace Tests\Unit\Concerns;

use App\Concerns\ResolvesUserTimezone;
use App\Models\User;
use PHPUnit\Framework\TestCase;

/**
 * Direct unit tests for the {@see ResolvesUserTimezone} trait.
 *
 * The trait is consumed by `SeizureWriter`, `SeizureQuery` and the validation
 * concerns, so its contract is the single seam of timezone interpretation.
 * Exercising it via an anonymous class keeps the test independent of the
 * database and of any consumer, and makes the priority chain obvious.
 */
class ResolvesUserTimezoneTest extends TestCase
{
    /**
     * Build a host class that exposes the protected resolver publicly.
     */
    private function host(): object
    {
        return new class
        {
            use ResolvesUserTimezone {
                resolveTimezone as public;
            }
        };
    }

    public function test_explicit_timezone_wins_over_profile_timezone(): void
    {
        $user = new User(['timezone' => 'Europe/Moscow']);

        $this->assertSame(
            'Europe/Berlin',
            $this->host()->resolveTimezone('Europe/Berlin', $user),
        );
    }

    public function test_blank_explicit_timezone_falls_back_to_profile_timezone(): void
    {
        $user = new User(['timezone' => 'Europe/Moscow']);

        $this->assertSame(
            'Europe/Moscow',
            $this->host()->resolveTimezone('   ', $user),
        );
    }

    public function test_missing_explicit_timezone_uses_profile_timezone(): void
    {
        $user = new User(['timezone' => 'Europe/Moscow']);

        $this->assertSame(
            'Europe/Moscow',
            $this->host()->resolveTimezone(null, $user),
        );
    }

    public function test_no_user_falls_back_to_utc(): void
    {
        $this->assertSame('UTC', $this->host()->resolveTimezone(null, null));
    }

    public function test_empty_profile_timezone_falls_back_to_utc(): void
    {
        $user = new User(['timezone' => '']);

        $this->assertSame('UTC', $this->host()->resolveTimezone(null, $user));
    }

    public function test_explicit_timezone_is_trimmed(): void
    {
        $user = new User(['timezone' => 'Europe/Moscow']);

        $this->assertSame(
            'Europe/Berlin',
            $this->host()->resolveTimezone('  Europe/Berlin  ', $user),
        );
    }
}
