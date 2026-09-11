@component('mail::message')
# Обратная связь

@if($name !== null && $name !== '')
**Имя:** {{ $name }}
**Email:** {{ $email }}
@else
**Обращение анонимное** — имя и почта не передавались.
@endif

---

{!! nl2br(e($messageText)) !!}

---

Источник: {{ $source }}
@endcomponent
