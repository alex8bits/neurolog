<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\SeizureController;
use Illuminate\Support\Facades\Route;

// Публичные эндпоинты авторизации: токена ещё нет, сессии в API нет тем более.
Route::name('api.v1.')->group(function () {
    Route::post('register', [AuthController::class, 'register'])
        ->middleware('throttle:login')
        ->name('register');

    Route::post('login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->name('login');

    Route::post('token/refresh', [AuthController::class, 'refresh'])
        ->middleware('throttle:30,1')
        ->name('token.refresh');

    Route::post('password/forgot', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,1')
        ->name('password.forgot');

    Route::post('password/reset', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:5,1')
        ->name('password.reset');
});

// Всё остальное — только по access-токену (концепт 4.2, 5).
Route::middleware('auth:sanctum')->name('api.v1.')->group(function () {
    Route::post('logout', [AuthController::class, 'logout'])->name('logout');

    Route::post('seizures', [SeizureController::class, 'store'])->name('seizures.store');

    Route::get('seizures', [SeizureController::class, 'index'])->name('seizures.index');

    // Параметр {seizure} намеренно без route-model binding: разрешение записи
    // с проверкой владельца делает контроллер через $request->user()->seizures().
    Route::patch('seizures/{seizure}', [SeizureController::class, 'update'])
        ->whereNumber('seizure')
        ->name('seizures.update');

    Route::delete('seizures/{seizure}', [SeizureController::class, 'destroy'])
        ->whereNumber('seizure')
        ->name('seizures.destroy');
});
