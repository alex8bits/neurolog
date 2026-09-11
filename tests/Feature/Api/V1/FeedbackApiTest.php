<?php

namespace Tests\Feature\Api\V1;

use App\Mail\FeedbackMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class FeedbackApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_feedback_rejects_guests(): void
    {
        $this->postJson(route('api.v1.feedback.store'), [])->assertUnauthorized();
    }

    public function test_store_sends_the_feedback_from_the_mobile_app(): void
    {
        config()->set('feedback.address', 'owner@example.com');
        Mail::fake();

        $response = $this->actingAs(User::factory()->create())
            ->postJson(route('api.v1.feedback.store'), [
                'anonymous' => false,
                'name' => 'Alex',
                'email' => 'alex@example.com',
                'message' => 'Не открывается экран журнала на Android 9.',
            ]);

        $response->assertOk()->assertJsonPath('message', 'Обращение отправлено.');

        Mail::assertSent(FeedbackMessage::class, function (FeedbackMessage $mail) {
            return $mail->source === 'мобильное приложение'
                && $mail->name === 'Alex'
                && $mail->email === 'alex@example.com';
        });
    }

    public function test_anonymous_submission_carries_the_text_only(): void
    {
        config()->set('feedback.address', 'owner@example.com');
        Mail::fake();

        $this->actingAs(User::factory()->create())
            ->postJson(route('api.v1.feedback.store'), [
                'anonymous' => true,
                'message' => 'Анонимное пожелание.',
            ])
            ->assertOk();

        Mail::assertSent(FeedbackMessage::class, function (FeedbackMessage $mail) {
            return $mail->name === null && $mail->email === null;
        });
    }

    public function test_a_missing_message_is_rejected(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson(route('api.v1.feedback.store'), [
                'anonymous' => false,
                'name' => 'Alex',
                'email' => 'alex@example.com',
                'message' => '',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message');
    }
}
