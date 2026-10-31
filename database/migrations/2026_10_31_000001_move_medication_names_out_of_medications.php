<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $table->foreignId('medication_name_id')
                ->nullable()
                ->after('user_id')
                ->constrained('medication_names')
                ->cascadeOnDelete();
        });

        DB::transaction(function (): void {
            /** @var array<int, array<string, int>> $cache */
            $cache = [];

            // Включая мягко удалённые записи; по id — написание берётся из самой ранней записи.
            DB::table('medications')
                ->select(['id', 'user_id', 'name'])
                ->orderBy('id')
                ->chunkById(500, function ($rows) use (&$cache): void {
                    foreach ($rows as $row) {
                        $userId = (int) $row->user_id;
                        $name = trim((string) $row->name);
                        $fold = mb_strtolower($name);

                        if (! isset($cache[$userId][$fold])) {
                            $cache[$userId][$fold] = (int) DB::table('medication_names')->insertGetId([
                                'user_id' => $userId,
                                'name' => $name,
                                'name_search' => $fold,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }

                        DB::table('medications')
                            ->where('id', $row->id)
                            ->update(['medication_name_id' => $cache[$userId][$fold]]);
                    }
                });
        });

        Schema::table('medications', function (Blueprint $table) {
            $table->unsignedBigInteger('medication_name_id')->nullable(false)->change();
        });

        Schema::table('medications', function (Blueprint $table) {
            $table->dropColumn(['name', 'name_search']);
        });

        Schema::table('medications', function (Blueprint $table) {
            $table->decimal('dosage', 11, 5)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('medications', function (Blueprint $table) {
            $table->string('name')->nullable()->after('medication_name_id');
            $table->string('name_search')->nullable()->after('name');
        });

        DB::table('medications')->update([
            'name' => DB::raw('(SELECT name FROM medication_names WHERE medication_names.id = medications.medication_name_id)'),
            'name_search' => DB::raw('(SELECT name_search FROM medication_names WHERE medication_names.id = medications.medication_name_id)'),
        ]);

        Schema::table('medications', function (Blueprint $table) {
            $table->string('name')->nullable(false)->change();
            $table->string('name_search')->nullable(false)->change();
            $table->decimal('dosage', 8, 2)->change();
        });

        Schema::table('medications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('medication_name_id');
        });
    }
};
