<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Fortify\CreateNewUser;
use App\Actions\Fortify\ResetUserPassword;
use App\Exceptions\InvalidRefreshTokenException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ForgotPasswordRequest;
use App\Http\Requests\Api\V1\LoginRequest;
use App\Http\Requests\Api\V1\RefreshTokenRequest;
use App\Http\Requests\Api\V1\RegisterRequest;
use App\Http\Requests\Api\V1\ResetPasswordRequest;
use App\Http\Resources\Api\V1\TokenResource;
use App\Models\User;
use App\Services\TokenService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    public function __construct(
        private readonly TokenService $tokenService,
    ) {}

    /**
     * Register a new user and issue the first token pair.
     *
     * `password_confirmation` is passed on explicitly: `CreateNewUser` validates
     * its input again with a `confirmed` rule, and `validated()` would drop the
     * confirmation field because it is not a rule key of its own.
     *
     * `timezone` is optional — old mobile clients may omit it; the action falls
     * back to `UTC` when the value is missing or empty.
     */
    public function register(RegisterRequest $request, CreateNewUser $creator): JsonResponse
    {
        $user = $creator->create(
            $request->only(['name', 'email', 'password', 'password_confirmation', 'timezone']),
        );

        return TokenResource::make($this->tokenService->issueTokens($user))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Verify the credentials and issue a token pair.
     *
     * `Auth::validate()` checks the pair without touching the session — the API
     * is stateless and its routes carry no session middleware, so `attempt()`
     * would be both pointless and misleading here.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        if (! Auth::validate($request->only(['email', 'password']))) {
            return response()->json([
                'message' => __('auth.failed'),
            ], 422);
        }

        $user = User::query()->where('email', $request->string('email'))->firstOrFail();

        return TokenResource::make($this->tokenService->issueTokens($user))
            ->response()
            ->setStatusCode(200);
    }

    /**
     * Rotate the token pair using a refresh token.
     */
    public function refresh(RefreshTokenRequest $request): JsonResponse
    {
        try {
            $tokens = $this->tokenService->refreshTokens(
                $request->string('refresh_token')->toString(),
            );
        } catch (InvalidRefreshTokenException) {
            return response()->json([
                'message' => 'Invalid or expired refresh token.',
            ], 401);
        }

        return TokenResource::make($tokens)->response()->setStatusCode(200);
    }

    /**
     * Revoke every token of the authenticated user.
     */
    public function logout(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        $this->tokenService->revokeAllTokens($user);

        return response()->noContent();
    }

    /**
     * Send the password reset link — the very same mail as the web flow.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->sendResetLink($request->only('email'));

        // The answer is identical whether or not the address exists: the
        // endpoint must not disclose who has an account here.
        return response()->json(['message' => __($status)]);
    }

    /**
     * Reset the password by token and revoke every previously issued token.
     */
    public function resetPassword(ResetPasswordRequest $request, ResetUserPassword $resetter): JsonResponse
    {
        $resetUser = null;

        $status = Password::broker()->reset(
            $request->only(['email', 'password', 'password_confirmation', 'token']),
            function (User $user, string $password) use ($resetter, $request, &$resetUser): void {
                // Same trap as in register(): the action re-validates with `confirmed`.
                $resetter->reset($user, [
                    'password' => $password,
                    'password_confirmation' => $request->input('password_confirmation'),
                ]);

                $resetUser = $user;
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __($status)], 422);
        }

        // The owner comes from the broker callback: it only runs once the reset
        // token has been proven valid.
        if ($resetUser instanceof User) {
            $this->tokenService->revokeAllTokens($resetUser);
        }

        return response()->json(['message' => __($status)]);
    }
}
