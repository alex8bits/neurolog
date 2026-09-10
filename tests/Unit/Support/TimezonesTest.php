<?php

namespace Tests\Unit\Support;

use App\Support\Timezones;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Pins the shape the profile selector (web) and the mobile profile API
 * both rely on: full coverage of IANA identifiers, grouped by the prefix
 * before "/", regions sorted, zones sorted inside each region. Also pins
 * the submitted-timezone coalescing shared by registration and the
 * profile update.
 */
class TimezonesTest extends TestCase
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
    public function test_resolve_trims_and_returns_a_non_empty_string_timezone(string $input, string $expected): void
    {
        $this->assertSame($expected, Timezones::resolve($input));
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
    public function test_resolve_falls_back_to_utc_for_empty_null_or_non_string_input(mixed $input): void
    {
        $this->assertSame('UTC', Timezones::resolve($input));
    }

    public function test_groups_every_identifier_exactly_once(): void
    {
        $groups = Timezones::grouped();

        $zoned = array_merge(
            ...array_map(static fn (array $group): array => $group['zones'], $groups),
        );

        $expected = timezone_identifiers_list();
        sort($expected);
        sort($zoned);

        $this->assertSame($expected, $zoned);
    }

    public function test_regions_are_sorted_and_zones_are_sorted_within_each_region(): void
    {
        $groups = Timezones::grouped();

        $regions = array_map(static fn (array $group): string => $group['region'], $groups);
        $sortedRegions = $regions;
        sort($sortedRegions);
        $this->assertSame($sortedRegions, $regions);

        foreach ($groups as $group) {
            $sorted = $group['zones'];
            sort($sorted);
            $this->assertSame($sorted, $group['zones']);
            $this->assertNotEmpty($group['zones']);
        }
    }

    public function test_zones_without_slash_go_to_the_other_region(): void
    {
        $groups = Timezones::grouped();

        $other = null;

        foreach ($groups as $group) {
            if ($group['region'] === 'Other') {
                $other = $group;
            }
        }

        $this->assertNotNull($other);
        $this->assertContains('UTC', $other['zones']);
    }

    public function test_zones_are_grouped_by_prefix_before_slash(): void
    {
        $groups = Timezones::grouped();

        $europe = null;

        foreach ($groups as $group) {
            if ($group['region'] === 'Europe') {
                $europe = $group;
            }
        }

        $this->assertNotNull($europe);
        $this->assertContains('Europe/Moscow', $europe['zones']);

        foreach ($europe['zones'] as $zone) {
            $this->assertSame('Europe', strstr($zone, '/', true));
        }
    }
}
