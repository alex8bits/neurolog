<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ProfileDeleteRequest;
use App\Http\Requests\Api\V1\ProfileUpdateRequest;
use App\Http\Resources\Api\V1\UserResource;
use App\Models\User;
use App\Services\TokenService;
use App\Support\Timezones;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    public function __construct(
        private readonly TokenService $tokenService,
    ) {}

    /**
     * Show the profile together with the timezone list for the selector.
     *
     * The list rides as a top-level addition next to the `data` wrapper: the
     * selector options travel with the value they edit, in the very same
     * shape the web page receives from `Timezones::grouped()`.
     */
    public function show(Request $request): JsonResponse
    {
        return UserResource::make($request->user())
            ->additional(['timezones' => Timezones::grouped()])
            ->response();
    }

    /**
     * Update the profile information.
     *
     * Line-for-line the web flow (`Settings\ProfileController::update`): fill
     * the validated fields, reset the email verification mark when the email
     * changes, save. No toast or redirect — this is JSON, not Inertia.
     *
     * The one API-specific step is the timezone coalescing: the rule is
     * nullable (the trait is shared with registration) while the column is
     * NOT NULL, so a missing, null or empty value becomes `UTC` — the same
     * `Timezones::resolve()` the registration flow uses.
     */
    public function update(ProfileUpdateRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validated();
        $data['timezone'] = Timezones::resolve($data['timezone'] ?? null);

        $user->fill($data);

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return UserResource::make($user)->response();
    }

    /**
     * Delete the account after a password check.
     *
     * Tokens are revoked before the delete: `personal_access_tokens` hangs on
     * its tokenable by a polymorphic relation with no FK cascade, so skipping
     * the revoke would leave orphans behind. Seizures, refresh tokens and
     * passkeys go down with the DB cascades. Both steps run in one
     * transaction (`revokeAllTokens` nests as a savepoint), so a failed
     * delete cannot leave the user alive but logged out everywhere. There is
     * no session in the API, so the web logout steps are not needed here.
     */
    public function destroy(ProfileDeleteRequest $request): Response
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            $this->tokenService->revokeAllTokens($user);

            $user->delete();
        });

        return response()->noContent();
    }
}
