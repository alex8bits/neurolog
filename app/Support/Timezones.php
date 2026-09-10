<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Single source of the IANA timezone list shared by the web profile
 * selector and the mobile profile API. Pure functions — the only state is
 * the memoized grouped() result.
 */
final class Timezones
{
    /**
     * Memoized result of grouped(): the identifier list is constant for the
     * process lifetime, and both the web page and the API call this per
     * request. PHP arrays are copy-on-write, so callers cannot mutate the
     * cached copy.
     *
     * @var array<int, array{region: string, zones: array<int, string>}>|null
     */
    private static ?array $grouped = null;

    /**
     * Group the valid IANA timezones by region for the profile selector.
     *
     * The list comes from the very same source as the `timezone` validation rule,
     * so the selector can never offer a value the request would reject.
     *
     * @return array<int, array{region: string, zones: array<int, string>}>
     */
    public static function grouped(): array
    {
        return self::$grouped ??= self::buildGrouped();
    }

    /**
     * The submitted timezone when usable, UTC otherwise.
     *
     * Shared by registration (CreateNewUser) and the profile update: both
     * validate `timezone` as nullable (the trait is shared with registration)
     * while the column is NOT NULL, so the fallback must not drift between
     * the two flows.
     */
    public static function resolve(mixed $timezone): string
    {
        return is_string($timezone) && trim($timezone) !== '' ? trim($timezone) : 'UTC';
    }

    /**
     * @return array<int, array{region: string, zones: array<int, string>}>
     */
    private static function buildGrouped(): array
    {
        $byRegion = [];

        foreach (timezone_identifiers_list() as $zone) {
            $region = str_contains($zone, '/') ? Str::before($zone, '/') : 'Other';
            $byRegion[$region][] = $zone;
        }

        ksort($byRegion);

        $groups = [];

        foreach ($byRegion as $region => $zones) {
            sort($zones);
            $groups[] = ['region' => $region, 'zones' => $zones];
        }

        return $groups;
    }
}
