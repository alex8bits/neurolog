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
        Schema::table('seizures', function (Blueprint $table) {
            // Идентификатор записи, сгенерированный клиентом (офлайн-очередь мобильного
            // приложения): повторная отправка с тем же client_id не создаёт дубль.
            $table->uuid('client_id')->nullable()->after('user_id');

            // NULL-ы не конфликтуют ни в SQLite, ни в MySQL — записи без client_id не ограничены.
            $table->unique(['user_id', 'client_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('seizures', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'client_id']);
            $table->dropColumn('client_id');
        });
    }
};
