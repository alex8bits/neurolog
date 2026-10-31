<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            // Цикл «N дней приём, M дней перерыв», отсчёт от start_date (первый день — приём).
            // break_days = 0 — ежедневный приём (тогда intake_days всегда 1).
            $table->unsignedSmallInteger('intake_days')->default(1)->after('unit');
            $table->unsignedSmallInteger('break_days')->default(0)->after('intake_days');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $table->dropColumn(['intake_days', 'break_days']);
        });
    }
};
