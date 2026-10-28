import { useNavigationContainerRef, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useConnectivity } from '@/offline/ConnectivityContext';
import {
    getAvailableUpdate,
    maybePromptUpdate,
    subscribeAvailableUpdate,
} from '@/updates/prompt';

/** Имя маршрута экрана быстрой записи (app/quick.tsx). */
const QUICK_ROUTE = 'quick';

/**
 * Единственный триггер проверки обновления: при монтировании (старт), при
 * появлении сети и при каждом возврате приложения в foreground (AppState →
 * 'active'). Только при online && networkKnown — офлайн-попытка ничего не
 * даст. Частоту запросов ограничивает сам maybePromptUpdate (троттлинг +
 * single-flight), поэтому хук можно дёргать на каждый триггер. Монтируется
 * один раз — в раскладке вкладок.
 *
 * Диалог не должен перекрыть экран быстрой записи /quick (тёплый старт
 * иконкой «Приступ» кладёт его над вкладками). Событие AppState приходит
 * почти одновременно с deep link, раньше, чем роутер применит навигацию,
 * поэтому гейт canPrompt читает текущий маршрут навигатора в момент
 * показа. Отложенный гейтом диалог покажется при уходе с /quick: эффект
 * зависит от того, открыт ли /quick.
 */
export function useUpdateCheck(): void {
    const { online, networkKnown } = useConnectivity();
    const navigationRef = useNavigationContainerRef();
    const segments = useSegments();
    const onQuick = segments[0] === QUICK_ROUTE;
    const canCheck = online && networkKnown && !onQuick;
    const canCheckRef = useRef(canCheck);

    const canPrompt = useCallback(() => {
        if (!navigationRef.isReady()) {
            return false;
        }

        // Корневой ref не знает ParamList приложения (тип never) — читаем
        // только имя маршрута.
        const route = navigationRef.getCurrentRoute() as
            { name: string } | undefined;

        return route?.name !== QUICK_ROUTE;
    }, [navigationRef]);

    useEffect(() => {
        canCheckRef.current = canCheck;

        if (canCheck) {
            void maybePromptUpdate(canPrompt);
        }
    }, [canCheck, canPrompt]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active' && canCheckRef.current) {
                void maybePromptUpdate(canPrompt);
            }
        });

        return () => subscription.remove();
    }, [canPrompt]);
}

/** Версия доступного обновления (null — нет/не проверено) без запроса
 *  в сеть: читает состояние, которое наполняет useUpdateCheck. */
export function useAvailableUpdate(): string | null {
    return useSyncExternalStore(
        subscribeAvailableUpdate,
        getAvailableUpdate,
        getAvailableUpdate,
    );
}
