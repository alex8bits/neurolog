<!doctype html>
<html lang="ru">
    <head>
        <meta charset="utf-8">
        <title>Журнал приступов — {{ $report->periodLabel() }}</title>
        <style>
            @page { size: A4; margin: 1.5cm; }
            body {
                font-family: 'Courier New', Consolas, monospace;
                font-size: 12pt;
                color: #000;
                margin: 0;
            }
            h1 {
                font-size: 16pt;
                margin: 0 0 0.4em 0;
            }
            h2 {
                font-size: 13pt;
                margin: 1em 0 0.2em 0;
            }
            p { margin: 0; line-height: 1.4; }
            .empty {
                color: #666;
                font-style: italic;
                margin-top: 0.5em;
            }
            .meta {
                color: #555;
                font-style: italic;
                margin-bottom: 1em;
            }
        </style>
    </head>
    <body>
        <h1>Журнал приступов</h1>
        <p class="meta">{{ $report->periodLabel() }}</p>

        @forelse ($report->days as $block)
            <h2>{{ $block->label }}</h2>
            @if ($block->medications !== [])
                <p>{{ implode(', ', $block->medications) }}</p>
            @endif
            @if ($block->quiet)
                <p>Без приступов</p>
            @else
                @foreach ($block->entries as $entry)
                    <p>
                        {{ $entry['time'] }}@if ($entry['comment'])
                            {{ $entry['comment'] }}
                        @endif
                    </p>
                @endforeach
            @endif
        @empty
            <p class="empty">За выбранный период приступов нет.</p>
        @endforelse

        <script>
            window.addEventListener('load', function () {
                window.print();
            });
        </script>
    </body>
</html>
