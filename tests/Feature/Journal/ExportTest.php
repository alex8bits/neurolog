<?php

namespace Tests\Feature\Journal;

use App\Http\Requests\Seizures\IndexJournalRequest;
use App\Mail\JournalReport;
use App\Models\Seizure;
use App\Models\User;
use App\Services\SeizureDocxBuilder;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Markdown;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Feature tests for the slice-4 export/print/email actions.
 *
 * Conventions from CLAUDE.md: one happy-path per action + one auth test
 * for the whole group. Each action reuses {@see IndexJournalRequest}
 * for the `?from&to` query, so the same data setup (`2026-05-10 09:15 UTC`)
 * is reused across cases.
 */
class ExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_download_docx_for_the_current_period(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->withComment('Запись')
            ->create();

        $response = $this->actingAs($user)
            ->get(route('seizures.export', ['from' => '2026-05-10', 'to' => '2026-05-10']));

        $response->assertOk();
        $response->assertHeader('Content-Type', SeizureDocxBuilder::DOCX_MIME);
        // Symfony encodes the cyrillic filename as RFC 5987 `filename*=` —
        // either the raw UTF-8 string (when the client is a browser that
        // prefers it) or its percent-encoded form. The percent-encoded form
        // is always present in our response, so we decode that one and
        // assert the underlying filename.
        $disposition = (string) $response->headers->get('Content-Disposition');
        $this->assertMatchesRegularExpression(
            "/filename\\*=utf-8''([^\"']+)/i",
            $disposition,
            'Content-Disposition должен содержать RFC 5987 filename* с UTF-8 именем.',
        );
        preg_match("/filename\\*=utf-8''([^\\s'\"]+)/i", $disposition, $matches);
        $this->assertSame(
            'Журнал_приступов_10.05.2026.docx',
            rawurldecode($matches[1]),
        );
        // DOCX is a zip: first two bytes are the 'PK' signature.
        $this->assertSame('PK', substr($response->streamedContent(), 0, 2));
    }

    public function test_authenticated_user_can_view_print_page(): void
    {
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->create();

        $response = $this->actingAs($user)
            ->get(route('journal.print', ['from' => '2026-05-10', 'to' => '2026-05-10']));

        $response->assertOk();
        $response->assertSee('Журнал приступов');
        $response->assertSee('window.print');
        // 09:15 UTC → 12:15 в Москве.
        $response->assertSee('12:15');
    }

    public function test_authenticated_user_can_email_themselves(): void
    {
        Mail::fake();
        $user = User::factory()->create(['timezone' => 'Europe/Moscow']);
        Seizure::factory()
            ->for($user)
            ->occurredAt(CarbonImmutable::parse('2026-05-10 09:15:00', 'UTC'))
            ->create();

        $response = $this->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('seizures.email-self', ['from' => '2026-05-10', 'to' => '2026-05-10']));

        $response->assertRedirect(route('dashboard'));
        Mail::assertSent(JournalReport::class, function (JournalReport $mail) use ($user) {
            if (! $mail->hasTo($user->email)) {
                return false;
            }

            // attachments() возвращает массив Attachment-инстансов; в `as`
            // лежит исходное имя файла (см. JournalReport::attachments()).
            $attachments = $mail->attachments();
            $first = is_array($attachments) ? ($attachments[0] ?? null) : $attachments;

            return $first !== null
                && is_string($first->as)
                && str_ends_with($first->as, '.docx');
        });

        // M1 fix: the default body must not double the preposition `за` —
        // `periodLabel()` already returns "за 10.05.2026" for an equal-bound
        // period, and the template used to glue another `за ` on top.
        Mail::assertSent(JournalReport::class, function (JournalReport $mail) {
            $body = (string) $mail->content()->with['body'];

            return ! str_contains($body, 'приступов за за');
        });

        // M2 fix: Russian plural must follow the canonical rule — 1 запись,
        // 2-4 записи, 0/5-20/… записей. With APP_LOCALE=en, the template has
        // to force the `ru` locale explicitly. Render the markdown email
        // view with one entry and check the rendered plural. The literal
        // `запись|записи|записей` and the wrong `1 записей` form must NOT
        // appear in the output.
        $rendered = (string) app(Markdown::class)->render(
            'emails.journal',
            [
                'body' => 'Здравствуйте',
                'attachmentName' => 'Журнал.docx',
                'periodLabel' => 'за 10.05.2026',
                'totalEntries' => 1,
            ],
        );
        $this->assertStringContainsString('1 запись', $rendered);
        $this->assertStringNotContainsString('1 записей', $rendered);
        $this->assertStringNotContainsString('запись|записи|записей', $rendered);

        // n=5 must yield `5 записей` (genitive plural), not `5 записи` —
        // the en-locale MessageSelector would return the wrong form here,
        // so this is the real regression guard for the M2 fix.
        $rendered5 = (string) app(Markdown::class)->render(
            'emails.journal',
            [
                'body' => 'Здравствуйте',
                'attachmentName' => 'Журнал.docx',
                'periodLabel' => 'за 10.05.2026',
                'totalEntries' => 5,
            ],
        );
        $this->assertStringContainsString('5 записей', $rendered5);
        $this->assertStringNotContainsString('5 записи', $rendered5);
    }

    public function test_authenticated_user_can_email_a_doctor_with_custom_subject_and_body(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        $response = $this->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('seizures.email-doctor', ['from' => '2026-05-10', 'to' => '2026-05-10']), [
                'to' => 'doctor@example.com',
                'subject' => 'Срочный вопрос',
                'body' => 'Здравствуйте, посмотрите пожалуйста.',
            ]);

        $response->assertRedirect(route('dashboard'));
        Mail::assertSent(JournalReport::class, function (JournalReport $mail) {
            return $mail->hasTo('doctor@example.com')
                && $mail->hasSubject('Срочный вопрос');
        });
    }

    public function test_email_doctor_rejects_a_malformed_period_bound(): void
    {
        Mail::fake();
        $user = User::factory()->create();
        Seizure::factory()->for($user)->create();

        // `?from=garbage` used to reach `CarbonImmutable::parse()` inside
        // `SeizureQuery::forPeriod()` and produce a 500 — the query bounds
        // are now validated by `EmailDoctorRequest::validatedPeriod()`.
        $response = $this->actingAs($user)
            ->from(route('dashboard'))
            ->post(route('seizures.email-doctor', ['from' => 'garbage']), [
                'to' => 'doctor@example.com',
                'subject' => 'Срочный вопрос',
                'body' => 'Здравствуйте.',
            ]);

        $response->assertRedirect(route('dashboard'));
        $response->assertSessionHasErrorsIn('period', ['from']);
        Mail::assertNothingSent();
    }

    public function test_guest_cannot_access_export_routes(): void
    {
        $this->get(route('seizures.export'))->assertRedirect(route('login'));
        $this->get(route('journal.print'))->assertRedirect(route('login'));
        $this->post(route('seizures.email-self'))->assertRedirect(route('login'));
        $this->post(route('seizures.email-doctor'))->assertRedirect(route('login'));
    }
}
