<?php

namespace Database\Seeders;

use App\Enums\MedicationUnit;
use App\Models\MedicationName;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Демо-аккаунт с вымышленными данными для скриншотов и публичного демо-входа.
 * Повторный запуск пересоздаёт аккаунт с нуля.
 *
 * php artisan db:seed --class=DemoSeeder
 *
 * Вход: demo@example.com / demo-password
 */
class DemoSeeder extends Seeder
{
    private const EMAIL = 'demo@example.com';

    private const PASSWORD = 'demo-password';

    private const TIMEZONE = 'Asia/Novosibirsk';

    private const COMMENTS = [
        'После дневного сна',
        'Короткий, около минуты',
        'Во время прогулки',
        'Ночью, во сне',
        'После недосыпа',
        'Перед ужином',
        'На фоне температуры',
    ];

    public function run(): void
    {
        User::query()->where('email', self::EMAIL)->delete();

        $user = User::query()->forceCreate([
            'name' => 'Демо',
            'email' => self::EMAIL,
            'email_verified_at' => now(),
            'password' => self::PASSWORD,
            'timezone' => self::TIMEZONE,
        ]);

        $this->seedSeizures($user);
        $this->seedMedications($user);
    }

    private function seedSeizures(User $user): void
    {
        mt_srand(42);

        $day = Carbon::now(self::TIMEZONE)->startOfDay()->subDays(120);
        $today = Carbon::now(self::TIMEZONE)->startOfDay();

        while ($day->lte($today)) {
            // Со временем приступов становится меньше — эффект подобранной терапии.
            $chance = $day->diffInDays($today) > 60 ? 35 : 18;

            if (mt_rand(1, 100) <= $chance) {
                $count = mt_rand(1, 100) <= 20 ? 2 : 1;

                for ($i = 0; $i < $count; $i++) {
                    $occurredAt = $day->copy()->setTime(mt_rand(6, 22), mt_rand(0, 59));

                    if ($occurredAt->isFuture()) {
                        continue;
                    }

                    $user->seizures()->create([
                        'occurred_at' => $occurredAt->utc(),
                        'comment' => mt_rand(1, 100) <= 35 ? self::COMMENTS[array_rand(self::COMMENTS)] : null,
                    ]);
                }
            }

            $day->addDay();
        }
    }

    private function seedMedications(User $user): void
    {
        $today = Carbon::now(self::TIMEZONE)->startOfDay();

        $intakes = [
            ['Депакин Хроно', '300', MedicationUnit::Mg, 1, 0, $today->copy()->subDays(150), null],
            ['Кеппра', '250', MedicationUnit::Mg, 1, 0, $today->copy()->subDays(70), null],
            ['Ламиктал', '25', MedicationUnit::Mg, 1, 0, $today->copy()->subDays(150), $today->copy()->subDays(71)],
            ['Аквадетрим', '2', MedicationUnit::Drop, 1, 0, $today->copy()->subDays(40), null],
            ['Магне B6', '1', MedicationUnit::Pil, 10, 20, $today->copy()->subDays(25), null],
            ['Кеппра', '500', MedicationUnit::Mg, 1, 0, $today->copy()->addDays(7), null],
        ];

        foreach ($intakes as [$name, $dosage, $unit, $intakeDays, $breakDays, $start, $end]) {
            $medicationName = MedicationName::query()->firstOrCreate(
                ['user_id' => $user->id, 'name_search' => MedicationName::fold($name)],
                ['name' => $name],
            );

            $user->medications()->create([
                'medication_name_id' => $medicationName->id,
                'dosage' => $dosage,
                'unit' => $unit,
                'intake_days' => $intakeDays,
                'break_days' => $breakDays,
                'start_date' => $start->toDateString(),
                'end_date' => $end?->toDateString(),
            ]);
        }
    }
}
