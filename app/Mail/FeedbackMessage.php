<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The feedback form message delivered to the project owner's inbox
 * (config('feedback.address')). Anonymous submissions carry no name and
 * no email — the body then says so, and no Reply-To is set.
 */
class FeedbackMessage extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $messageText,
        public readonly ?string $name,
        public readonly ?string $email,
        public readonly string $source,
    ) {}

    public function envelope(): Envelope
    {
        $from = config('mail.from');

        return new Envelope(
            from: new Address(
                $from['address'] ?? '',
                $from['name'] ?? null,
            ),
            to: [new Address((string) config('feedback.address'))],
            replyTo: $this->email !== null && $this->email !== ''
                ? [new Address($this->email)]
                : [],
            subject: $this->name !== null && $this->name !== ''
                ? "Обратная связь — {$this->name}"
                : 'Обратная связь (анонимно)',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.feedback',
            with: [
                'name' => $this->name,
                'email' => $this->email,
                'messageText' => $this->messageText,
                'source' => $this->source,
            ],
        );
    }
}
