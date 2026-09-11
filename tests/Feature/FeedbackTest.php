<?php

namespace Tests\Feature;

use App\Mail\FeedbackMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FeedbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/feedback')->assertRedirectToRoute('login');
        $this->post('/feedback', [])->assertRedirectToRoute('login');
    }

    public function test_the_page_renders_for_authenticated_users(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/feedback')
            ->assertOk()
            ->assertInertia(
                fn (Assert $page) => $page->component('Feedback'),
            );
    }

    public function test_store_sends_the_feedback_with_name_and_reply_to(): void
    {
        config()->set('feedback.address', 'owner@example.com');
        Mail::fake();

        $this->actingAs(User::factory()->create())
            ->post('/feedback', [
                'anonymous' => false,
                'name' => 'Alex',
                'email' => 'alex@example.com',
                'message' => 'Спасибо за приложение!',
            ])
            ->assertRedirect();

        Mail::assertQueued(FeedbackMessage::class, function (FeedbackMessage $mail) {
            $envelope = $mail->envelope();

            // Not anonymous: the owner may reply straight to the sender.
            $this->assertSame('Обратная связь — Alex', $envelope->subject);
            $this->assertSame('alex@example.com', $envelope->replyTo[0]->address);
            $this->assertSame('owner@example.com', $envelope->to[0]->address);

            return $mail->name === 'Alex' && $mail->email === 'alex@example.com';
        });
    }

    public function test_store_sends_an_anonymous_message_without_name_and_email(): void
    {
        config()->set('feedback.address', 'owner@example.com');
        Mail::fake();

        $this->actingAs(User::factory()->create())
            ->post('/feedback', [
                'anonymous' => true,
                'name' => 'Alex',
                'email' => 'alex@example.com',
                'message' => 'Хотел бы предложить улучшение.',
            ])
            ->assertRedirect();

        Mail::assertQueued(FeedbackMessage::class, function (FeedbackMessage $mail) {
            // Anonymous: whatever the client sent, the letter carries the
            // text only — no name, no email, no Reply-To.
            $this->assertNull($mail->name);
            $this->assertNull($mail->email);
            $this->assertSame('Обратная связь (анонимно)', $mail->envelope()->subject);
            $this->assertSame([], $mail->envelope()->replyTo);

            return true;
        });
    }
}
