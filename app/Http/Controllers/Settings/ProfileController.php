<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/Profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'timezones' => $this->groupedTimezones(),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Profile updated.')]);

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Group the valid IANA timezones by region for the profile selector.
     *
     * The list comes from the very same source as the `timezone` validation rule,
     * so the selector can never offer a value the request would reject.
     *
     * @return array<int, array{region: string, zones: array<int, string>}>
     */
    private function groupedTimezones(): array
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
