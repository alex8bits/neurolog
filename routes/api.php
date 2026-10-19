<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\FeedbackController;
use App\Http\Controllers\Api\V1\JournalExportController;
use App\Http\Controllers\Api\V1\ProfileController;
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

    Route::get('profile', [ProfileController::class, 'show'])->name('profile.show');

    Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');

    // Смена пароля — подтверждение текущим паролем; лимит и ключ те же, что
    // у веб-смены и удаления профиля (общий бюджет 6/мин на пользователя).
    Route::patch('profile/password', [ProfileController::class, 'updatePassword'])
        ->middleware('throttle:6,1')
        ->name('profile.password.update');

    // Подтверждение паролем — брутфорс-щита просит лимит, равный смене пароля в вебе.
    Route::delete('profile', [ProfileController::class, 'destroy'])
        ->middleware('throttle:6,1')
        ->name('profile.destroy');

    Route::post('seizures', [SeizureController::class, 'store'])->name('seizures.store');

    Route::get('seizures', [SeizureController::class, 'index'])->name('seizures.index');

    Route::get('seizures/summary', [SeizureController::class, 'summary'])->name('seizures.summary');

    // Параметр {seizure} намеренно без route-model binding: разрешение записи
    // с проверкой владельца делает контроллер через $request->user()->seizures().
    Route::patch('seizures/{seizure}', [SeizureController::class, 'update'])
        ->whereNumber('seizure')
        ->name('seizures.update');

    Route::delete('seizures/{seizure}', [SeizureController::class, 'destroy'])
        ->whereNumber('seizure')
        ->name('seizures.destroy');

    // Экспорт и письма журнала: тот же DOCX/Mailable, что в вебе. Оба письма
    // делят один бюджет throttle:5,1 с веб-действиями (ключ — id пользователя).
    Route::get('seizures/export.docx', [JournalExportController::class, 'download'])
        ->name('seizures.export');

    Route::post('seizures/email-self', [JournalExportController::class, 'emailSelf'])
        ->middleware('throttle:5,1')
        ->name('seizures.email-self');

    Route::post('seizures/email-doctor', [JournalExportController::class, 'emailDoctor'])
        ->middleware('throttle:5,1')
        ->name('seizures.email-doctor');

    // Обратная связь: письмо владельцу проекта (config feedback.address);
    // анонимный флаг отправляет только текст. Лимит жёстче экспортных
    // писем — адресат фиксирован, спам дороже.
    Route::post('feedback', [FeedbackController::class, 'store'])
        ->middleware('throttle:3,1')
        ->name('feedback.store');
});
