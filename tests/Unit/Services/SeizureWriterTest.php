<?php

namespace Tests\Unit\Services;

use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureWriter;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Date;
use Tests\TestCase;

class SeizureWriterTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Date::setTestNow();

        parent::tearDown();
    }

    public function test_writer_is_resolvable_from_the_container(): void
    {
        $this->assertInstanceOf(SeizureWriter::class, app(SeizureWriter::class));
    }

    public function test_missing_occurred_at_falls_back_to_now_utc(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 12:15:00', 'UTC'));

        $seizure = $this->writer()->record($this->user());

        $this->assertSame(
            '2026-05-10 12:15:00',
            $seizure->occurred_at->setTimezone('UTC')->format('Y-m-d H:i:s'),
        );
    }

    public function test_empty_occurred_at_falls_back_to_now_utc(): void
    {
        Date::setTestNow(CarbonImmutable::parse('2026-05-10 12:15:00', 'UTC'));

        $seizure = $this->writer()->record($this->user(), '');

        $this->assertSame(
            '2026-05-10 12:15:00',
            $seizure->occurred_at->setTimezone('UTC')->format('Y-m-d H:i:s'),
        );
    }

    public function test_offset_aware_input_is_converted_to_utc(): void
    {
        $seizure = $this->writer()->record($this->user(), '2026-05-10T12:15:00+03:00');

        $this->assertStoredMoment($seizure, '2026-05-10 09:15:00');
    }

    public function test_offset_aware_input_wins_over_requested_timezone(): void
    {
        $seizure = $this->writer()->record(
            $this->user(),
            '2026-05-10T12:15:00+03:00',
            null,
            'America/New_York',
        );

        $this->assertStoredMoment($seizure, '2026-05-10 09:15:00');
    }

    public function test_zulu_input_is_stored_as_is(): void
    {
        $seizure = $this->writer()->record($this->user(), '2026-05-10T12:15:00Z');

        $this->assertStoredMoment($seizure, '2026-05-10 12:15:00');
    }

    public function test_naive_input_uses_requested_timezone(): void
    {
        $seizure = $this->writer()->record($this->user(), '2026-05-10 12:15', null, 'Europe/Moscow');

        $this->assertStoredMoment($seizure, '2026-05-10 09:15:00');
    }

    public function test_naive_input_without_timezone_falls_back_to_utc(): void
    {
        $seizure = $this->writer()->record($this->user(), '2026-05-10 12:15');

        $this->assertStoredMoment($seizure, '2026-05-10 12:15:00');
    }

    public function test_record_attaches_seizure_to_given_user(): void
    {
        $owner = $this->user();
        $stranger = $this->user();

        $seizure = $this->writer()->record($owner, '2026-05-10T12:15:00Z');

        $this->assertSame($owner->id, $seizure->user_id);
        $this->assertNotSame($stranger->id, $seizure->user_id);
    }

    public function test_record_ignores_a_foreign_user_id_in_the_comment_payload(): void
    {
        $owner = $this->user();
        $stranger = $this->user();

        // The writer accepts no user_id at all; even forging it through the
        // model's fillable list must not re-parent the record.
        $seizure = $this->writer()->record($owner, '2026-05-10T12:15:00Z');
        $seizure->fill(['user_id' => $stranger->id]);

        $this->assertSame($owner->id, $seizure->user_id);
        $this->assertDatabaseHas('seizures', [
            'id' => $seizure->id,
            'user_id' => $owner->id,
        ]);
    }

    public function test_comment_is_persisted_and_nullable(): void
    {
        $user = $this->user();

        $withComment = $this->writer()->record($user, '2026-05-10T12:15:00Z', 'Сильный приступ');
        $withoutComment = $this->writer()->record($user, '2026-05-10T13:15:00Z');

        $this->assertSame('Сильный приступ', $withComment->comment);
        $this->assertNull($withoutComment->comment);

        $this->assertDatabaseHas('seizures', [
            'id' => $withComment->id,
            'comment' => 'Сильный приступ',
        ]);
        $this->assertDatabaseHas('seizures', [
            'id' => $withoutComment->id,
            'comment' => null,
        ]);
    }

    public function test_update_normalizes_naive_input_using_the_users_profile_timezone(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        $seizure = $this->writer()->record($user, '2026-05-10T12:15:00Z');

        $updated = $this->writer()->update(
            $user,
            (string) $seizure->id,
            '2026-05-10 12:15',
        );

        $this->assertSame($seizure->id, $updated->id);
        $this->assertStoredMoment($updated, '2026-05-10 09:15:00');
    }

    public function test_update_rejects_a_foreign_record_and_leaves_it_intact(): void
    {
        $stranger = $this->user();
        $foreign = $this->writer()->record($stranger, '2026-05-10T12:15:00Z', 'Чужой');

        $intruder = $this->user();

        $this->expectException(ModelNotFoundException::class);

        try {
            $this->writer()->update($intruder, (string) $foreign->id, '2026-05-10T13:15:00Z', 'Подмена');
        } finally {
            $this->assertDatabaseHas('seizures', [
                'id' => $foreign->id,
                'comment' => 'Чужой',
                'occurred_at' => '2026-05-10 12:15:00',
            ]);
        }
    }

    public function test_delete_rejects_a_foreign_record(): void
    {
        $stranger = $this->user();
        $foreign = $this->writer()->record($stranger, '2026-05-10T12:15:00Z');

        $this->expectException(ModelNotFoundException::class);

        try {
            $this->writer()->delete($this->user(), (string) $foreign->id);
        } finally {
            $this->assertDatabaseHas('seizures', [
                'id' => $foreign->id,
                'deleted_at' => null,
            ]);
        }
    }

    public function test_delete_soft_deletes_owners_own_record(): void
    {
        $user = $this->user();
        $seizure = $this->writer()->record($user, '2026-05-10T12:15:00Z');

        $this->writer()->delete($user, (string) $seizure->id);

        $this->assertSoftDeleted('seizures', ['id' => $seizure->id]);
    }

    private function writer(): SeizureWriter
    {
        return app(SeizureWriter::class);
    }

    private function user(): User
    {
        return User::factory()->create();
    }

    private function assertStoredMoment(Seizure $seizure, string $expectedUtc): void
    {
        $this->assertSame(
            $expectedUtc,
            $seizure->occurred_at->setTimezone('UTC')->format('Y-m-d H:i:s'),
        );

        $this->assertDatabaseHas('seizures', [
            'id' => $seizure->id,
            'occurred_at' => $expectedUtc,
        ]);
    }
}
