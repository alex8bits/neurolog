<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when a refresh token is unknown, revoked or expired.
 */
class InvalidRefreshTokenException extends RuntimeException
{
    //
}
