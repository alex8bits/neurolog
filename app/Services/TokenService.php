<?php

namespace App\Services;

use App\Exceptions\InvalidRefreshTokenException;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The single place where API tokens are issued, rotated and revoked.
 *
 * Access tokens are Sanctum personal access tokens; refresh tokens are our own
 * (concept 3.3) and live in `refresh_tokens` as SHA-256 hashes — the raw value
 * is handed to the client once and cannot be recovered from the database.
 */
class TokenService
{
    /**
     * Issue a fresh access + refresh token pair for the user.
     *
     * @return array{access_token: string, refresh_token: string, token_type: string, expires_in: int}
     */
    public function issueTokens(User $user): array
    {
        $accessLifetime = (int) config('sanctum.expiration');
        $refreshLifetime = (int) config('sanctum.refresh_expiration');

        $accessToken = $user->createToken('auth', ['*'], now()->addMinutes($accessLifetime));

        $rawRefreshToken = Str::random(64);

        RefreshToken::create([
            'user_id' => $user->id,
            'token' => $this->hashToken($rawRefreshToken),
            'expires_at' => now()->addMinutes($refreshLifetime),
        ]);

        return [
            'access_token' => $accessToken->plainTextToken,
            'refresh_token' => $rawRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => $accessLifetime * 60,
        ];
    }

    /**
     * Rotate the pair: revoke the presented refresh token together with every
     * access token of its owner, then issue a brand new pair.
     *
     * @return array{access_token: string, refresh_token: string, token_type: string, expires_in: int}
     *
     * @throws InvalidRefreshTokenException
     */
    public function refreshTokens(string $rawRefreshToken): array
    {
        $record = RefreshToken::query()
            ->where('token', $this->hashToken($rawRefreshToken))
            ->whereNull('revoked_at')
            ->first();

        if ($record === null || $record->expires_at->isPast()) {
            throw new InvalidRefreshTokenException;
        }

        return DB::transaction(function () use ($record): array {
            $user = $record->user;

            $user->tokens()->delete();
            $record->update(['revoked_at' => now()]);

            return $this->issueTokens($user);
        });
    }

    /**
     * Revoke every access and refresh token of the user (logout, password reset).
     */
    public function revokeAllTokens(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $user->tokens()->delete();

            $user->refreshTokens()
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
        });
    }

    /**
     * Hash a raw refresh token for storage and lookup.
     */
    private function hashToken(string $rawRefreshToken): string
    {
        return hash('sha256', $rawRefreshToken);
    }
}
