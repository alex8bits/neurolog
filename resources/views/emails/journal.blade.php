<x-mail::message>
# Журнал приступов — {{ $periodLabel }}

{!! $body !!}

Файл во вложении: **{{ $attachmentName }}** ({{ $totalEntries }} {{ \Illuminate\Support\Facades\Lang::choice('запись|записи|записей', $totalEntries, [], 'ru') }}).

@component('mail::subcopy')
Это автоматическое письмо. Ответ на него придёт на ваш адрес.
@endcomponent
</x-mail::message>
