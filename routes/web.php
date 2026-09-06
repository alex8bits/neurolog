<?php

use App\Http\Controllers\SeizureController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'Welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [SeizureController::class, 'index'])->name('dashboard');

    Route::post('seizures', [SeizureController::class, 'store'])
        ->name('seizures.store');

    Route::patch('seizures/{seizure}', [SeizureController::class, 'update'])
        ->whereNumber('seizure')
        ->name('seizures.update');

    Route::delete('seizures/{seizure}', [SeizureController::class, 'destroy'])
        ->whereNumber('seizure')
        ->name('seizures.destroy');

    Route::get('seizures/export.docx', [SeizureController::class, 'download'])
        ->name('seizures.export');

    Route::get('journal/print', [SeizureController::class, 'print'])
        ->name('journal.print');

    // Outbound mail is capped per user (throttle keys by user id | ip): both
    // email actions share one budget of 5 sends per minute.
    Route::post('seizures/email-self', [SeizureController::class, 'emailSelf'])
        ->middleware('throttle:5,1')
        ->name('seizures.email-self');

    Route::post('seizures/email-doctor', [SeizureController::class, 'emailDoctor'])
        ->middleware('throttle:5,1')
        ->name('seizures.email-doctor');
});

require __DIR__.'/settings.php';
