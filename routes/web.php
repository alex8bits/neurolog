<?php

use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\MedicationController;
use App\Http\Controllers\MedicationNameController;
use App\Http\Controllers\SeizureController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

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

    Route::get('medications', [MedicationController::class, 'index'])
        ->name('medications.index');

    Route::post('medications', [MedicationController::class, 'store'])
        ->name('medications.store');

    Route::patch('medications/{medication}', [MedicationController::class, 'update'])
        ->whereNumber('medication')
        ->name('medications.update');

    Route::delete('medications/{medication}', [MedicationController::class, 'destroy'])
        ->whereNumber('medication')
        ->name('medications.destroy');

    Route::get('medication-names', [MedicationNameController::class, 'index'])
        ->name('medication-names.index');

    Route::post('medication-names', [MedicationNameController::class, 'store'])
        ->name('medication-names.store');

    Route::patch('medication-names/{medicationName}', [MedicationNameController::class, 'update'])
        ->whereNumber('medicationName')
        ->name('medication-names.update');

    Route::delete('medication-names/{medicationName}', [MedicationNameController::class, 'destroy'])
        ->whereNumber('medicationName')
        ->name('medication-names.destroy');

    // Обратная связь: письмо владельцу проекта (config feedback.address);
    // анонимный флаг отправляет только текст. Лимит жёстче экспортных
    // писем — адресат фиксирован, спам дороже.
    Route::get('feedback', [FeedbackController::class, 'edit'])->name('feedback.edit');

    Route::post('feedback', [FeedbackController::class, 'store'])
        ->middleware('throttle:3,1')
        ->name('feedback.store');
});

require __DIR__.'/settings.php';
